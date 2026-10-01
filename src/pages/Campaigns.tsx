// Campaigns workspace — supplier email campaigns (dashboard + New campaign wizard), workshops & commodity drives,
// Supplier Portal responses and email templates. Suppliers never log into COIN; they reply through the Supplier Portal.
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import type { Campaign } from '../lib/types'
import { useMe, useStore } from '../store/useStore'
import { can } from '../lib/nav'
import { daysBetween, fmtDate, inrShort, sum, timeAgo, todayIso } from '../lib/format'
import { Button, EmptyState, Icon, IconButton, Money, SkeletonGrid, Tooltip, cn, useWarmup } from '../components/ui'
import { AttendanceBar, CampaignFormModal, campaignStats, copyText, dateRange, launchWithToast, submissionLink, YTick } from './campaign/shared'
import { EmailTemplatesTab, SupplierResponsesTab, useOutreachCounts } from './campaign/Outreach'
import { CampaignDashboard, NewCampaignWizard } from './campaign/Workspace'
import { KpiStrip, LineTabs, Pager, Panel, Pill, PortalIndicator, Seg, usePaged } from './campaign/kit'

type StatusFilter = 'All' | Campaign['status']
type PageTab = 'dashboard' | 'workshops' | 'responses' | 'templates'
const PAGE_TABS: PageTab[] = ['dashboard', 'workshops', 'responses', 'templates']
/** Old links: ?tab=campaigns → workshops, ?tab=outreach → dashboard */
const LEGACY: Record<string, PageTab> = { campaigns: 'workshops', outreach: 'dashboard' }

export default function Campaigns() {
  const me = useMe()
  const campaigns = useStore((s) => s.campaigns)
  const syncPortal = useStore((s) => s.syncSupplierPortal)
  const toast = useStore((s) => s.toast)
  const ready = useWarmup()
  const canManage = can(me, 'campaign')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') ?? ''
  const tab: PageTab = PAGE_TABS.includes(raw as PageTab) ? (raw as PageTab) : LEGACY[raw] ?? 'dashboard'
  const setTab = (t: string) => setParams((p) => { const n = new URLSearchParams(p); if (t === 'dashboard') n.delete('tab'); else n.set('tab', t); return n }, { replace: true })
  const oc = useOutreachCounts()
  const [wizard, setWizard] = useState<{ open: boolean; templateId?: string; n: number }>({ open: raw === 'outreach' && canManage, n: 0 })
  const openWizard = (templateId?: string) => setWizard((w) => ({ open: true, templateId, n: w.n + 1 }))
  const sync = () => { syncPortal(); toast('Supplier Portal synced — no new responses', 'info') }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.015em] text-ink">Campaigns</h1>
          <p className="text-[12.5px] text-muted mt-0.5">Email a commodity’s suppliers, collect their ideas from the Supplier Portal and take the best ones to NPD.</p>
        </div>
        <div className="flex items-center gap-2">
          <PortalIndicator onSync={sync} />
          {canManage && <Button variant="primary" icon="Plus" onClick={() => openWizard()}>New campaign</Button>}
        </div>
      </div>

      <LineTabs value={tab} onChange={setTab} tabs={[
        { key: 'dashboard', label: 'Dashboard', count: oc.batches },
        { key: 'responses', label: 'Supplier responses', count: oc.newResponses ? oc.newResponses : undefined },
        { key: 'templates', label: 'Email templates', count: oc.templates },
        { key: 'workshops', label: 'Workshops & drives', count: campaigns.length },
      ]} />

      {!ready ? <SkeletonGrid rows={2} /> : <>
        {tab === 'dashboard' && <CampaignDashboard onNew={() => openWizard()} onOpenResponses={() => setTab('responses')} onOpenWorkshops={() => setTab('workshops')} />}
        {tab === 'workshops' && <WorkshopsTab />}
        {tab === 'responses' && <SupplierResponsesTab />}
        {tab === 'templates' && <EmailTemplatesTab onUse={(id) => openWizard(id)} />}
      </>}

      {wizard.open && <NewCampaignWizard key={wizard.n} open={wizard.open} initialTemplateId={wizard.templateId} onClose={() => setWizard((w) => ({ ...w, open: false }))} />}
    </div>
  )
}

/** Workshops & commodity drives (Campaign records) — live yield, conversion, attendance, auto-invites */
function WorkshopsTab() {
  const me = useMe()
  const nav = useNavigate()
  const campaigns = useStore((s) => s.campaigns)
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const categories = useStore((s) => s.categories)
  const emails = useStore((s) => s.emails)
  const [status, setStatus] = useState<StatusFilter>('All')
  const [type, setType] = useState<'All' | Campaign['type']>('All')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'recent' | 'value' | 'end'>('recent')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const canManage = can(me, 'campaign')

  const rows = useMemo(() => campaigns.map((c) => ({ c, s: campaignStats(c, ideas) })), [campaigns, ideas])
  const totals = useMemo(() => {
    const all = rows.flatMap((r) => r.s.list)
    const implemented = all.filter((i) => i.bucket === 'Implemented').length
    return {
      live: rows.filter((r) => r.c.status === 'Live').length,
      liveWorkshops: rows.filter((r) => r.c.status === 'Live' && r.c.type === 'Workshop').length,
      drafts: rows.filter((r) => r.c.status === 'Draft').length,
      ideas: all.length,
      value: sum(rows.map((r) => r.s.value)),
      conversion: all.length ? (implemented / all.length) * 100 : 0, implemented,
      supplierIdeas: all.filter((i) => i.isSupplierSubmission).length,
    }
  }, [rows])

  const counts = { All: rows.length, Live: rows.filter((r) => r.c.status === 'Live').length, Draft: rows.filter((r) => r.c.status === 'Draft').length, Closed: rows.filter((r) => r.c.status === 'Closed').length }
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    const out = rows.filter(({ c }) => (status === 'All' || c.status === status) && (type === 'All' || c.type === type) &&
      (!k || c.name.toLowerCase().includes(k) || c.id.toLowerCase().includes(k) || c.commodity.toLowerCase().includes(k) || (commodities.find((x) => x.code === c.commodity)?.name.toLowerCase().includes(k) ?? false)))
    const rank = { Live: 0, Draft: 1, Closed: 2 }
    return out.sort((a, b) => (sort === 'value' ? b.s.value - a.s.value : sort === 'end' ? a.c.endDate.localeCompare(b.c.endDate) : rank[a.c.status] - rank[b.c.status] || b.c.startDate.localeCompare(a.c.startDate)))
  }, [rows, status, type, q, sort, commodities])
  const pg = usePaged(filtered, 6, page)

  const chartData = useMemo(() => rows.filter((r) => r.c.status !== 'Draft').map((r) => ({ id: r.c.id, name: r.c.name, value: r.s.value, ideas: r.s.count })).sort((a, b) => b.value - a.value).slice(0, 6), [rows])
  const upcoming = rows.filter((r) => r.c.workshopDate && r.c.workshopDate >= todayIso() && r.c.status !== 'Closed').sort((a, b) => a.c.workshopDate!.localeCompare(b.c.workshopDate!)).slice(0, 4)
  const inviteLog = emails.filter((e) => e.template === 'Workshop invitation').slice(0, 4)
  const reset = () => setPage(0)

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip items={[
        { label: 'Live drives & workshops', value: totals.live, sub: `${totals.liveWorkshops} workshop${totals.liveWorkshops === 1 ? '' : 's'} · ${totals.drafts} draft${totals.drafts === 1 ? '' : 's'}` },
        { label: 'Ideas yielded', value: totals.ideas, sub: `${totals.supplierIdeas} from suppliers` },
        { label: '₹ value yielded', value: <Money value={totals.value} />, sub: 'annualised, excl. dropped' },
        { label: 'Conversion', value: `${totals.conversion.toFixed(1)}%`, sub: `${totals.implemented} implemented of ${totals.ideas}` },
      ]} />

      <div className="flex flex-wrap items-center gap-2">
        <Seg<StatusFilter> value={status} onChange={(k) => { setStatus(k); reset() }} options={(['All', 'Live', 'Draft', 'Closed'] as StatusFilter[]).map((k) => ({ key: k, label: k, count: counts[k] }))} />
        <Seg<'All' | Campaign['type']> value={type} onChange={(k) => { setType(k); reset() }} options={[{ key: 'All', label: 'All types' }, { key: 'Campaign', label: 'Drives' }, { key: 'Workshop', label: 'Workshops' }]} />
        <div className="relative ml-auto w-60">
          <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !h-8 !pl-8 !text-[12.5px]" value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="Search name, ID or commodity" />
        </div>
        <select className="input !h-8 !w-auto !text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort">
          <option value="recent">Status, newest</option>
          <option value="value">₹ value yielded</option>
          <option value="end">End date</option>
        </select>
        {canManage && <Button size="sm" icon="Plus" onClick={() => setCreateOpen(true)}>New workshop / drive</Button>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-8 min-w-0 flex flex-col gap-3">
          {pg.slice.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pg.slice.map(({ c, s }) => {
                const cm = commodities.find((x) => x.code === c.commodity)
                const cat = categories.find((x) => x.id === c.categoryId)
                const daysLeft = daysBetween(todayIso(), c.endDate)
                return (
                  <div key={c.id} role="button" tabIndex={0} onClick={() => nav(`/campaigns/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/campaigns/${c.id}`)}
                    className="card p-4 cursor-pointer hover:border-slate-300 transition-colors flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <Pill icon={c.type === 'Workshop' ? 'Presentation' : 'Megaphone'}>{c.type === 'Workshop' ? 'Workshop' : 'Drive'}</Pill>
                      {c.status === 'Live' ? <Pill tone="live" dot>Live</Pill> : c.status === 'Draft' ? <Pill tone="muted">Draft</Pill> : <Pill tone="muted" icon="Lock">Closed</Pill>}
                      <span className="ml-auto text-[11px] font-mono text-muted">{c.id}</span>
                    </div>
                    <div className="mt-2 text-[13.5px] font-semibold text-ink leading-snug truncate">{c.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted truncate">{cm?.name ?? c.commodity} · {cat?.name} · {dateRange(c.startDate, c.endDate)}</div>
                    {c.workshopDate && <div className="text-[11.5px] text-muted truncate">{fmtDate(c.workshopDate)}{c.venue ? ` · ${c.venue}` : ''}</div>}

                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11.5px]">
                      <div><div className="text-muted">Ideas</div><div className="text-[14px] font-semibold text-ink num">{s.count}</div></div>
                      <div><div className="text-muted">₹ value</div><div className="text-[14px] font-semibold text-ink num"><Money value={s.value} /></div></div>
                      <div><div className="text-muted">Conversion</div><div className="text-[14px] font-semibold text-ink num">{s.conversion.toFixed(0)}%</div></div>
                      <div><div className="text-muted">Attendance</div><div className="text-[14px] font-semibold text-ink num">{c.status === 'Draft' ? '—' : `${s.att.Accepted + s.att.Attended}/${c.suppliers.length}`}</div></div>
                    </div>
                    {c.status !== 'Draft' && <div className="mt-2"><AttendanceBar att={s.att} total={c.suppliers.length} /></div>}

                    <div className="mt-3 pt-2.5 border-t border-line flex items-center gap-2 min-h-[32px]" onClick={(e) => e.stopPropagation()}>
                      {c.status === 'Draft' ? (
                        canManage ? <Button size="xs" variant="primary" icon="Send" onClick={() => launchWithToast(c.id)}>Launch &amp; send invites</Button> : <span className="text-[12px] text-muted">Awaiting launch</span>
                      ) : c.status === 'Live' ? (
                        <>
                          <span className={cn('text-[12px]', daysLeft <= 7 ? 'text-amber-700 font-medium' : 'text-muted')}>{daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Past end date'}</span>
                          <Tooltip content="Copy submission link"><IconButton icon="Link2" onClick={() => copyText(submissionLink(c.id), 'Submission link')} /></Tooltip>
                        </>
                      ) : (
                        <span className="text-[12px] text-muted truncate">{c.summary ? 'Post-workshop summary recorded' : 'Closed · summary pending'}</span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-ink-2">Open<Icon name="ChevronRight" size={13} /></span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card"><EmptyState icon="Megaphone" title="No workshops or drives match" desc={canManage ? 'Clear the filters, or create one for a commodity and invite its suppliers.' : 'Clear the filters to see all.'}
              action={canManage ? <Button variant="primary" icon="Plus" onClick={() => setCreateOpen(true)}>New workshop / drive</Button> : <Button onClick={() => { setStatus('All'); setType('All'); setQ('') }}>Clear filters</Button>} /></div>
          )}
          <Pager {...pg} onPage={setPage} noun="workshops & drives" />
        </div>

        <div className="xl:col-span-4 flex flex-col gap-4 min-w-0">
          <Panel title="Yield by drive" sub="annualised ₹ · click a bar">
            {chartData.length ? (
              <div style={{ height: Math.max(140, chartData.length * 32 + 24) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
                    <CartesianGrid horizontal={false} stroke="#eef1f5" />
                    <XAxis type="number" tickFormatter={(v) => inrShort(v, 0)} tick={{ fontSize: 11, fill: '#66758f' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={<YTick max={20} />} axisLine={false} tickLine={false} />
                    <RTooltip cursor={{ fill: 'rgb(15 27 51 / .04)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as (typeof chartData)[number]
                      return (
                        <div className="rounded-lg bg-white border border-line shadow-lg px-3 py-2 text-[12px]">
                          <div className="font-semibold text-ink mb-1 max-w-[240px]">{d.name}</div>
                          <div className="flex justify-between gap-4"><span className="text-muted">Yielded</span><b className="num">{inrShort(d.value)}</b></div>
                          <div className="flex justify-between gap-4"><span className="text-muted">Ideas</span><b className="num">{d.ideas}</b></div>
                        </div>
                      )
                    }} />
                    <Bar dataKey="value" fill="#5e93fb" radius={[0, 3, 3, 0]} maxBarSize={14} cursor="pointer" onClick={(d: any) => nav(`/ideas?campaign=${d.id}`)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState icon="ChartBar" title="No launched drives yet" desc="Yield appears once a drive is live and ideas are submitted." />}
          </Panel>

          <Panel title="Upcoming workshops" sub="reminder 2 days before" pad={false}>
            {upcoming.length ? upcoming.map(({ c, s }) => {
              const d = daysBetween(todayIso(), c.workshopDate!)
              return (
                <button key={c.id} onClick={() => nav(`/campaigns/${c.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-line first:border-t-0 text-left hover:bg-slate-50">
                  <span className="h-9 w-9 rounded-lg border border-line grid place-items-center shrink-0 leading-none text-center">
                    <span><span className="block text-[13px] font-semibold text-ink">{c.workshopDate!.slice(8, 10)}</span><span className="block text-[10px] text-muted">{fmtDate(c.workshopDate).slice(3, 6)}</span></span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-ink truncate">{c.name}</span>
                    <span className="block text-[11.5px] text-muted truncate">{c.venue ?? 'Venue to be confirmed'} · {s.att.Accepted + s.att.Attended}/{c.suppliers.length} accepted</span>
                  </span>
                  <span className={cn('text-[11.5px] shrink-0', d <= 2 ? 'text-amber-700 font-medium' : 'text-muted')}>{d === 0 ? 'today' : `in ${d}d`}</span>
                </button>
              )
            }) : <div className="px-4 py-4 text-[12.5px] text-muted">No workshop scheduled.</div>}
          </Panel>

          <Panel title="Invite email log" sub="auto-invites sent on launch" pad={false}>
            {inviteLog.length ? inviteLog.map((e) => (
              <div key={e.id} className="px-4 py-2 border-t border-line first:border-t-0">
                <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-medium text-ink truncate">{e.subject.replace('COIN · Invitation: ', '')}</span><span className="text-[11px] text-muted shrink-0">{timeAgo(e.at)}</span></div>
                <div className="text-[11.5px] text-muted truncate">To {e.to.join(', ')}</div>
              </div>
            )) : <div className="px-4 py-4 text-[12.5px] text-muted">No invites sent yet.</div>}
          </Panel>
        </div>
      </div>

      <CampaignFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(id) => nav(`/campaigns/${id}`)} />
    </div>
  )
}
