// M2 — Idea Register (All Ideas) / My Ideas: table + Kanban, saved views, quick filter chips, drill-down URL contract.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Bucket, Idea, SavedView } from '../lib/types'
import { hasRole, useMe, useStore } from '../store/useStore'
import { useVisibleIdeas } from '../lib/hooks'
import { applyFilters, BUCKET_STYLE } from '../lib/calc'
import { can } from '../lib/nav'
import { LEVER_GROUP_STYLE } from '../lib/masters'
import { FilterBar } from '../components/FilterBar'
import {
  AgeBadge, BucketBadge, Button, Card, Count, DataTable, EmptyState, HealthBadge, Icon, InfoTip, LeverChip, Money, PageHeader, SavingsTypeBadge,
  Segmented, Skeleton, SlaPill, StageBadge, Tooltip, UserChip, cn, useWarmup, type Column,
} from '../components/ui'
import { fmtDate, inrShort, sum, todayIso } from '../lib/format'
import {
  LEVER_GROUPS, PARAM_LABEL, ROUTES, ROUTE_ICON, SAVINGS_TYPES, SAVINGS_TYPE_COLOR, commodityName, exportIdeas, filterRows, paramsToObject, toRow, useCtx,
  valueLabel, type Ctx, type IdeaRow,
} from './idea/model'
import { KanbanBoard } from './idea/Kanban'

// ─── Quick-filter chip with count ─────────────────────────────────────────────
function FacetChip({ label, count, color, active, onClick, icon, tip }: { label: string; count: number; color: string; active: boolean; onClick: () => void; icon?: string; tip?: string }) {
  if (!count && !active) return null
  const el = (
    <button onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 h-[26px] pl-2 pr-0.5 rounded-full text-[11.5px] font-semibold border transition-all whitespace-nowrap', active ? 'text-white border-transparent shadow-[0_6px_14px_-6px_rgb(35_43_110/.6)]' : 'bg-[#f6f7fc] text-ink-2 border-transparent hover:bg-white hover:border-line hover:shadow-sm')}
      style={active ? { background: `linear-gradient(135deg, ${color}, ${color}d9)` } : undefined}>
      {icon ? <Icon name={icon} size={12} style={{ color: active ? '#fff' : color }} /> : <span className="h-2 w-2 rounded-full" style={{ background: active ? '#fff' : color }} />}
      {label}
      <span className={cn('min-w-[22px] h-[22px] px-1.5 rounded-full text-[10.5px] font-bold grid place-items-center num', active ? 'bg-white/25 text-white' : 'bg-white text-[#5b6384] ring-1 ring-line/70')}>{count}</span>
    </button>
  )
  return tip ? <Tooltip content={tip}>{el}</Tooltip> : el
}
const GroupLabel = ({ children }: { children: string }) => <span className="text-[9.5px] font-bold uppercase tracking-[.14em] text-[#8a91ad] ml-1 mr-1">{children}</span>
const Sep = () => <span className="hidden md:block w-px h-4 bg-gradient-to-b from-transparent via-line to-transparent mx-1.5" />

// ─── Summary strip: value by bucket (click to filter) ─────────────────────────
function RegisterSummary({ rows, activeBucket, onBucket, slaActive, onSla }: { rows: IdeaRow[]; activeBucket?: string; onBucket: (b: Bucket) => void; slaActive: boolean; onSla: () => void }) {
  const order: Bucket[] = ['Draft', 'Pipeline', 'In Execution', 'Implemented', 'Dropped']
  const data = order
    .map((b) => { const rs = rows.filter((r) => r.idea.bucket === b); return { b, n: rs.length, v: sum(rs.map((r) => r.annual)) } })
    .filter((d) => d.b !== 'Draft' || d.n > 0)
  const barTotal = sum(data.map((d) => Math.max(0, d.v))) || 1
  const live = sum(data.filter((d) => d.b === 'Pipeline' || d.b === 'In Execution' || d.b === 'Implemented').map((d) => d.v))
  const pipe = rows.filter((r) => r.idea.bucket === 'Pipeline')
  const avgAge = pipe.length ? sum(pipe.map((r) => r.age)) / pipe.length : 0
  const breaches = rows.filter((r) => r.sla.state === 'breach' || r.sla.state === 'escalated').length
  return (
    <div className="card p-4 mb-4 grid grid-cols-2 lg:grid-cols-12 gap-x-4 gap-y-3 items-center">
      <div className="lg:col-span-2 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ideas</div>
        <div className="text-[24px] font-bold tracking-tight text-ink leading-none mt-1"><Count value={rows.length} /></div>
        <div className="text-[11px] text-muted mt-1">{pipe.length} in pipeline</div>
      </div>
      <div className="lg:col-span-2 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1">Live value <InfoTip title="Live value" formula="Σ annualised impact · Pipeline + In Execution + Implemented">Dropped ideas are excluded. Cost avoidance and one-time savings are included here but reported separately from hard savings.</InfoTip></div>
        <div className="text-[22px] font-bold tracking-tight text-ink leading-none mt-1"><Money value={live} /></div>
        <div className="text-[11px] text-muted mt-1">annualised</div>
      </div>
      <div className="col-span-2 lg:col-span-5 min-w-0">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
          {data.map((d) => d.v > 0 && (
            <div key={d.b} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full" style={{ width: `${(Math.max(0, d.v) / barTotal) * 100}%`, background: BUCKET_STYLE[d.b].color, opacity: activeBucket && activeBucket !== d.b ? 0.35 : 1 }} />
          ))}
        </div>
        <div className={cn('grid gap-1.5 mt-2', data.length > 4 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
          {data.map((d) => {
            const st = BUCKET_STYLE[d.b]
            const on = activeBucket === d.b
            return (
              <button key={d.b} onClick={() => onBucket(d.b)} className={cn('text-left rounded-lg px-2 py-1 border transition-all min-w-0', on ? 'shadow-sm' : 'border-transparent hover:bg-slate-50')} style={on ? { borderColor: st.color, background: st.soft } : undefined}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: st.text }}><span className="h-2 w-2 rounded-full shrink-0" style={{ background: st.color }} /><span className="truncate">{st.label}</span></div>
                <div className="flex items-baseline gap-1.5 min-w-0"><span className="text-[13px] font-bold num text-ink truncate">{inrShort(d.v)}</span><span className="text-[11px] num text-muted shrink-0">· {d.n}</span></div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="col-span-2 lg:col-span-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1 truncate">Avg age in stage <InfoTip title="Idea ageing" formula="Days in current stage (Pipeline ideas)" /></div>
          <div className="text-[15px] font-bold num text-ink">{avgAge.toFixed(1)}<span className="text-[11px] font-semibold text-muted ml-0.5">d</span></div>
        </div>
        <button onClick={onSla} className={cn('rounded-lg border px-2.5 py-1.5 text-left transition min-w-0', slaActive ? 'bg-red-600 border-red-600 text-white' : breaches ? 'bg-red-50 border-red-100 hover:border-red-300' : 'bg-slate-50 border-slate-100')}>
          <div className={cn('text-[10.5px] font-semibold uppercase tracking-wide truncate', slaActive ? 'text-white/80' : 'text-red-700')}>SLA breach</div>
          <div className={cn('text-[15px] font-bold num', slaActive ? 'text-white' : breaches ? 'text-red-600' : 'text-ink')}>{breaches}</div>
        </button>
      </div>
    </div>
  )
}

// ─── Saved views ──────────────────────────────────────────────────────────────
function SavedViews({ params, ctx, onApply }: { params: Record<string, string>; ctx: Ctx; onApply: (v: SavedView) => void }) {
  const me = useMe()
  const views = useStore((s) => s.savedViews)
  const saveView = useStore((s) => s.saveView)
  const deleteView = useStore((s) => s.deleteView)
  const toast = useStore((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const list = views.filter((v) => v.userId === '*' || v.userId === me?.id)
  const sig = (f: Record<string, any>) => Object.entries(f || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${v}`).sort().join('&')
  const cur = sig(params)
  const activeView = cur ? list.find((v) => sig(v.filters) === cur) : undefined
  const hasFilters = !!cur
  const describe = (f: Record<string, any>) => Object.entries(f || {}).map(([k, v]) => `${PARAM_LABEL[k] ?? k}: ${valueLabel(k, String(v), ctx)}`).join(' · ') || 'No filters'
  const canDelete = (v: SavedView) => v.userId === me?.id || hasRole(me, 'admin', 'head')
  const save = () => {
    const n = name.trim()
    if (!n || !me || !hasFilters) return
    saveView({ name: n, userId: me.id, filters: { ...params }, columns: [] })
    toast(`View “${n}” saved`, 'success')
    setName('')
  }
  const del = (v: SavedView) => {
    deleteView(v.id)
    toast(`View “${v.name}” deleted`, 'info', () => useStore.setState((s) => ({ savedViews: [...s.savedViews, v] })))
  }
  return (
    <div className="relative">
      <Button icon="Bookmark" iconRight="ChevronDown" onClick={() => setOpen((o) => !o)} className={activeView ? '!border-brand-300 !bg-brand-50 !text-brand-700' : undefined}>
        <span className="max-w-[170px] truncate">{activeView ? activeView.name : 'Saved views'}</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 sm:left-auto sm:right-0 top-11 z-40 w-[360px] max-w-[92vw] card shadow-2xl p-2 animate-pop">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Saved views</span>
              <span className="text-[11px] text-muted">{list.length}</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {list.map((v) => {
                const on = activeView?.id === v.id
                return (
                  <div key={v.id} className={cn('group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer', on ? 'bg-brand-50' : 'hover:bg-slate-50')} onClick={() => { onApply(v); setOpen(false) }}>
                    <Icon name={on ? 'BookmarkCheck' : 'Bookmark'} size={15} className={cn('mt-0.5 shrink-0', on ? 'text-brand-600' : 'text-muted')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-ink truncate">{v.name}</span>
                        <span className={cn('text-[9.5px] font-bold uppercase px-1 rounded', v.userId === '*' ? 'bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-700')}>{v.userId === '*' ? 'Shared' : 'Mine'}</span>
                      </div>
                      <div className="text-[11px] text-muted truncate">{describe(v.filters)}</div>
                    </div>
                    {canDelete(v) && (
                      <button title="Delete view" onClick={(e) => { e.stopPropagation(); del(v) }} className="h-6 w-6 grid place-items-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-60 group-hover:opacity-100 shrink-0">
                        <Icon name="Trash2" size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
              {!list.length && <div className="px-2 py-4 text-center text-[12px] text-muted">No saved views yet.</div>}
            </div>
            <div className="border-t border-line mt-1 pt-2 px-1">
              <div className="text-[11px] font-semibold text-ink-2 mb-1.5 flex items-center gap-1"><Icon name="BookmarkPlus" size={13} />Save current filters as a view</div>
              <div className="flex gap-1.5">
                <input className="input !h-8 text-[12.5px]" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder={hasFilters ? 'View name, e.g. Overdue Technical ideas' : 'Apply a filter or chip first'} disabled={!hasFilters} />
                <Button size="sm" variant="primary" disabled={!hasFilters || !name.trim()} onClick={save}>Save</Button>
              </div>
              {hasFilters && <div className="text-[10.5px] text-muted mt-1 truncate">{describe(params)}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IdeaRegister({ mode }: { mode: 'all' | 'mine' }) {
  const me = useMe()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const ideas = useStore((s) => s.ideas)
  const openIdea = useStore((s) => s.openIdea)
  const globalFilters = useStore((s) => s.filters)
  const resetFilters = useStore((s) => s.resetFilters)
  const toast = useStore((s) => s.toast)
  const visible = useVisibleIdeas()
  const ctx = useCtx()
  const ready = useWarmup(320)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [colPreset, setColPreset] = useState<string[] | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showFacets, setShowFacets] = useState(false)
  const view = sp.get('view') === 'kanban' ? 'kanban' : 'table'
  const params = useMemo(() => paramsToObject(sp), [sp])
  const [q, setQ] = useState(params.q ?? '')

  const setParam = (key: string, value: string | null) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev)
      if (value == null || value === '') next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  const toggle = (key: string, value: string) => setParam(key, params[key] === value ? null : value)
  const clearAll = () => setSp(view === 'kanban' ? new URLSearchParams({ view: 'kanban' }) : new URLSearchParams(), { replace: true })

  useEffect(() => { setQ(params.q ?? '') }, [params.q])
  useEffect(() => {
    const t = setTimeout(() => { if ((params.q ?? '') !== q.trim()) setParam('q', q.trim() || null) }, 220)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const scoped = useMemo(() => {
    if (!me) return [] as Idea[]
    const own = (i: Idea) => i.submitterId === me.id || (me.roles.includes('supplier') && i.isSupplierSubmission && !!me.supplierCode && i.supplierCode === me.supplierCode)
    const list = mode === 'mine' ? ideas.filter(own) : visible.filter((i) => i.stage !== 'Draft' || i.submitterId === me.id)
    return applyFilters(list, globalFilters, ctx.commodities)
  }, [mode, ideas, visible, me, globalFilters, ctx.commodities])
  const rows = useMemo(() => scoped.map((i) => toRow(i, ctx)), [scoped, ctx])
  const filtered = useMemo(() => filterRows(rows, params, ctx), [rows, params, ctx])
  const facets = useMemo(() => ({
    bucket: filterRows(rows, params, ctx, ['bucket']),
    group: filterRows(rows, params, ctx, ['group']),
    route: filterRows(rows, params, ctx, ['route']),
    savingsType: filterRows(rows, params, ctx, ['savingsType']),
    sla: filterRows(rows, params, ctx, ['sla']),
    supplierOnly: filterRows(rows, params, ctx, ['supplierOnly']),
  }), [rows, params, ctx])
  const cnt = (list: IdeaRow[], fn: (r: IdeaRow) => boolean) => list.filter(fn).length
  const activeEntries = Object.entries(params)
  const globalActive = Object.entries(globalFilters).some(([k, v]) => k !== 'fy' && v !== 'All')
  const filteredValue = sum(filtered.map((r) => r.annual))

  const plantName = (id: string) => ctx.plants.find((p) => p.id === id)?.name ?? id
  const columns: Column<IdeaRow>[] = useMemo(() => {
    const cols: Column<IdeaRow>[] = [
      { key: 'id', label: 'ID', exportLabel: 'Idea ID', value: (r) => r.id,
        render: (r) => <button onClick={(e) => { e.stopPropagation(); nav(`/ideas/${r.id}`) }} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline whitespace-nowrap" title="Open the full idea page">{r.id}</button> },
      { key: 'title', label: 'Title', value: (r) => r.idea.title,
        render: (r) => (
          <div className="flex items-center gap-1.5 min-w-[180px] max-w-[300px]">
            <span className="line-clamp-2 font-medium text-ink" title={r.idea.title}>{r.idea.title}</span>
            {r.idea.isSupplierSubmission && <Tooltip content={`Supplier idea · ${r.idea.supplierCode}`}><Icon name="Factory" size={12} className="text-teal-600 shrink-0" /></Tooltip>}
            {r.idea.campaignId && <Tooltip content={ctx.campaigns.find((c) => c.id === r.idea.campaignId)?.name ?? r.idea.campaignId}><Icon name="Megaphone" size={12} className="text-brand-600 shrink-0" /></Tooltip>}
            {r.idea.infoRequested && <Tooltip content="More info requested from submitter"><Icon name="MessageCircleQuestion" size={12} className="text-amber-600 shrink-0" /></Tooltip>}
            {r.idea.locked && <Tooltip content="Approved values are locked"><Icon name="Lock" size={11} className="text-slate-400 shrink-0" /></Tooltip>}
          </div>
        ) },
      { key: 'commodity', label: 'Commodity', value: (r) => r.commodityName, render: (r) => <span className="text-[12.5px]" title={r.commodityName}>{r.commodityName.split(' (')[0]}</span> },
      { key: 'lever', label: 'Category', value: (r) => r.leverName, render: (r) => <LeverChip leverId={r.idea.leverId} /> },
      { key: 'route', label: 'Route', hidden: true, value: (r) => r.idea.route, render: (r) => <span className="inline-flex items-center gap-1 text-[12px] text-ink-2"><Icon name={ROUTE_ICON[r.idea.route]} size={12} className="text-muted" />{r.idea.route}</span> },
      { key: 'stage', label: 'Stage', value: (r) => r.idea.stage, render: (r) => <StageBadge stage={r.idea.stage} bucket={r.idea.bucket} /> },
      { key: 'bucket', label: 'Bucket', hidden: true, value: (r) => r.idea.bucket, render: (r) => <BucketBadge bucket={r.idea.bucket} /> },
      { key: 'annual', label: 'Annualised impact', exportLabel: 'Annualised impact (₹)', align: 'right', value: (r) => Math.round(r.annual),
        render: (r) => <span className={cn('num font-semibold', r.annual < 0 ? 'text-red-600' : 'text-ink')}>{inrShort(r.annual)}{r.idea.scope === 'Open' && <span className="ml-1 text-[9.5px] font-bold text-amber-600">EST.</span>}</span> },
      { key: 'savingsType', label: 'Savings type', hidden: true, value: (r) => r.idea.savingsType, render: (r) => <SavingsTypeBadge type={r.idea.savingsType} /> },
      { key: 'submitter', label: 'Submitter', value: (r) => r.idea.submitterName,
        render: (r) => r.idea.isSupplierSubmission
          ? <span className="inline-flex items-center gap-1.5 text-[12.5px]"><span className="h-5 w-5 rounded-full bg-teal-50 text-teal-700 grid place-items-center"><Icon name="Factory" size={11} /></span>{r.idea.submitterName}</span>
          : <UserChip userId={r.idea.submitterId} size={20} /> },
      { key: 'owner', label: 'Buyer / owner', value: (r) => r.ownerName, render: (r) => <UserChip userId={r.ownerId} size={20} /> },
      { key: 'plant', label: 'Plant', hidden: true, value: (r) => r.idea.plant, render: (r) => <Tooltip content={plantName(r.idea.plant)}><span className="text-[12px] font-semibold text-ink-2">{r.idea.plant}</span></Tooltip> },
      { key: 'submitted', label: 'Submitted', hidden: true, value: (r) => r.submitted, render: (r) => r.idea.stage === 'Draft' ? <span className="text-[12px] text-muted">Draft</span> : <span className="text-[12px] num text-ink-2">{fmtDate(r.submitted)}</span> },
      { key: 'ageing', label: 'Ageing · SLA', exportLabel: 'Days in current stage', value: (r) => r.age,
        render: (r) => (r.idea.bucket === 'Pipeline' || r.idea.bucket === 'In Execution')
          ? <span className="inline-flex flex-wrap items-center gap-1"><AgeBadge days={r.age} />{r.sla.state !== 'none' && <SlaPill state={r.sla.state} left={r.sla.left} working={r.sla.working} />}</span>
          : <span className="text-[12px] text-muted">—</span> },
      { key: 'health', label: 'Health', hidden: true, value: (r) => r.health ?? '', render: (r) => r.health ? <HealthBadge health={r.health} /> : <span className="text-[12px] text-muted">—</span> },
      { key: 'category', label: 'Commodity group', hidden: true, value: (r) => ctx.categories.find((c) => c.id === r.idea.categoryId)?.name ?? r.idea.categoryId, render: (r) => <span className="text-[12.5px]">{ctx.categories.find((c) => c.id === r.idea.categoryId)?.name ?? r.idea.categoryId}</span> },
      { key: 'dept', label: 'Department', hidden: true, value: (r) => r.idea.department, render: (r) => <span className="text-[12.5px]">{r.idea.department}</span> },
      { key: 'campaign', label: 'Campaign', hidden: true, value: (r) => ctx.campaigns.find((c) => c.id === r.idea.campaignId)?.name ?? '', render: (r) => <span className="text-[12.5px]">{ctx.campaigns.find((c) => c.id === r.idea.campaignId)?.name ?? '—'}</span> },
      { key: 'expectedQuarter', label: 'Expected quarter', hidden: true, value: (r) => r.idea.expectedQuarter, render: (r) => <span className="text-[12.5px]">{r.idea.expectedQuarter}</span> },
      { key: 'investment', label: 'One-time investment', exportLabel: 'One-time investment (₹)', align: 'right', hidden: true, value: (r) => r.idea.oneTimeInvestment || 0, render: (r) => <span className="num text-[12.5px]">{inrShort(r.idea.oneTimeInvestment || 0)}</span> },
      { key: 'dropReason', label: 'Drop reason', hidden: true, value: (r) => r.idea.dropReason ?? '', render: (r) => <span className="text-[12.5px]">{r.idea.dropReason ?? '—'}</span> },
    ]
    return colPreset ? cols.map((c) => ({ ...c, hidden: !colPreset.includes(c.key) })) : cols
  }, [nav, ctx, colPreset]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyView = (v: SavedView) => {
    const next = new URLSearchParams()
    if (view === 'kanban') next.set('view', 'kanban')
    Object.entries(v.filters || {}).forEach(([k, val]) => { if (val !== undefined && val !== null && val !== '') next.set(k, String(val)) })
    setSp(next)
    setColPreset(v.columns?.length ? v.columns : null)
    toast(`View “${v.name}” applied`, 'info')
  }
  const exportAll = () => exportIdeas(filtered, ctx, `COIN_${mode === 'mine' ? 'My_Ideas' : 'Idea_Register'}_${todayIso()}`)
  const exportSelected = () => {
    const sel = rows.filter((r) => selected.has(r.id))
    exportIdeas(sel, ctx, `COIN_Ideas_selected_${todayIso()}`)
    toast(`${sel.length} idea${sel.length === 1 ? '' : 's'} exported to Excel (ideas + part-wise savings)`, 'success')
  }

  const orgWide = hasRole(me, 'head', 'finance', 'mgmt', 'admin')
  const scopeLabel = mode === 'mine'
    ? (me?.roles.includes('supplier') ? `Ideas submitted by ${ctx.suppliers.find((s) => s.code === me.supplierCode)?.name ?? 'your company'}` : 'Ideas you submitted — status, ageing and value')
    : orgWide ? 'All commodities' : (me?.commodities ?? []).map((c) => commodityName(ctx, c).split(' (')[0]).join(', ') || 'Ideas routed to you'
  const focusCommodity = params.commodity ?? (globalFilters.commodity !== 'All' ? globalFilters.commodity : me?.commodities[0])
  const focusName = focusCommodity ? commodityName(ctx, focusCommodity).split(' (')[0] : null
  const canSubmit = can(me, 'submit')

  const filteredEmpty = (
    <EmptyState icon="SearchX" title="No ideas match these filters" desc={`${rows.length} idea${rows.length === 1 ? ' is' : 's are'} in scope — remove a filter chip or clear them all.`}
      action={<div className="flex flex-wrap justify-center gap-2"><Button icon="X" onClick={clearAll}>Clear filters</Button>{globalActive && <Button variant="ghost" icon="RotateCcw" onClick={resetFilters}>Reset global filters</Button>}</div>} />
  )

  return (
    <div className="min-w-0">
      <PageHeader icon={mode === 'mine' ? 'Lightbulb' : 'Table2'} title={mode === 'mine' ? 'My Ideas' : 'Idea Register'}
        badge={<span className="text-[10px] font-bold text-muted border border-line rounded px-1.5 py-px">M2</span>}
        subtitle={<>{scopeLabel} · <span className="num">{rows.length}</span> idea{rows.length === 1 ? '' : 's'} in view</>}
        actions={
          <>
            <label className="relative w-full sm:w-[260px]">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input !h-9 !pl-8 !pr-8 text-[12.5px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, title, part code, supplier…" />
              {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink" title="Clear search"><Icon name="X" size={13} /></button>}
            </label>
            <SavedViews params={params} ctx={ctx} onApply={applyView} />
            <Segmented value={view} onChange={(k) => setParam('view', k === 'kanban' ? 'kanban' : null)} options={[{ key: 'table', label: 'Table', icon: 'Table2' }, { key: 'kanban', label: 'Kanban', icon: 'SquareKanban' }]} />
            <Button icon="FileSpreadsheet" onClick={exportAll} disabled={!filtered.length}>Export</Button>
            {canSubmit && <Button variant="primary" icon="CirclePlus" onClick={() => nav('/submit')}>Submit idea</Button>}
          </>
        } />

      {/* global filters (FY, quarter, plant, category, commodity, buyer, lever, direct / indirect) */}
      <div className="mb-5">
        <button onClick={() => setShowFilters((v) => !v)} className="sm:hidden w-full h-8 flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
          <Icon name="SlidersHorizontal" size={14} />Global filters{globalActive && <span className="h-5 px-1.5 rounded-full bg-brand-grad text-white text-[10.5px] grid place-items-center">on</span>}
          <Icon name={showFilters ? 'ChevronUp' : 'ChevronDown'} size={14} className="ml-auto text-muted" />
        </button>
        <div className={cn(!showFilters && 'hidden', 'sm:block', showFilters && 'mt-2 sm:mt-0')}>
          <FilterBar compact={mode === 'mine'} />
        </div>
      </div>

      {!ready ? (
        <div className="space-y-3">
          <Skeleton className="h-[86px] rounded-xl" />
          <Skeleton className="h-[46px] rounded-xl" />
          <Skeleton className="h-[440px] rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={mode === 'mine' ? 'Lightbulb' : 'Inbox'}
            title={mode === 'mine' ? 'No ideas yet — submit your first idea' : `No ideas yet — submit the first idea${focusName ? ` for ${focusName}` : ''}`}
            desc={globalActive ? 'The global filters may be hiding ideas — reset them or submit a new idea.' : 'Every cost-reduction idea, direct or indirect, is captured here with its value, stage and ageing.'}
            action={<div className="flex flex-wrap justify-center gap-2">{canSubmit && <Button variant="primary" icon="CirclePlus" onClick={() => nav('/submit')}>Submit idea</Button>}{globalActive && <Button icon="RotateCcw" onClick={resetFilters}>Reset global filters</Button>}</div>} />
        </Card>
      ) : (
        <>
          <RegisterSummary rows={facets.bucket} activeBucket={params.bucket} onBucket={(b) => toggle('bucket', b)} slaActive={params.sla === 'breach'} onSla={() => toggle('sla', 'breach')} />

          {/* quick filters as chips */}
          <div className="card px-3 py-2 mb-4 flex items-start gap-2">
          <div className={cn('flex-1 min-w-0 flex flex-wrap items-center gap-1 gap-y-1.5', !showFacets && 'max-h-[26px] overflow-hidden')}>
            <GroupLabel>Bucket</GroupLabel>
            {(['Pipeline', 'In Execution', 'Implemented', 'Dropped', ...(mode === 'mine' ? ['Draft'] : [])] as Bucket[]).map((b) => (
              <FacetChip key={b} label={BUCKET_STYLE[b].label} color={BUCKET_STYLE[b].color} count={cnt(facets.bucket, (r) => r.idea.bucket === b)} active={params.bucket === b} onClick={() => toggle('bucket', b)} />
            ))}
            <Sep />
            <GroupLabel>Category group</GroupLabel>
            {LEVER_GROUPS.map((g) => (
              <FacetChip key={g} label={g} icon={LEVER_GROUP_STYLE[g].icon} color={LEVER_GROUP_STYLE[g].color} count={cnt(facets.group, (r) => r.group === g)} active={params.group === g} onClick={() => toggle('group', g)} />
            ))}
            <Sep />
            <GroupLabel>Route</GroupLabel>
            {ROUTES.map((rt) => (
              <FacetChip key={rt} label={rt} icon={ROUTE_ICON[rt]} color="#334155" count={cnt(facets.route, (r) => r.idea.route === rt)} active={params.route === rt} onClick={() => toggle('route', rt)} />
            ))}
            <Sep />
            <GroupLabel>Savings</GroupLabel>
            {SAVINGS_TYPES.map((t) => (
              <FacetChip key={t} label={t} color={SAVINGS_TYPE_COLOR[t]} count={cnt(facets.savingsType, (r) => r.idea.savingsType === t)} active={params.savingsType === t} onClick={() => toggle('savingsType', t)}
                tip={t === 'Hard' ? 'Counts as hard savings' : 'Reported separately from hard savings'} />
            ))}
            <Sep />
            <FacetChip label="SLA breach" icon="Siren" color="#e0364f" count={cnt(facets.sla, (r) => r.sla.state === 'breach' || r.sla.state === 'escalated')} active={params.sla === 'breach'} onClick={() => toggle('sla', 'breach')} tip="Working days in the current stage beyond the stage SLA (Section 12)" />
            {mode === 'all' && <FacetChip label="Supplier ideas" icon="Factory" color="#0d9488" count={cnt(facets.supplierOnly, (r) => r.idea.isSupplierSubmission)} active={params.supplierOnly === 'true'} onClick={() => toggle('supplierOnly', 'true')} />}
          </div>
            <button onClick={() => setShowFacets((v) => !v)} className="shrink-0 h-[26px] px-2 rounded-md text-[12px] font-medium text-brand-700 hover:bg-brand-50 flex items-center gap-1">
              {showFacets ? 'Less' : 'More filters'}<Icon name={showFacets ? 'ChevronUp' : 'ChevronDown'} size={13} />
            </button>
          </div>

          {/* active URL params as removable chips */}
          {activeEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted flex items-center gap-1 mr-0.5"><Icon name="ListFilter" size={13} />Filtered by</span>
              {activeEntries.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full text-[12px] border border-brand-200 bg-brand-50 text-brand-800 max-w-full">
                  <span className="text-brand-600/80">{PARAM_LABEL[k] ?? k}:</span>
                  <span className="font-semibold truncate max-w-[260px]">{valueLabel(k, v, ctx)}</span>
                  <button onClick={() => setParam(k, null)} className="h-5 w-5 grid place-items-center rounded-full hover:bg-brand-100" title={`Remove ${PARAM_LABEL[k] ?? k}`}><Icon name="X" size={12} /></button>
                </span>
              ))}
              <button onClick={clearAll} className="h-7 px-2 rounded-lg text-[12px] font-semibold text-brand-700 hover:bg-brand-50">Clear all</button>
              <span className="ml-auto text-[12px] text-muted num">{filtered.length} of {rows.length} ideas · {inrShort(filteredValue)}</span>
            </div>
          )}

          {view === 'kanban' ? (
            filtered.length ? <KanbanBoard rows={filtered.filter((r) => r.idea.stage !== 'Draft')} draftCount={filtered.filter((r) => r.idea.stage === 'Draft').length} /> : <Card>{filteredEmpty}</Card>
          ) : (
            <DataTable<IdeaRow>
              key={colPreset ? colPreset.join('|') : 'default'}
              rows={filtered}
              columns={columns}
              rowKey={(r) => r.id}
              onRowClick={(r) => openIdea(r.id)}
              exportName={`COIN_${mode === 'mine' ? 'My_Ideas' : 'Idea_Register'}_${todayIso()}`}
              selectable
              selected={selected}
              onSelect={setSelected}
              maxHeight="calc(100vh - 250px)"
              empty={filteredEmpty}
              toolbar={selected.size > 0 ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-100 pl-2.5 pr-1 h-8">
                  <span className="text-[12.5px] font-semibold text-brand-800 num">{selected.size} selected</span>
                  <Button size="xs" variant="primary" icon="FileSpreadsheet" onClick={exportSelected}>Export selected</Button>
                  <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
              ) : (
                <span className="text-[12px] text-muted flex items-center gap-1.5">
                  <span className="num font-semibold text-ink-2">{inrShort(filteredValue)}</span> annualised in view
                  <span className="hidden md:inline">· click a row for the side panel, the ID for the full page</span>
                </span>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}
