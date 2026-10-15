// Dashboard body for IN and CO — where ideas come from:
// Internal ideas (by commodity, by department, by individual) vs External ideas (suppliers: Tier 1, Tier 2, via campaigns).
// IN values = annualised impact; CO values = MRN-realised savings (with committed alongside).
import { useMemo, useState } from 'react'
import type { Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { ideaAnnualised, ideaCommitted } from '../../lib/calc'
import { sourceBreakdown, type Seg } from '../../lib/workflow'
import { inrShort, pct, sum } from '../../lib/format'
import { Avatar, Badge, Card, Icon, InfoTip, Segmented, cn } from '../../components/ui'
import { DrillModal, useDrill } from './shared'

type Tab = 'commodity' | 'department' | 'individual'
const NAVY = '#1b316f', RED = '#d7192d'

export function SourcesCard({ ideas, mode, fy, className }: { ideas: Idea[]; mode: 'IN' | 'CO'; fy: string; className?: string }) {
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const users = useStore((s) => s.users)
  const ledger = useStore((s) => s.ledger)
  const drill = useDrill()
  const [tab, setTab] = useState<Tab>('commodity')
  const [modal, setModal] = useState<{ title: string; ids: string[] } | null>(null)
  const realisedBy = useMemo(() => { const m = new Map<string, number>(); ledger.forEach((l) => m.set(l.ideaId, (m.get(l.ideaId) ?? 0) + l.realised)); return m }, [ledger])
  const value = (i: Idea) => (mode === 'IN' ? ideaAnnualised(i) : realisedBy.get(i.id) ?? 0)
  const committed = (ids: string[]) => sum(ids.map((id) => { const i = ideas.find((x) => x.id === id); return i ? ideaCommitted(i, fy) : 0 }))
  const s = useMemo(() => sourceBreakdown(ideas, suppliers, value), [ideas, suppliers, mode, realisedBy]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = s.internal.value + s.external.value || 1
  const unit = mode === 'IN' ? 'annualised' : 'realised (MRN)'
  const bucketParam = mode === 'CO' ? { bucket: 'In Execution,Implemented' } : {}
  const segs: Seg[] = tab === 'commodity' ? s.internal.byCommodity : tab === 'department' ? s.internal.byDepartment : s.internal.byIndividual
  const maxSeg = Math.max(1, ...segs.map((x) => (mode === 'IN' ? x.value : x.value || x.count)))
  const label = (x: Seg) => (tab === 'commodity' ? commodities.find((c) => c.code === x.key)?.name ?? x.key : x.label)
  const drillSeg = (x: Seg) => drill({ ...bucketParam, ...(tab === 'commodity' ? { commodity: x.key } : tab === 'department' ? { dept: x.key } : { submitter: x.key }), supplierOnly: 'false' })
  const extSuppliers = useMemo(() => {
    const m = new Map<string, { code: string; n: number; v: number }>()
    ideas.filter((i) => i.isSupplierSubmission).forEach((i) => { const k = i.supplierCode ?? '—'; const r = m.get(k) ?? { code: k, n: 0, v: 0 }; r.n++; r.v += value(i); m.set(k, r) })
    return [...m.values()].sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 4)
  }, [ideas, mode, realisedBy]) // eslint-disable-line react-hooks/exhaustive-deps
  const supName = (code: string) => suppliers.find((x) => x.code === code)?.name ?? code
  const tierOf = (code: string) => suppliers.find((x) => x.code === code)?.tier ?? 'Tier 2'

  const Head = ({ icon, color, title, tip, count, val }: { icon: string; color: string; title: string; tip: string; count: number; val: number }) => (
    <div className="flex items-start gap-3">
      <span className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: color }}><Icon name={icon} size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink">{title}<InfoTip title={title}>{tip}</InfoTip></div>
        <div className="text-[12px] text-muted"><b className="text-ink-2 num">{count}</b> ideas · <b className="text-ink-2 num">{inrShort(val)}</b> {unit} · {pct((val / total) * 100, 0)} of total</div>
      </div>
    </div>
  )

  return (
    <div className={cn('grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4', className)}>
      <Card className="h-full" bodyClass="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Head icon="Building2" color={NAVY} title="Internal ideas" tip="Ideas raised inside Amber — by commodity team, by department and by individual employee." count={s.internal.count} val={s.internal.value} />
          <Segmented size="sm" value={tab} onChange={(k) => setTab(k as Tab)} options={[{ key: 'commodity', label: 'By commodity' }, { key: 'department', label: 'By department' }, { key: 'individual', label: 'By individual' }]} />
        </div>
        <div className="flex flex-col gap-1">
          {segs.slice(0, 7).map((x) => {
            const u = tab === 'individual' ? users.find((y) => y.id === x.key) : undefined
            const w = ((mode === 'IN' ? x.value : x.value || x.count) / maxSeg) * 100
            return (
              <button key={x.key} onClick={() => drillSeg(x)} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-slate-50">
                <span className="flex items-center gap-2 min-w-0">
                  {u ? <Avatar name={u.name} color={u.avatarColor} size={22} /> : <span className="h-[22px] w-[22px] rounded-md grid place-items-center text-[9.5px] font-bold shrink-0 bg-brand-50 text-brand-700">{tab === 'commodity' ? x.key : x.key.slice(0, 2).toUpperCase()}</span>}
                  <span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{label(x)}</span>
                  {u && <span className="text-[11px] text-muted truncate">{u.department}</span>}
                </span>
                <span className="text-right text-[12px] num whitespace-nowrap"><b className="text-ink">{inrShort(x.value)}</b><span className="text-muted"> · {x.count}</span></span>
                <span className="col-span-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, w)}%`, background: `linear-gradient(90deg, ${NAVY}, #2f4a9a)` }} /></span>
              </button>
            )
          })}
          {!segs.length && <div className="text-[12.5px] text-muted py-6 text-center">No internal ideas in this scope.</div>}
          {segs.length > 7 && <div className="text-[11.5px] text-muted px-2">+ {segs.length - 7} more · click a row to open the ideas</div>}
        </div>
      </Card>

      <Card className="h-full" bodyClass="flex flex-col gap-3">
        <Head icon="Factory" color={RED} title="External ideas" tip="Ideas submitted by suppliers — split by supplier tier, plus how many came in through supplier campaigns and workshops." count={s.external.count} val={s.external.value} />
        <div className="grid grid-cols-2 gap-2.5">
          {[s.external.tier1, s.external.tier2].map((t, k) => (
            <button key={t.key} onClick={() => setModal({ title: `External ideas — ${t.label}`, ids: t.ids })} className="text-left rounded-xl border border-line bg-white px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition">
              <div className="flex items-center justify-between gap-2"><Badge color={k === 0 ? NAVY : '#64748b'}>{t.key}</Badge><span className="text-[11px] text-muted">{pct(s.external.count ? (t.count / s.external.count) * 100 : 0, 0)}</span></div>
              <div className="mt-1.5 text-[20px] font-bold num text-ink leading-tight">{t.count}<span className="text-[12px] font-medium text-muted"> ideas</span></div>
              <div className="text-[12px] text-muted num">{inrShort(t.value)} {unit}{mode === 'CO' ? ` · ${inrShort(committed(t.ids))} committed` : ''}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setModal({ title: 'Supplier ideas via campaigns & workshops', ids: s.external.viaCampaign.ids })} className="flex items-center gap-3 rounded-xl border border-accent-200 bg-accent-50/60 px-3 py-2.5 text-left hover:shadow-sm transition">
          <span className="h-9 w-9 rounded-lg grid place-items-center text-white shrink-0 bg-red-grad"><Icon name="Megaphone" size={16} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">Supplier ideas via campaigns & workshops</span><span className="block text-[11.5px] text-muted">{pct(s.external.count ? (s.external.viaCampaign.count / s.external.count) * 100 : 0, 0)} of supplier ideas came through a campaign</span></span>
          <span className="text-right"><span className="block text-[18px] font-bold num text-ink leading-tight">{s.external.viaCampaign.count}</span><span className="block text-[11px] text-muted num">{inrShort(s.external.viaCampaign.value)}</span></span>
        </button>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-1">Top suppliers</div>
          {extSuppliers.map((x) => (
            <button key={x.code} onClick={() => drill({ ...bucketParam, supplier: x.code, supplierOnly: 'true' })} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-slate-50">
              <span className="text-[12.5px] font-semibold text-ink truncate flex-1">{supName(x.code)}</span>
              <Badge color={tierOf(x.code) === 'Tier 1' ? NAVY : '#64748b'}>{tierOf(x.code)}</Badge>
              <span className="text-[12px] num text-muted w-[92px] text-right"><b className="text-ink">{inrShort(x.v)}</b> · {x.n}</span>
            </button>
          ))}
          {!extSuppliers.length && <div className="text-[12.5px] text-muted py-3">No supplier ideas in this scope.</div>}
        </div>
      </Card>

      <DrillModal open={!!modal} onClose={() => setModal(null)} title={modal?.title ?? ''} ideas={ideas.filter((i) => modal?.ids.includes(i.id))} valueFn={value} valueLabel={mode === 'IN' ? 'Annualised' : 'Realised (MRN)'} />
    </div>
  )
}
