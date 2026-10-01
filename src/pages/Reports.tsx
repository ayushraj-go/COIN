// MIS by workspace: in CO the report library, KPI library, monthly mailer and scheduled emails cover execution and realisation;
// in IN they cover ideas, the pipeline and the network. With no workspace chosen MIS shows both (CO first). /reports/:key renders a report.
import React, { useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs, Button, Badge, EmptyState, SkeletonGrid, useWarmup, Icon, cn } from '../components/ui'
import { FilterBar } from '../components/FilterBar'
import { useStore, useMe, hasRole } from '../store/useStore'
import { REPORTS_NOTE } from '../lib/scope'
import { monthLong, fmtDate } from '../lib/format'
import { useReportCtx } from './reports/model'
import { filterText, FREQ_STYLE, SectionNote } from './reports/chartkit'
import { runExport } from './reports/specs'
import { HomeReport, BridgeReport, CommodityReport, BuyerReport, SupplierReport, LeverReport } from './reports/views1'
import { ExecutionReport, DropsReport, AgeingReport, CampaignReport, LeakageReport, ClosureReport } from './reports/views2'
import Library, { REPORT_ICON } from './reports/Library'
import KpiLibrary from './reports/KpiLibrary'
import Mailer from './reports/Mailer'
import Scheduled from './reports/Scheduled'
import { type Space, SPACE_META, SPACE_ORDER, MIS_REPORTS, spacesOfReport, findReport, kpisOf } from './reports/space'

const VIEWS: Record<string, React.ComponentType<any>> = {
  home: HomeReport, bridge: BridgeReport, commodity: CommodityReport, buyer: BuyerReport, supplier: SupplierReport, lever: LeverReport,
  execution: ExecutionReport, drops: DropsReport, ageing: AgeingReport, campaign: CampaignReport, leakage: LeakageReport, closure: ClosureReport,
}
const REPORT_ROLES = ['buyer', 'lead', 'head', 'finance', 'mgmt', 'admin'] as const

function useFilterText() {
  const filters = useStore((s) => s.filters)
  const plants = useStore((s) => s.plants)
  const categories = useStore((s) => s.categories)
  const commodities = useStore((s) => s.commodities)
  const users = useStore((s) => s.users)
  const levers = useStore((s) => s.levers)
  return useMemo(() => filterText(filters, { plants, categories, commodities, users, levers }), [filters, plants, categories, commodities, users, levers])
}

export function SpaceChip({ space, className }: { space: Space; className?: string }) {
  const m = SPACE_META[space]
  return (
    <span title={m.name} className={cn('inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-extrabold tracking-wide border shrink-0', className)} style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>{space}</span>
  )
}

export default function Reports() {
  const { key } = useParams()
  const me = useMe()
  if (!hasRole(me, ...REPORT_ROLES)) {
    return <div className="card rounded-2xl"><EmptyState icon="Lock" title="MIS is not part of your role" desc="MIS is available to Buyers, Commodity Leads, the Sourcing Head, Finance, Management and Admin. Your home page shows your own ideas." /></div>
  }
  return key ? <ReportDetail rkey={key} /> : <ReportsHome />
}

function ReportsHome() {
  const [sp, setSp] = useSearchParams()
  const space = useStore((s) => s.space)
  const showMailer = space !== 'IN'
  const asked = sp.get('tab') ?? 'library'
  const tab = asked === 'mailer' && !showMailer ? 'library' : asked
  const setTab = (t: string) => setSp((p) => { const n = new URLSearchParams(p); n.set('tab', t); return n }, { replace: true })
  const ctx = useReportCtx()
  const ready = useWarmup(320)
  const ft = useFilterText()
  const settings = useStore((s) => s.settings)
  const emails = useStore((s) => s.emails)
  const lastSent = emails.find((e) => e.template === 'Monthly Cost Optimisation Report')
  const spaces = space ? [space] : SPACE_ORDER
  const nReports = spaces.reduce((a, s) => a + MIS_REPORTS[s].length, 0)
  const nKpis = new Set(spaces.flatMap((s) => kpisOf(s).map((k) => k.id))).size
  return (
    <div>
      <PageHeader icon="ChartColumnBig"
        title={<span className="flex items-center gap-2">MIS <span className="text-muted font-medium">·</span> <span>{space ? SPACE_META[space].name : 'All workspaces'}</span></span>}
        badge={<span className="flex items-center gap-1">{spaces.map((s) => <SpaceChip key={s} space={s} />)}</span>}
        subtitle={space ? SPACE_META[space].tagline : 'No workspace chosen yet: Cost Optimisation reports first, then Innovation Network'}
        actions={<>
          {space !== 'IN' && <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-muted"><Icon name="RefreshCw" size={13} />Last realisation run: <b className="text-ink">{monthLong(settings.lastRealisationMonth)}</b></span>}
          {space !== 'IN' && lastSent && <span className="hidden lg:inline-flex items-center gap-1.5 text-[12px] text-muted"><Icon name="MailCheck" size={13} className="text-emerald-600" />Mailer sent {fmtDate(lastSent.at.slice(0, 10))}</span>}
          {space === 'IN' && <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-muted"><Icon name="Lightbulb" size={13} /><b className="text-ink">{ctx.ideas.length}</b> ideas in scope</span>}
        </>} />
      <div className="mb-5 flex items-center gap-4">
        <FilterBar className="flex-1" />
        <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted hidden 2xl:inline pr-1.5">{ctx.ideas.length} ideas in scope</span>
      </div>
      <Tabs layoutId="reports-tabs" value={tab} onChange={setTab} className="mb-3"
        tabs={[
          { key: 'library', label: 'Report library', icon: 'LibraryBig', count: nReports },
          { key: 'kpi', label: `KPI library (${nKpis})`, icon: 'Gauge' },
          ...(showMailer ? [{ key: 'mailer', label: space ? 'Monthly mailer' : 'Monthly mailer · CO', icon: 'Mail' }] : []),
          { key: 'scheduled', label: 'Scheduled emails', icon: 'CalendarClock' },
        ]} />
      {!ready ? <SkeletonGrid rows={2} /> : (
        <>
          {tab === 'library' && <Library ctx={ctx} space={space} />}
          {tab === 'kpi' && <KpiLibrary ctx={ctx} filterText={ft} space={space} />}
          {tab === 'mailer' && showMailer && <Mailer ctx={ctx} />}
          {tab === 'scheduled' && <Scheduled today={ctx.today} space={space} onOpenMailer={() => setTab('mailer')} />}
        </>
      )}
    </div>
  )
}

function ReportDetail({ rkey }: { rkey: string }) {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const space = useStore((s) => s.space)
  const setSpace = useStore((s) => s.setSpace)
  const month = sp.get('month') ?? undefined
  const viewParam = sp.get('view')
  const spaces = spacesOfReport(rkey)
  // Which workspace's view to show: an explicit ?view=, else the current workspace, else the report's own (CO first)
  const eff: Space | undefined = (viewParam === 'CO' || viewParam === 'IN') && spaces.includes(viewParam) ? viewParam : space && spaces.includes(space) ? space : spaces[0]
  const def = eff ? findReport(rkey, eff) : undefined
  const ctx = useReportCtx()
  const ready = useWarmup(300)
  const ft = useFilterText()
  const toast = useStore((s) => s.toast)
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }) }, [rkey, eff])
  if (!def || !eff) return <div className="card rounded-2xl"><EmptyState icon="FileQuestion" title="Report not found" desc="Pick a report from the MIS library." action={<Button variant="primary" icon="LibraryBig" onClick={() => nav('/reports')}>Open report library</Button>} /></div>
  const View = VIEWS[def.key]
  const foreign = !!space && eff !== space
  const list = MIS_REPORTS[eff]
  const href = (key: string) => `/reports/${key}${foreign || !space ? `?view=${eff}` : ''}`
  const idx = list.indexOf(def)
  const prev = list[(idx + list.length - 1) % list.length], next = list[(idx + 1) % list.length]
  const doExport = (kind: 'pdf' | 'excel') => {
    try { runExport(kind, def, ctx, ft); toast(`${def.name} exported to ${kind === 'pdf' ? 'PDF' : 'Excel'} with the active filters`, 'success') }
    catch (e) { toast(`Export failed: ${(e as Error).message}`, 'error') }
  }
  const switchTo = () => { setSpace(eff); nav(`/reports/${def.key}${month ? `?month=${month}` : ''}`) }
  const ownView = space && spaces.includes(space) ? findReport(rkey, space) : undefined
  return (
    <div>
      <PageHeader icon={REPORT_ICON[def.key]} title={<span className="flex items-center gap-2"><span className="text-muted font-semibold">{def.n}.</span>{def.name}</span>}
        badge={<span className="flex items-center gap-1.5"><SpaceChip space={eff} /><Badge color={FREQ_STYLE[def.frequency] ?? '#64748b'} dot>{def.frequency}</Badge></span>}
        subtitle={<>MIS · {SPACE_META[eff].name} · <Icon name="Users" size={12} className="inline -mt-0.5 mr-1" />{def.audience} · {def.visuals}</>}
        actions={<>
          <Button size="sm" variant="ghost" icon="ArrowLeft" onClick={() => nav('/reports')}>Library</Button>
          <Button size="sm" icon="FileSpreadsheet" onClick={() => doExport('excel')}>Excel</Button>
          <Button size="sm" variant="primary" icon="FileText" onClick={() => doExport('pdf')}>PDF</Button>
        </>} />
      {foreign && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <Icon name="ArrowLeftRight" size={14} className="shrink-0" />
          <span className="min-w-0">This {ownView ? 'view' : 'report'} belongs to <b>{SPACE_META[eff].name}</b>; you are in {SPACE_META[space!].name}.</span>
          <span className="ml-auto flex items-center gap-2">
            {ownView && <button className="font-semibold underline-offset-2 hover:underline" onClick={() => nav(`/reports/${def.key}`)}>Open the {SPACE_META[space!].name} view</button>}
            <Button size="xs" icon="ArrowLeftRight" onClick={switchTo}>Switch to {SPACE_META[eff].name}</Button>
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-1">
        {list.map((r) => (
          <button key={r.key} onClick={() => nav(href(r.key))} className={cn('shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-semibold border transition', r.key === def.key ? 'bg-slate-800 text-white border-transparent' : 'bg-white text-ink-2 border-line hover:border-slate-300 hover:text-ink')}>
            <span className={cn('text-[10.5px] font-extrabold', r.key === def.key ? 'text-white/70' : 'text-gold-600')}>{r.n}</span>{r.name}
          </button>
        ))}
      </div>
      <div className="mb-5 flex items-center gap-4">
        <FilterBar className="flex-1" />
        {month && <span className="shrink-0"><Badge color="#bf8f3f" icon="CalendarDays">Month: {monthLong(month)}</Badge></span>}
        <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted hidden 2xl:inline pr-1.5">{ctx.ideas.length} ideas in scope · exports use these filters</span>
      </div>
      {!ready ? <SkeletonGrid rows={2} /> : <View ctx={ctx} month={month} space={eff} />}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SectionNote icon="MousePointerClick">{REPORTS_NOTE}</SectionNote>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" icon="ChevronLeft" onClick={() => nav(href(prev.key))}>{prev.n}. {prev.name}</Button>
          <Button size="sm" variant="ghost" iconRight="ChevronRight" onClick={() => nav(href(next.key))}>{next.n}. {next.name}</Button>
        </div>
      </div>
    </div>
  )
}
