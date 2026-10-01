// Scope & Methodology — every constant of the Scope of Work (src/lib/scope.ts) rendered as a navigable reference
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useStore, useMe } from '../store/useStore'
import type { LeverGroup, RouteKey } from '../lib/types'
import {
  APPROVAL_MATRIX_DOC, APPROVAL_NOTE, ASSUMPTIONS, CAMPAIGN_FLOW, CAMPAIGN_POINTS, CREDIBILITY_RULES, DASHBOARDS, DASHBOARDS_INTRO, DECISIONS, DEFINITIONS, DOC_META, DROP_REASONS_DEFAULT,
  EXECUTION_INTRO, EXECUTION_RECORD, EXECUTION_SCREEN, FORM_BEHAVIOUR, FORM_FIELDS, FORM_INTRO, FORM_LAYOUT, FORMULAS,
  INTEGRATION_FALLBACK, INTEGRATION_INTRO, INTEGRATIONS, KPI_INTRO, KPIS, LEAKAGE_NOTE, LEVER_FOOTNOTE, LEVER_INTRO, LEVER_SPLIT_NOTE, MAILER, METHOD_INTRO,
  MODULES, MODULES_INTRO, NAV_BY_ROLE, NAV_NOTE, NFRS, NOTIF_FOOTNOTE, NOTIF_INTRO, NOTIF_TRIGGERS, OBJECTIVES, OUT_OF_SCOPE, PERM_COLS, PERMISSION_MATRIX,
  PROBLEM_INTRO, PROBLEMS, PURPOSE, REALISATION_CYCLE, REALISATION_DEMO_NOTE, REALISATION_IN_APP, REMINDERS_ON_SCREEN, REPORTS, REPORTS_INTRO, REPORTS_NOTE, ROLES, ROLES_INTRO,
  ROUTES_TABLE, SAVINGS_CLASS_NOTE, SAVINGS_TYPES, SLA_DEFAULTS, STRUCTURAL_NOTE, UI_COLOURS, UI_INTERACTIVITY, UI_INTRO, UI_LAYOUT, UI_PRINCIPLES, UI_RESPONSIVE,
  WORKED_EXAMPLE, WORKSPACE_NOTE, WORKSPACES, NPD_CONTENTS, NPD_INTRO, NPD_USE, type DocSpace,
} from '../lib/scope'
import { NPD_COMMODITIES } from '../lib/npd'
import { LEVER_GROUP_STYLE, ROUTE_STAGES, LAKH } from '../lib/masters'
import { BUCKET_STYLE, bucketFor, carryOver, committedInFy, fyMonthsFrom, phaseByQuarter } from '../lib/calc'
import { addMonthsYm, fmtDate, fyLabel, inr, inrPrice, inrShort, lakhLabel, num, pct, thirdWorkingDay } from '../lib/format'
import { primaryRole, ROLE_LABEL } from '../lib/nav'
import { Badge, Button, Field, Icon, InfoTip, PageHeader, ProgressBar, Segmented, cn, useWarmup, Skeleton } from '../components/ui'

// ─── Section registry (table of contents) ─────────────────────────────────────
// Each section belongs to CO, IN or Both. Order: shared sections, then CO, then IN, then shared reference.
type View = 'CO' | 'IN' | 'All'
const SECTIONS: { id: string; title: string; icon: string; space: DocSpace }[] = [
  { id: 'doc', title: 'Document', icon: 'FileText', space: 'Both' },
  { id: 's1', title: 'Purpose and background', icon: 'Compass', space: 'Both' },
  { id: 's2', title: 'Problem statement and objectives', icon: 'Crosshair', space: 'Both' },
  { id: 's3', title: 'Users and roles', icon: 'UsersRound', space: 'Both' },
  { id: 's4', title: 'Definitions and savings methodology', icon: 'Calculator', space: 'Both' },
  { id: 's8', title: 'Workspaces and modules', icon: 'LayoutDashboard', space: 'Both' },
  { id: 's9', title: 'Execution Hub and savings realisation', icon: 'Rocket', space: 'CO' },
  { id: 'snpd', title: 'NPD development master', icon: 'FlaskConical', space: 'CO' },
  { id: 's5', title: 'Idea category master', icon: 'Layers', space: 'IN' },
  { id: 's6', title: 'Routes and approval', icon: 'Route', space: 'IN' },
  { id: 's7', title: 'Idea submission form', icon: 'FilePen', space: 'IN' },
  { id: 'scamp', title: 'Supplier campaigns', icon: 'Megaphone', space: 'IN' },
  { id: 's10', title: 'Sourcing KPIs', icon: 'Gauge', space: 'Both' },
  { id: 's11', title: 'Dashboards, MIS and monthly mailer', icon: 'ChartColumnBig', space: 'Both' },
  { id: 's12', title: 'Emails, reminders and escalations', icon: 'MailCheck', space: 'Both' },
  { id: 's13', title: 'Integrations', icon: 'Plug', space: 'Both' },
  { id: 's14', title: 'UI/UX and interaction principles', icon: 'Palette', space: 'Both' },
  { id: 's15', title: 'Non-functional requirements', icon: 'ShieldCheck', space: 'Both' },
  { id: 's16', title: 'Out of scope, assumptions and decisions to confirm', icon: 'ListChecks', space: 'Both' },
]
const inView = (view: View, space: DocSpace | string) => view === 'All' || space === 'Both' || space === view
/** Section numbers for the current view (sections hidden in this view are absent) */
const NumCtx = createContext<Record<string, string>>({})
const SPACE_TAG: Record<DocSpace, { label: string; color: string }> = { CO: { label: 'CO', color: '#0f9f8a' }, IN: { label: 'IN', color: '#2459e0' }, Both: { label: 'CO · IN', color: '#64748b' } }
const VIEW_LABEL: Record<View, string> = { CO: 'Cost Optimisation (CO)', IN: 'Innovation Network (IN)', All: 'both workspaces (CO and IN)' }
// KPI groups and reports by workspace (CO first in every listing)
const KPI_GROUP_SPACE: Record<string, DocSpace> = { A: 'Both', B: 'IN', C: 'Both', D: 'CO', E: 'Both', F: 'IN' }
const REPORT_SPACE: Record<string, DocSpace> = { home: 'Both', bridge: 'Both', commodity: 'Both', buyer: 'Both', supplier: 'IN', lever: 'Both', execution: 'CO', drops: 'Both', ageing: 'IN', campaign: 'IN', leakage: 'CO', closure: 'CO' }
const SLA_SPACE = (stage: string): DocSpace => (stage === 'Finance validation' ? 'CO' : 'IN')
const coFirst = <T,>(rows: T[], sp: (r: T) => DocSpace) => [...rows].sort((a, b) => ({ Both: 0, CO: 1, IN: 2 }[sp(a)] - { Both: 0, CO: 1, IN: 2 }[sp(b)]))

// ─── Typographic primitives ───────────────────────────────────────────────────
function Section({ id, children, intro }: { id: string; children: React.ReactNode; intro?: React.ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!
  const nums = useContext(NumCtx)
  if (!(id in nums)) return null
  const tag = SPACE_TAG[s.space]
  return (
    <section id={id} data-scope-section className="card scroll-mt-4 p-5 md:p-6 shadow-[0_1px_2px_rgb(15_23_42/.04),0_12px_32px_-24px_rgb(36_89_224/.35)]">
      <header className="flex items-start gap-3 mb-3">
        <span className="h-9 min-w-9 px-2 rounded-xl grid place-items-center bg-brand-50 text-brand-700 border border-brand-100 shrink-0 font-extrabold text-[14px] num">
          {nums[id] || <Icon name={s.icon} size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] leading-tight font-bold tracking-tight text-ink flex flex-wrap items-center gap-2">{s.title}<span className="text-[10.5px] font-bold tracking-wide rounded-md px-1.5 py-0.5 border" style={{ color: tag.color, borderColor: `${tag.color}40`, background: `${tag.color}0d` }}>{tag.label}</span></h2>
          {intro && <p className="text-[13.5px] leading-relaxed text-ink-2 mt-1.5 max-w-[980px]">{intro}</p>}
        </div>
      </header>
      <div className="space-y-5 min-w-0 [&_.grid>*]:min-w-0">{children}</div>
    </section>
  )
}
function Sub({ title, children, icon, aside }: { title: React.ReactNode; children: React.ReactNode; icon?: string; aside?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
          {icon ? <Icon name={icon} size={14} className="text-brand-600" /> : <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}{title}
        </h3>
        {aside}
      </div>
      {children}
    </div>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-ink-2 max-w-[980px]">{children}</p>
}
function Bullets({ items, numbered, cols }: { items: React.ReactNode[]; numbered?: boolean; cols?: boolean }) {
  return (
    <ol className={cn('grid gap-1.5', cols && 'md:grid-cols-2 md:gap-x-6')}>
      {items.map((t, k) => (
        <li key={k} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
          {numbered
            ? <span className="h-5 min-w-5 px-1 mt-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-ink-2 grid place-items-center num shrink-0">{k + 1}</span>
            : <span className="h-1.5 w-1.5 mt-2 rounded-full bg-brand-400 shrink-0" />}
          <span>{t}</span>
        </li>
      ))}
    </ol>
  )
}
function Callout({ tone = 'info', icon, children, title }: { tone?: 'info' | 'danger' | 'gold' | 'success'; icon?: string; children: React.ReactNode; title?: string }) {
  const s = { info: ['#eff6ff', '#bfdbfe', '#1d4ed8', 'Info'], danger: ['#fef2f2', '#fecaca', '#b91c1c', 'TriangleAlert'], gold: ['#fbf5ea', '#e9d3a6', '#7a5a22', 'Lightbulb'], success: ['#f0fdf4', '#bbf7d0', '#0b7a55', 'CircleCheck'] }[tone]
  return (
    <div className="rounded-xl border px-3.5 py-2.5 flex gap-2.5 text-[13px] leading-relaxed" style={{ background: s[0], borderColor: s[1], color: s[2] }}>
      <Icon name={icon ?? s[3]} size={16} className="mt-0.5 shrink-0" />
      <div>{title && <div className="font-semibold mb-0.5">{title}</div>}<div className="text-ink-2">{children}</div></div>
    </div>
  )
}
/** Wrapping document table (the app's .tbl is nowrap for data grids) */
function DocTable({ head, rows, widths, dense, rowClass }: { head: React.ReactNode[]; rows: React.ReactNode[][]; widths?: (string | undefined)[]; dense?: boolean; rowClass?: (k: number) => string | undefined }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>{head.map((h, k) => <th key={k} style={{ width: widths?.[k] }} className="text-left align-bottom bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted px-3 py-2 border-b border-line whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className={cn('hover:bg-slate-50/70 transition-colors', rowClass?.(k))}>
              {r.map((c, j) => <td key={j} className={cn('align-top px-3 border-b border-slate-100 text-ink-2 leading-relaxed', dense ? 'py-1.5' : 'py-2.5', j === 0 && 'font-semibold text-ink')}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const Mark = ({ v }: { v: string }) => {
  if (v === '✓') return <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200"><Icon name="Check" size={13} strokeWidth={3} /></span>
  if (v === '—') return <span className="text-slate-300 font-bold">—</span>
  if (v.startsWith('✓')) return <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold whitespace-nowrap"><Icon name="Check" size={11} strokeWidth={3} />{v.slice(1).trim()}</span>
  return <span className="inline-flex items-center h-6 px-2 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-[11px] font-semibold whitespace-nowrap">{v}</span>
}

// ─── Section 4 interactive calculator (worked example) ────────────────────────
function SavingsCalculator() {
  const currentFy = useStore((s) => s.settings.currentFy)
  const DEFAULT = { baseline: 4.2, newPrice: 3.85, volume: 2400000, goLive: '2026-10-01', fy: 'FY27' }
  const [v, setV] = useState(DEFAULT)
  const set = (k: keyof typeof DEFAULT, val: any) => setV((x) => ({ ...x, [k]: val }))
  const perUnit = v.baseline - v.newPrice
  const annual = perUnit * v.volume
  const months = v.goLive ? fyMonthsFrom(v.goLive, v.fy) : 0
  const committed = v.goLive ? committedInFy(annual, v.goLive, v.fy) : 0
  const carry = v.goLive ? carryOver(annual, v.goLive, v.fy) : 0
  const phases = v.goLive ? phaseByQuarter(annual, v.goLive, v.fy) : { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  const L = (n: number) => (Math.abs(n) >= 1e7 ? inrShort(n) : lakhLabel(n))
  const neg = perUnit < 0
  const isDefault = JSON.stringify(v) === JSON.stringify(DEFAULT)
  const maxQ = Math.max(1, ...Object.values(phases).map(Math.abs))
  const out: { label: string; value: string; sub: string; color: string; tip: string }[] = [
    { label: 'Saving per unit', value: inrPrice(perUnit), sub: `${pct(v.baseline ? (perUnit / v.baseline) * 100 : 0, 2)} of baseline`, color: neg ? '#e0364f' : '#0b7a55', tip: 'P(baseline) − P(new)' },
    { label: 'Annualised impact', value: L(annual), sub: inr(annual), color: neg ? '#e0364f' : '#0f172a', tip: '(P(baseline) − P(new)) × Q(last FY MRN)' },
    { label: `Committed in ${v.fy}`, value: L(committed), sub: `${months.toFixed(months % 1 ? 2 : 0)} of 12 months live`, color: '#c2410c', tip: 'Annualised × months live in the FY ÷ 12, phased by quarter from go-live' },
    { label: 'Carry-over to next FY', value: L(carry), sub: 'Falls beyond 31 March', color: '#475569', tip: 'Annualised impact − committed saving in the FY' },
  ]
  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/60 via-white to-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg grid place-items-center bg-white border border-brand-100 text-brand-600 shadow-sm"><Icon name="Calculator" size={16} /></span>
          <div><div className="text-[13.5px] font-semibold text-ink">Savings calculator — worked example</div><div className="text-[11.5px] text-muted">Live, using the same functions that value every idea in COIN (lib/calc)</div></div>
        </div>
        <Button size="sm" variant="ghost" icon="RotateCcw" disabled={isDefault} onClick={() => setV(DEFAULT)}>Reset to worked example</Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="grid grid-cols-2 gap-2.5 content-start">
          <Field label="Baseline price / unit (₹)" hint="LBP · else PO price · else quoted"><input className="input num" type="number" step="0.01" value={v.baseline} onChange={(e) => set('baseline', +e.target.value)} /></Field>
          <Field label="New price / unit (₹)" hint="Estimated at submission"><input className={cn('input num', neg && '!border-red-300 !text-red-600')} type="number" step="0.01" value={v.newPrice} onChange={(e) => set('newPrice', +e.target.value)} /></Field>
          <Field label="Annual volume (last FY MRN)" hint={`${num(v.volume)} units`}><input className="input num" type="number" step="1000" value={v.volume} onChange={(e) => set('volume', Math.max(0, +e.target.value))} /></Field>
          <Field label="Go-live (effective) date" hint={v.goLive ? fmtDate(v.goLive) : '—'}><input className="input" type="date" value={v.goLive} onChange={(e) => set('goLive', e.target.value)} /></Field>
          <Field label="Financial year" hint={fyLabel(v.fy)}>
            <select className="input" value={v.fy} onChange={(e) => set('fy', e.target.value)}>
              {[...new Set(['FY26', 'FY27', 'FY28', currentFy])].sort().map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {out.map((o) => (
              <div key={o.label} className="rounded-xl bg-white border border-line p-3 shadow-[0_1px_2px_rgb(15_23_42/.04)]">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{o.label}<InfoTip title={o.label} formula={o.tip} /></div>
                <motion.div key={o.value} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-[20px] leading-tight font-extrabold tracking-tight mt-1 num" style={{ color: o.color }}>{o.value}</motion.div>
                <div className="text-[11px] text-muted mt-0.5 num">{o.sub}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white border border-line p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted mb-2"><span>Quarter phasing in {v.fy}</span><span className="normal-case font-medium">Committed <b className="text-ink num">{L(committed)}</b> of <b className="text-ink num">{L(annual)}</b></span></div>
            <div className="grid grid-cols-4 gap-2">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <div key={q}>
                  <div className="h-16 rounded-lg bg-slate-50 border border-slate-100 flex items-end overflow-hidden">
                    <motion.div className="w-full rounded-t-md" style={{ background: 'linear-gradient(180deg, #fb923c, #ec8a1c)' }} initial={{ height: 0 }} animate={{ height: `${(Math.abs(phases[q]) / maxQ) * 100}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <div className="text-[11px] font-semibold text-ink-2 mt-1">{q}</div>
                  <div className="text-[11px] text-muted num">{phases[q] ? L(phases[q]) : '—'}</div>
                </div>
              ))}
            </div>
          </div>
          {neg && <Callout tone="danger" icon="TrendingDown">The new price is above the baseline — a negative saving, shown in red as on the submission form.</Callout>}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Scope() {
  const ready = useWarmup(260)
  const me = useMe()
  const nav = useNavigate()
  const { levers, settings, slaRules, dropReasons } = useStore()
  const space = useStore((s) => s.space)
  // document filter only — does not change the workspace; ?view=co|in|all deep-links a view
  const [params, setParams] = useSearchParams()
  const urlView = params.get('view')?.toUpperCase()
  const view: View = urlView === 'CO' || urlView === 'IN' ? urlView : urlView === 'ALL' ? 'All' : space ?? 'All'
  const setView = (v: View) => setParams((p) => { const n = new URLSearchParams(p); n.set('view', v.toLowerCase()); return n }, { replace: true })
  const firstSpace = useRef(true)
  useEffect(() => { if (firstSpace.current) { firstSpace.current = false; return } setParams((p) => { const n = new URLSearchParams(p); n.delete('view'); return n }, { replace: true }) }, [space]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = SECTIONS.filter((x) => inView(view, x.space))
  const nums = useMemo(() => { const m: Record<string, string> = {}; let n = 0; shown.forEach((x) => { m[x.id] = x.id === 'doc' ? '' : String(++n) }); return m }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  const iv = (sp: DocSpace | string) => inView(view, sp)
  const [active, setActive] = useState('doc')
  const [progress, setProgress] = useState(0)
  const lock = useRef(0)

  // scroll-spy on the shell's scrolling <main>
  useEffect(() => {
    if (!ready) return
    const main = document.querySelector('main') as HTMLElement | null
    const scroller: HTMLElement | Window = main ?? window
    const onScroll = () => {
      const top = main ? main.getBoundingClientRect().top : 0
      const els = [...document.querySelectorAll<HTMLElement>('[data-scope-section]')]
      let cur = els[0]?.id ?? 'doc'
      for (const el of els) if (el.getBoundingClientRect().top - top <= 120) cur = el.id
      if (main && main.scrollTop + main.clientHeight >= main.scrollHeight - 4) cur = els[els.length - 1]?.id ?? cur
      if (Date.now() > lock.current) setActive(cur)
      if (main) setProgress(Math.min(100, (main.scrollTop / Math.max(1, main.scrollHeight - main.clientHeight)) * 100))
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [ready, view])
  const go = (id: string) => {
    setActive(id)
    lock.current = Date.now() + 700
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const myCol = me ? ['submitter', 'supplier', 'buyer', 'techeval', 'lead', 'head', 'finance', 'mgmt', 'admin'].indexOf(primaryRole(me)) : -1
  // KPI groups keep their A–F order, with IN-only groups (B, F) after the CO and shared ones
  const kpiGroups = [...new Set(KPIS.map((k) => k.group))].sort((a, b) => Number(KPI_GROUP_SPACE[a[0]] === 'IN') - Number(KPI_GROUP_SPACE[b[0]] === 'IN') || a.localeCompare(b)).filter((g) => iv(KPI_GROUP_SPACE[g[0]] ?? 'Both'))
  const kpiShown = KPIS.filter((k) => kpiGroups.includes(k.group)).length
  const leverGroups = Object.keys(LEVER_GROUP_STYLE) as LeverGroup[]
  const nextRun = thirdWorkingDay(addMonthsYm(settings.lastRealisationMonth, 2))
  const stats: [string, number][] = [['roles', ROLES.length], ['categories', levers.length], ['routes', ROUTES_TABLE.length], ['form fields', FORM_FIELDS.length], ['modules', MODULES.length], ['NPD codes', NPD_COMMODITIES.length], ['KPIs', KPIS.length], ['reports', REPORTS.length], ['email triggers', NOTIF_TRIGGERS.length], ['stage SLAs', SLA_DEFAULTS.length], ['integrations', INTEGRATIONS.length], ['NFRs', NFRS.length], ['decisions', DECISIONS.length]]
  const swatch: Record<string, string> = { Pipeline: BUCKET_STYLE.Pipeline.color, 'In Execution': BUCKET_STYLE['In Execution'].color, Implemented: BUCKET_STYLE.Implemented.color, Dropped: BUCKET_STYLE.Dropped.color, 'Overdue / leakage / negative saving': '#e0364f' }
  const slaChanged = SLA_DEFAULTS.some((d) => { const r = slaRules.find((x) => x.stage === d.stage); return !r || r.slaDays !== d.slaDays || r.reminderDay !== d.reminderDay || r.escalateDay !== d.escalateDay || r.escalateTo !== d.escalateTo })
  const dropChanged = JSON.stringify(dropReasons) !== JSON.stringify(DROP_REASONS_DEFAULT)
  const decisionNow: Record<number, React.ReactNode> = {
    1: <Badge color="#64748b">Route: To be confirmed</Badge>,
    2: <Badge color={settings.financeValidation ? '#0f9f6e' : '#64748b'} icon={settings.financeValidation ? 'ShieldCheck' : 'ShieldOff'}>{settings.financeValidation ? 'On' : 'Off'}</Badge>,
    4: <Badge color="#2459e0">X = ₹ {settings.xThresholdLakh} lakh</Badge>,
    9: <Badge color={settings.leaderboardVisible ? '#0f9f6e' : '#64748b'}>{settings.leaderboardVisible ? 'Visible · top 10 per quarter' : 'Hidden'}</Badge>,
    10: <Badge color={slaChanged ? '#ec8a1c' : '#0f9f6e'}>{slaChanged ? 'Customised in Admin' : 'As proposed'}</Badge>,
  }

  if (!ready) {
    return (
      <div className="grid lg:grid-cols-[252px_1fr] gap-4">
        <Skeleton className="hidden lg:block h-[520px] rounded-xl" />
        <div className="space-y-3"><Skeleton className="h-10 w-80" /><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon="BookOpenText" title="Scope & Methodology" subtitle={`Describes ${VIEW_LABEL[view]} · ${DOC_META.date} · ${DOC_META.author}`}
        badge={<Badge color="#bf8f3f" icon="FileBadge">{DOC_META.version} · {DOC_META.status}</Badge>}
        actions={<><span className="no-print"><Segmented size="sm" value={view} onChange={(k) => { setView(k as View); setActive('doc') }} options={[{ key: 'CO', label: 'CO' }, { key: 'IN', label: 'IN' }, { key: 'All', label: 'All' }]} /></span><Button icon="Printer" onClick={() => window.print()}>Print</Button><Button variant="primary" icon="LayoutDashboard" onClick={() => nav('/')}>Open dashboard</Button></>} />

      <div className="grid lg:grid-cols-[252px_minmax(0,1fr)] gap-4 items-start">
        {/* Table of contents with scroll-spy */}
        <aside className="hidden lg:block sticky top-0 no-print">
          <nav className="card p-2 shadow-[0_12px_32px_-24px_rgb(36_89_224/.45)]">
            <div className="px-2 pt-1.5 pb-2">
              <div className="text-[10.5px] font-bold uppercase tracking-[.12em] text-muted">Contents</div>
              <ProgressBar value={progress} height={3} color="#2459e0" className="mt-2" />
            </div>
            {shown.map((s) => {
              const on = active === s.id
              return (
                <button key={s.id} onClick={() => go(s.id)} className={cn('relative w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left text-[12.5px] leading-snug transition-colors', on ? 'text-brand-800 font-semibold' : 'text-ink-2 hover:bg-slate-50 hover:text-ink')}>
                  {on && <motion.span layoutId="scope-toc" className="absolute inset-0 rounded-lg bg-brand-50 border border-brand-100" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
                  <span className={cn('relative w-5 shrink-0 text-right text-[11px] font-bold num mt-px', on ? 'text-brand-600' : 'text-muted')}>{nums[s.id] || '·'}</span>
                  <span className="relative">{s.title}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <NumCtx.Provider value={nums}>
        <div className="min-w-0 space-y-3">
          {/* mobile jump */}
          <div className="lg:hidden card p-2 flex items-center gap-2 sticky top-0 z-10 no-print">
            <Icon name="ListTree" size={15} className="text-brand-600 shrink-0" />
            <select className="input !h-9" value={active} onChange={(e) => go(e.target.value)}>
              {shown.map((s) => <option key={s.id} value={s.id}>{nums[s.id] ? `${nums[s.id]}. ` : ''}{s.title}</option>)}
            </select>
          </div>

          {/* Document */}
          <section id="doc" data-scope-section className="card scroll-mt-4 relative overflow-hidden p-5 md:p-6">
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #2459e0, #6d9bff 55%, #bf8f3f)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(600px 260px at 100% 0%, rgb(36 89 224 / .07), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgb(184 137 63 / .08), transparent 60%)' }} />
            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] [&>*]:min-w-0">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-brand-700">Scope of Work</div>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink mt-1.5">{DOC_META.title}</h2>
                <div className="text-[13px] text-muted mt-1.5">{DOC_META.date} · {DOC_META.author} · this view describes <b className="text-ink-2">{VIEW_LABEL[view]}</b></div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {stats.map(([k, n]) => <span key={k} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white border border-line text-[12px] text-ink-2 shadow-sm"><b className="text-ink num">{n}</b>{k}</span>)}
                </div>
              </div>
              <DocTable head={['Item', 'Detail']} rows={DOC_META.table.map(([a, b]) => [a, b])} widths={['38%']} dense />
            </div>
          </section>

          {/* 1 */}
          <Section id="s1">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-2.5">{PURPOSE.map((p, k) => <P key={k}>{p}</P>)}</div>
              <div className="grid grid-cols-2 gap-2.5 content-start">
                {WORKSPACES.map((w) => (
                  <div key={w.code} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-center gap-2"><span className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${w.color}14`, color: w.color }}><Icon name={w.icon} size={16} /></span><span className="text-[20px] font-extrabold tracking-tight" style={{ color: w.color }}>{w.code}</span></div>
                    <div className="text-[12.5px] font-semibold text-ink mt-2">{w.name}</div>
                    <div className="text-[12px] font-medium text-ink-2 leading-snug mt-0.5">{w.covers}</div>
                    <div className="text-[11.5px] text-muted leading-snug mt-1">{w.pages}</div>
                  </div>
                ))}
              </div>
            </div>
            <Callout tone="info" icon="LayoutPanelLeft" title="Two workspaces">{WORKSPACE_NOTE}</Callout>
          </Section>

          {/* 2 */}
          <Section id="s2" intro={PROBLEM_INTRO}>
            <Sub title="Objectives" icon="Flag"><Bullets items={OBJECTIVES} numbered cols /></Sub>
            <Sub title="Problem today → how COIN solves it" icon="Wrench">
              <DocTable head={['Problem today', 'Business impact', 'How COIN solves it']} widths={['32%', '28%']} rows={PROBLEMS.map((p) => [p.problem, <span className="text-red-700/90">{p.impact}</span>, <span className="flex gap-1.5"><Icon name="CircleCheck" size={14} className="text-emerald-600 mt-0.5 shrink-0" />{p.solution}</span>])} />
            </Sub>
          </Section>

          {/* 3 */}
          <Section id="s3" intro={ROLES_INTRO}>
            <DocTable head={['Role', 'Who at Amber', 'Primary job in COIN', 'Data visibility']} widths={['17%', '28%', '33%']}
              rows={ROLES.map((r) => [<span className="flex items-center gap-2">{r.role}{me?.roles.includes(r.key as any) && <Badge color="#2459e0">You</Badge>}</span>, r.who, r.job, <Badge color="#475569">{r.visibility}</Badge>])} />
            <Sub title="Permission matrix (✓ = allowed, — = not allowed)" icon="KeyRound" aside={me && <span className="text-[11.5px] text-muted">Your column: <b className="text-brand-700">{ROLE_LABEL[primaryRole(me)]}</b></span>}>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="text-left bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted px-3 py-2 border-b border-line">Action</th>
                      {PERM_COLS.map((c, k) => <th key={c} className={cn('text-center text-[11px] font-semibold uppercase tracking-wide px-2 py-2 border-b border-line whitespace-nowrap', k === myCol ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-muted')}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MATRIX.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-ink">{row.action}</td>
                        {row.cells.map((c, k) => <td key={k} className={cn('text-center px-2 py-2 border-b border-slate-100', k === myCol && 'bg-brand-50/50')}><Mark v={c} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sub>
          </Section>

          {/* 4 */}
          <Section id="s4" intro={METHOD_INTRO}>
            <div className="grid gap-4 xl:grid-cols-2">
              <Sub title="Definitions" icon="BookMarked"><DocTable head={['Term', 'Definition']} widths={['30%']} rows={DEFINITIONS.map(([t, d]) => [t, d])} dense /></Sub>
              <div className="space-y-4">
                <Sub title="Formulas" icon="Sigma">
                  <div className="grid gap-2">
                    {FORMULAS.map((f) => (
                      <div key={f.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
                        <span className="text-[12.5px] font-semibold text-ink">{f.name}</span>
                        <code className="font-mono text-[12.5px] text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-1">{f.name} = {f.expr}</code>
                      </div>
                    ))}
                  </div>
                </Sub>
                <Sub title="Savings classification" icon="Tags">
                  <div className="text-[12px] text-muted mb-2">{SAVINGS_CLASS_NOTE}</div>
                  <DocTable head={['Classification', 'Examples', 'Counts as hard savings']} dense rows={SAVINGS_TYPES.map((s) => [s.type, s.examples, s.counts === 'Yes' ? <Badge color="#0f9f6e" icon="Check">Yes</Badge> : <Badge color="#64748b">{s.counts}</Badge>])} />
                </Sub>
              </div>
            </div>
            <Sub title="Worked example" icon="Lightbulb">
              <Callout tone="gold" icon="Quote">{WORKED_EXAMPLE}</Callout>
              <div className="mt-3"><SavingsCalculator /></div>
            </Sub>
            <Sub title="Credibility rules" icon="ShieldCheck" aside={<Badge color={settings.financeValidation ? '#0f9f6e' : '#64748b'} icon={settings.financeValidation ? 'ShieldCheck' : 'ShieldOff'}>Finance validation {settings.financeValidation ? 'on' : 'off'} in this build</Badge>}>
              <Bullets items={CREDIBILITY_RULES} cols />
            </Sub>
          </Section>

          {/* 8 */}
          <Section id="s8" intro={MODULES_INTRO}>
            <DocTable head={['#', 'Module', 'Workspace', 'Key screens', 'Scope', '']} widths={['5%', '15%', '11%', '15%', undefined, '8%']} dense
              rows={MODULES.filter((m) => iv(m.tag)).map((m) => [
                <span className="font-extrabold text-brand-700 num">{m.id}</span>, m.name, <span className="text-[12px]">{m.space}</span>, m.screens, m.scope,
                <Button size="xs" variant="outline" iconRight="ArrowUpRight" onClick={() => nav(m.path.includes(':') ? '/ideas' : m.path)}>Open</Button>,
              ])} />
            <div>
              <Sub title="Navigation by role" icon="PanelLeft">
                <DocTable head={view === 'All' ? ['Role', 'CO workspace', 'IN workspace'] : ['Role', `${view} workspace`]} widths={view === 'All' ? ['30%', '35%'] : ['30%']} dense rows={NAV_BY_ROLE.map((r) => (view === 'All' ? [r.role, r.coNav, r.inNav] : [r.role, view === 'CO' ? r.coNav : r.inNav]))} />
                <div className="text-[12px] text-muted mt-2">{NAV_NOTE}</div>
              </Sub>
            </div>
          </Section>

          {/* 9 */}
          <Section id="s9" intro={EXECUTION_INTRO}>
            <div className="grid gap-4 xl:grid-cols-2">
              <Sub title="Execution record per idea" icon="ClipboardList"><DocTable head={['Field', 'Rule']} widths={['28%']} dense rows={EXECUTION_RECORD.map(([a, b]) => [a, b])} /></Sub>
              <div className="space-y-4">
                <Sub title="Execution Hub screen" icon="MonitorCog"><Bullets items={EXECUTION_SCREEN} /></Sub>
                <Sub title="Drop reason codes (configurable)" icon="CircleSlash" aside={dropChanged ? <Badge color="#ec8a1c">{dropReasons.length} configured in Admin</Badge> : undefined}>
                  <div className="flex flex-wrap gap-1.5">{DROP_REASONS_DEFAULT.map((r) => <span key={r} className="inline-flex items-center h-7 px-2.5 rounded-full bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-700">{r}</span>)}</div>
                </Sub>
              </div>
            </div>
            <Sub title="Realisation cycle (monthly)" icon="RefreshCw" aside={<Badge color="#0f9f6e" icon="CalendarClock">Next run {fmtDate(nextRun)}</Badge>}>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {REALISATION_CYCLE.map((s, k) => (
                  <div key={k} className="relative rounded-xl border border-line bg-white p-3 pl-11">
                    <span className="absolute left-3 top-3 h-6 w-6 rounded-full grid place-items-center bg-brand-grad text-white text-[11px] font-bold num">{k + 1}</span>
                    <p className="text-[12.5px] leading-relaxed text-ink-2">{s}</p>
                  </div>
                ))}
              </div>
            </Sub>
            <Sub title="Where realisation shows in the app" icon="MapPinned">
              <Bullets items={REALISATION_IN_APP} cols />
              <div className="mt-2"><Callout tone="gold" icon="Info">{REALISATION_DEMO_NOTE}</Callout></div>
            </Sub>
            <Callout tone="danger" icon="TriangleAlert" title="Price leakage">{LEAKAGE_NOTE}</Callout>
          </Section>

          {/* npd */}
          <Section id="snpd" intro={NPD_INTRO}>
            <div className="grid gap-4 xl:grid-cols-2">
              <Sub title="What the master holds" icon="Database"><DocTable head={['Item', 'Content']} widths={['26%']} dense rows={NPD_CONTENTS.map(([a, b]) => [a, b])} /></Sub>
              <Sub title="How COIN uses it" icon="TestTubes" aside={<Button size="xs" variant="outline" iconRight="ArrowUpRight" onClick={() => nav('/npd')}>Open NPD master</Button>}><Bullets items={NPD_USE} /></Sub>
            </div>
          </Section>

          {/* 5 */}
          <Section id="s5" intro={LEVER_INTRO}>
            <div className="flex flex-wrap gap-1.5">
              {leverGroups.map((g) => {
                const st = LEVER_GROUP_STYLE[g]
                return <span key={g} className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-lg text-[12px] font-semibold" style={{ background: st.soft, color: st.text }}><span className="h-5 w-5 rounded-md grid place-items-center text-white" style={{ background: st.color }}><Icon name={st.icon} size={11} /></span>{g}<span className="opacity-70 num">{levers.filter((l) => l.group === g).length}</span></span>
              })}
            </div>
            <DocTable head={['Group', 'Category', 'Default classification', 'Route', 'Technical evaluator', 'NPD sample']} widths={['16%', '26%']} dense
              rowClass={(k) => (levers[k] && !levers[k].active ? 'opacity-50' : undefined)}
              rows={levers.map((l) => {
                const st = LEVER_GROUP_STYLE[l.group]
                return [
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: st.text }}><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{l.group}</span>,
                  <span className="inline-flex items-center gap-2"><span className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background: st.soft, color: st.color }}><Icon name={l.icon} size={13} /></span><span>{l.name}</span><span className="text-[10.5px] font-mono text-muted">{l.id}</span>{!l.active && <Badge color="#64748b">Inactive</Badge>}</span>,
                  l.savingsType, l.route, l.evaluator, l.npdSample,
                ]
              })} />
            <div className="grid gap-2 md:grid-cols-2">
              <Callout tone="info" icon="Layers">{LEVER_FOOTNOTE}</Callout>
              <Callout tone="gold" icon="Split">{LEVER_SPLIT_NOTE}</Callout>
            </div>
          </Section>

          {/* 6 */}
          <Section id="s6">
            <div className="grid gap-2.5">
              {ROUTES_TABLE.map((r) => {
                const stages = r.stages.split(' → ')
                const routeLevers = levers.filter((l) => l.route === r.route)
                return (
                  <div key={r.route} className="rounded-xl border border-line bg-white p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Icon name="Route" size={15} className="text-brand-600" /><span className="text-[14px] font-bold text-ink">{r.route}</span><span className="text-[11.5px] text-muted">{stages.length} stages</span></div>
                      <div className="flex flex-wrap gap-1">{routeLevers.map((l) => <span key={l.id} className="text-[11px] font-semibold rounded-md px-1.5 py-0.5" style={{ background: LEVER_GROUP_STYLE[l.group].soft, color: LEVER_GROUP_STYLE[l.group].text }}>{l.name}</span>)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {stages.map((s, k) => {
                        const b = BUCKET_STYLE[bucketFor(r.route as RouteKey, ROUTE_STAGES[r.route as RouteKey]?.[k] ?? s)]
                        return (
                          <React.Fragment key={s}>
                            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold border" style={{ background: b.soft, color: b.text, borderColor: `${b.color}33` }}><span className="text-[10px] opacity-70 num">{k + 1}</span>{s}</span>
                            {k < stages.length - 1 && <Icon name="ArrowRight" size={13} className="text-slate-300" />}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="max-w-[760px]">
              <Sub title="Approval matrix (configurable)" icon="Stamp">
                <DocTable head={['Annualised impact', 'Approver', 'Current setting']} dense
                  rows={APPROVAL_MATRIX_DOC.map(([a, b], k) => [a, b, <Badge color="#2459e0">{k === 0 ? `≤ ₹ ${settings.xThresholdLakh} lakh` : `> ₹ ${settings.xThresholdLakh} lakh`}</Badge>])} />
                <div className="mt-2"><Callout tone="gold" icon="Info">{APPROVAL_NOTE} This build uses X = ₹ {settings.xThresholdLakh} lakh ({inrShort(settings.xThresholdLakh * LAKH)}), editable in Admin & Masters.</Callout></div>
              </Sub>
            </div>
          </Section>

          {/* 7 */}
          <Section id="s7" intro={FORM_INTRO}>
            <Callout tone="info" icon="PanelsTopLeft">{FORM_LAYOUT}</Callout>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(FORM_FIELDS.map((f) => f.card))].map((c) => <Badge key={c} color="#2459e0">{c} · {FORM_FIELDS.filter((f) => f.card === c).length}</Badge>)}
              <Badge color="#bf8f3f" icon="WandSparkles">{FORM_FIELDS.filter((f) => /Auto|Calculated/.test(f.type)).length} auto-filled or calculated</Badge>
            </div>
            <DocTable head={['#', 'Step', 'Field', 'Type', 'Req.', 'Source / behaviour']} widths={['4%', '14%', '20%', '13%', '10%']} dense
              rows={FORM_FIELDS.map((f) => [
                <span className="num text-muted">{f.n}</span>, <span className="text-[11.5px] font-semibold text-brand-700">{f.card}</span>, <span className="font-semibold text-ink">{f.field}</span>,
                <span className="text-[12px]">{f.type}</span>, f.req === 'Yes' ? <Badge color="#e0364f">Yes</Badge> : f.req === 'No' ? <span className="text-muted">No</span> : <span className="text-[12px]">{f.req}</span>, f.source,
              ])} />
            <Sub title="Interactive behaviour" icon="MousePointerClick"><Bullets items={FORM_BEHAVIOUR} /></Sub>
          </Section>

          {/* campaigns */}
          <Section id="scamp" intro="Supplier campaigns (module M7) bring suppliers into the idea network commodity by commodity.">
              <div className="flex flex-wrap items-stretch gap-1.5 mb-3">
                {CAMPAIGN_FLOW.map((f, k) => (
                  <React.Fragment key={f.step}>
                    <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-2.5 py-2 min-w-0 max-w-[220px]">
                      <span className="h-6 w-6 rounded-lg grid place-items-center bg-white border border-brand-100 text-brand-600 shrink-0"><Icon name={f.icon} size={13} /></span>
                      <span className="min-w-0"><span className="block text-[12px] font-semibold text-ink leading-tight">{f.step}</span><span className="block text-[11px] text-muted leading-snug">{f.detail}</span></span>
                    </div>
                    {k < CAMPAIGN_FLOW.length - 1 && <Icon name="ArrowRight" size={13} className="text-slate-300 self-center" />}
                  </React.Fragment>
                ))}
              </div>
              <Bullets items={CAMPAIGN_POINTS} />
          </Section>

          {/* 10 */}
          <Section id="s10" intro={view === 'All' ? KPI_INTRO : `${KPI_INTRO} This view shows the ${kpiShown} KPIs that apply to ${view}.`}>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-separate border-spacing-0 text-[12.5px]">
                <thead><tr>{['#', 'KPI', 'Formula / definition', 'Cut by'].map((h) => <th key={h} className="text-left bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted px-3 py-2 border-b border-line">{h}</th>)}</tr></thead>
                <tbody>
                  {kpiGroups.map((g) => (
                    <React.Fragment key={g}>
                      <tr><td colSpan={4} className="px-3 py-1.5 bg-brand-50/60 border-b border-brand-100 text-[11.5px] font-bold uppercase tracking-wide text-brand-800">{g} <span className="font-medium normal-case text-muted">· {KPIS.filter((k) => k.group === g).length} KPIs</span></td></tr>
                      {KPIS.filter((k) => k.group === g).map((k) => (
                        <tr key={k.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-[11.5px] text-muted w-[6%]">{k.id}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-semibold text-ink w-[24%]">{k.kpi}</td>
                          <td className="px-3 py-2 border-b border-slate-100 text-ink-2"><code className="font-mono text-[12px] text-brand-800">{k.formula}</code></td>
                          <td className="px-3 py-2 border-b border-slate-100 text-ink-2 w-[20%]">{k.cut}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout tone="gold" icon="Sprout" title="Structural savings share">{STRUCTURAL_NOTE}</Callout>
          </Section>

          {/* 11 */}
          <Section id="s11" intro={DASHBOARDS_INTRO}>
            <Sub title="Dashboards" icon="LayoutDashboard">
              <DocTable head={['Workspace', 'View', 'Who', 'What it shows']} widths={['10%', '15%', '22%']} dense
                rows={DASHBOARDS.filter((d) => d.space === 'Entry' || iv(d.space)).map((d) => [<Badge color={d.space === 'CO' ? '#0f9f8a' : d.space === 'IN' ? '#2459e0' : '#475569'}>{d.space}</Badge>, <span className="font-semibold text-ink">{d.view}</span>, <span className="text-[12px]">{d.who}</span>, d.contents])} />
            </Sub>
            <P>{REPORTS_INTRO}</P>
            <DocTable head={['#', 'Report', 'Audience', 'Key visuals', 'Frequency', '']} widths={['4%', '19%', '17%', undefined, '11%', '8%']} dense
              rows={coFirst(REPORTS.filter((r) => iv(REPORT_SPACE[r.key] ?? 'Both')), (r) => REPORT_SPACE[r.key] ?? 'Both').map((r) => [<span className="num text-muted">{r.n}</span>, r.name, r.audience, r.visuals, <Badge color="#475569">{r.frequency}</Badge>,
                <Button size="xs" variant="outline" iconRight="ArrowUpRight" onClick={() => nav(r.key === 'home' ? '/' : `/reports/${r.key}`)}>Open</Button>])} />
            <Callout tone="info" icon="MousePointerClick">{REPORTS_NOTE}</Callout>
            {iv('CO') && <Sub title="Monthly management mailer" icon="Mail" aside={<span className="text-[11.5px] text-muted">{settings.mailerRecipients.length} recipients configured</span>}>
              <DocTable head={['Element', 'Content']} widths={['18%']} dense rows={[...MAILER.map(([a, b]) => [a, b] as React.ReactNode[]), ['Configured list', <span className="flex flex-wrap gap-1">{settings.mailerRecipients.map((m) => <span key={m} className="font-mono text-[11.5px] bg-slate-100 rounded px-1.5 py-0.5">{m}</span>)}</span>]]} />
            </Sub>}
          </Section>

          {/* 12 */}
          <Section id="s12" intro={NOTIF_INTRO}>
            <Sub title="Emails sent by COIN" icon="Mail">
              <DocTable head={['Email', 'Recipient', 'Channel', 'When']} widths={['24%', '24%', '22%']} dense
                rows={NOTIF_TRIGGERS.filter((t) => iv(t.space)).map((t) => [t.trigger, t.recipient, <Badge color="#2459e0" icon="Mail">{t.channel}</Badge>, t.timing])} />
            </Sub>
            <Sub title="Reminders and escalations on screen" icon="AlarmClock"><Bullets items={REMINDERS_ON_SCREEN.filter((r) => iv(r.space)).map((r) => r.text)} /></Sub>
            <Sub title="Stage SLAs (defaults, configurable)" icon="Timer" aside={slaChanged ? <Badge color="#ec8a1c">Customised in Admin</Badge> : <Badge color="#0f9f6e">In force as proposed</Badge>}>
              <DocTable head={['Stage', 'SLA', 'Reminder', 'Escalation to', 'Configured now']} dense
                rows={coFirst(SLA_DEFAULTS.filter((d) => iv(SLA_SPACE(d.stage))), (d) => SLA_SPACE(d.stage)).map((d) => {
                  const r = slaRules.find((x) => x.stage === d.stage)
                  const same = r && r.slaDays === d.slaDays && r.reminderDay === d.reminderDay && r.escalateDay === d.escalateDay && r.escalateTo === d.escalateTo
                  return [d.stage, `${d.slaDays} working days`, `Day ${d.reminderDay}`, `${d.escalateTo} on day ${d.escalateDay}`,
                    same ? <span className="text-emerald-700 text-[12px] font-semibold flex items-center gap-1"><Icon name="Check" size={13} />Default</span> : r ? <span className="text-[12px] text-amber-700">{r.slaDays} d · day {r.reminderDay} · {r.escalateTo} day {r.escalateDay}</span> : <span className="text-muted">—</span>]
                })} />
            </Sub>
            <Callout tone="info" icon="Info">{NOTIF_FOOTNOTE}</Callout>
          </Section>

          {/* 13 */}
          <Section id="s13" intro={INTEGRATION_INTRO}>
            <DocTable head={['System', 'Data exchanged', 'Direction', 'Used for']} widths={['20%', '30%', '14%']} dense
              rows={coFirst(INTEGRATIONS.filter((i) => iv(i.space)), (i) => i.space).map((i) => [i.system, i.data,
                <Badge color={i.direction === 'Into COIN' ? '#0f9f6e' : i.direction === 'Out of COIN' ? '#2459e0' : '#bf8f3f'} icon={i.direction === 'Into COIN' ? 'ArrowDownToLine' : i.direction === 'Out of COIN' ? 'ArrowUpFromLine' : 'ArrowLeftRight'}>{i.direction}</Badge>, i.use])} />
            <Callout tone="success" icon="FileSpreadsheet" title="Fallback">{INTEGRATION_FALLBACK}</Callout>
          </Section>

          {/* 14 */}
          <Section id="s14" intro={UI_INTRO}>
            <Sub title="Screen principles" icon="Sparkles">
              <DocTable head={['Area', 'Principle']} widths={['24%']} dense rows={UI_PRINCIPLES.map((u) => [u.area, <span className="flex gap-1.5"><Icon name="CircleCheck" size={14} className="text-emerald-600 mt-0.5 shrink-0" />{u.principle}</span>])} />
            </Sub>
            <div className="grid gap-4 xl:grid-cols-2">
              <Sub title="Colour carries meaning" icon="Palette">
                <DocTable head={['Meaning', 'Colour use']} widths={['46%']} dense rows={UI_COLOURS.map(([m, c]) => [
                  <span className="flex items-center gap-2">{swatch[m] ? <span className="h-4 w-4 rounded-md shrink-0 ring-1 ring-black/5" style={{ background: swatch[m] }} /> : <span className="flex -space-x-1 shrink-0">{leverGroups.map((g) => <span key={g} className="h-4 w-4 rounded-md ring-2 ring-white" style={{ background: LEVER_GROUP_STYLE[g].color }} />)}</span>}{m}</span>,
                  swatch[m] ? <span className="flex items-center gap-2">{c}<span className="font-mono text-[11px] text-muted">{swatch[m]}</span></span> : (
                    <span className="flex flex-col gap-1">{c}<span className="flex flex-wrap gap-1">{leverGroups.map((g) => <span key={g} className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md pl-0.5 pr-1.5 py-0.5" style={{ background: LEVER_GROUP_STYLE[g].soft, color: LEVER_GROUP_STYLE[g].text }}><span className="h-4 w-4 rounded grid place-items-center text-white" style={{ background: LEVER_GROUP_STYLE[g].color }}><Icon name={LEVER_GROUP_STYLE[g].icon} size={10} /></span>{g}</span>)}</span></span>
                  ),
                ])} />
              </Sub>
              <div className="space-y-4">
                <Sub title="Layout and density" icon="LayoutGrid"><Bullets items={UI_LAYOUT} /></Sub>
                <Sub title="Responsive" icon="Smartphone"><P>{UI_RESPONSIVE}</P></Sub>
              </div>
            </div>
            <Sub title="Interactivity" icon="MousePointerClick"><Bullets items={UI_INTERACTIVITY} cols /></Sub>
          </Section>

          {/* 15 */}
          <Section id="s15">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {NFRS.map(([a, r]) => (
                <div key={a} className="rounded-xl border border-line bg-white p-3">
                  <div className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5"><Icon name="ShieldCheck" size={14} className="text-brand-600" />{a}</div>
                  <div className="text-[12.5px] text-ink-2 leading-relaxed mt-1">{r}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* 16 */}
          <Section id="s16">
            <div className="grid gap-4 xl:grid-cols-2">
              <Sub title="Out of scope" icon="Ban"><Bullets items={OUT_OF_SCOPE} /></Sub>
              <Sub title="Assumptions" icon="Handshake"><Bullets items={ASSUMPTIONS} /></Sub>
            </div>
            <Sub title="Decisions for Amber to confirm" icon="Gavel">
              <DocTable head={['#', 'Decision', 'Proposed default', 'Current setting']} widths={['5%', '42%', '30%']} dense
                rows={DECISIONS.map((d, k) => [<span className="num text-muted">{k + 1}</span>, d.decision, d.proposed, decisionNow[d.n] ?? <span className="text-muted">—</span>])} />
            </Sub>
          </Section>

          <div className="text-center text-[11.5px] text-muted py-3">{DOC_META.title} · {DOC_META.table.find((r) => r[0] === 'Prepared by')?.[1]}</div>
        </div>
        </NumCtx.Provider>
      </div>
    </div>
  )
}
