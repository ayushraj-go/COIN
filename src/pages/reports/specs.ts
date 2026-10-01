// Excel + PDF export of each report with the active filters (Section 11: "every report exports to Excel and PDF with the active filters")
import type { PdfSection } from '../../lib/export'
import { exportExcel, exportPdf } from '../../lib/export'
import { ideaAnnualised, healthOf } from '../../lib/calc'
import type { MisReport, Space } from './space'
import { inrShort, inr, pct, fmtDate, monthLabel, num } from '../../lib/format'
import type { Idea } from '../../lib/types'
import {
  type Ctx, homeData, bridgeData, commodityRows, buyerRows, supplierRows, leverData, executionData, dropData, ageingData, campaignRows, leakageData, closureData,
  committedHard, realisedOf, commodityName, nameOf, supplierName, SLA_STATE_STYLE, realisationRate, nonDraft, isBreach, safeDiv,
} from './model'
import { pdfText } from './chartkit'

type Fmt = 'inr' | 'pct' | 'x' | 'int' | 'num1' | 'text' | 'date'
interface TCol<T> { h: string; v: (r: T) => any; f?: Fmt }
export interface Table<T = any> { title: string; rows: T[]; cols: TCol<T>[] }
const t = <T,>(title: string, rows: T[], cols: TCol<T>[]): Table<T> => ({ title, rows, cols })

const show = (v: any, f: Fmt = 'text') => {
  if (v == null || (typeof v === 'number' && !isFinite(v))) return '—'
  switch (f) {
    case 'inr': return inr(v)
    case 'pct': return pct(v, 1)
    case 'x': return `${v.toFixed(2)}x`
    case 'int': return num(v)
    case 'num1': return num(v, 1)
    case 'date': return fmtDate(String(v).slice(0, 10))
    default: return String(v)
  }
}
const raw = (v: any, f: Fmt = 'text') => {
  if (v == null || (typeof v === 'number' && !isFinite(v))) return ''
  switch (f) {
    case 'inr': return Math.round(v)
    case 'pct': case 'x': return +(+v).toFixed(2)
    case 'num1': return +(+v).toFixed(1)
    case 'date': return fmtDate(String(v).slice(0, 10))
    default: return v
  }
}
const hdr = (c: TCol<any>) => (c.f === 'inr' ? `${c.h} (₹)` : c.f === 'pct' ? `${c.h} (%)` : c.h)
export const toPdf = (x: Table): PdfSection => ({ title: pdfText(x.title), head: x.cols.map((c) => pdfText(c.h)), body: x.rows.map((r) => x.cols.map((c) => pdfText(show(c.v(r), c.f)))) })
export const toSheet = (x: Table) => ({ name: x.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), rows: x.rows.map((r) => Object.fromEntries(x.cols.map((c) => [hdr(c), raw(c.v(r), c.f)]))) })

export function ideaDetail(ctx: Ctx, ideas: Idea[], title = 'Idea detail'): Table<Idea> {
  return t(title, ideas, [
    { h: 'Idea ID', v: (i) => i.id }, { h: 'Title', v: (i) => i.title }, { h: 'Commodity', v: (i) => commodityName(ctx, i.commodity) },
    { h: 'Category', v: (i) => ctx.levers.find((l) => l.id === i.leverId)?.name }, { h: 'Route', v: (i) => i.route }, { h: 'Stage', v: (i) => i.stage }, { h: 'Bucket', v: (i) => i.bucket },
    { h: 'Savings type', v: (i) => i.savingsType }, { h: 'Buyer', v: (i) => nameOf(ctx, i.buyerId) }, { h: 'Plant', v: (i) => i.plant }, { h: 'Department', v: (i) => i.department },
    { h: 'Annualised', v: (i) => ideaAnnualised(i), f: 'inr' }, { h: `Committed ${ctx.fy}`, v: (i) => committedHard(ctx, i), f: 'inr' }, { h: 'Realised', v: (i) => realisedOf(ctx, [i]), f: 'inr' },
    { h: 'Submitted', v: (i) => i.submittedAt, f: 'date' },
  ])
}

export interface ReportExport { kpis: [string, string][]; tables: Table[] }
const k = (label: string, v: string): [string, string] => [label, v]

export const REPORT_EXPORT: Record<string, (ctx: Ctx, space: Space) => ReportExport> = {
  home: (ctx, space) => {
    const d = homeData(ctx), s = ctx.sum
    if (space === 'CO') {
      const top = ctx.ideas.filter((i) => i.bucket === 'In Execution' || i.bucket === 'Implemented').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10)
      return {
        kpis: [k(ctx.fv ? 'Realised (validated)' : 'Realised', inrShort(s.realisedCounting)), k('Committed (remaining)', inrShort(s.remainingCommitted)), k('Implemented (annualised)', inrShort(s.values.Implemented)), k('Carry-over to next FY', inrShort(s.carryOver))],
        tables: [
          t('Monthly savings trend', d.trend, [{ h: 'Month', v: (r) => monthLabel(r.month) }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Validated', v: (r) => r.validated, f: 'inr' }, { h: 'Cumulative', v: (r) => (r.future ? null : r.cumulative), f: 'inr' }]),
          t('Top 10 ideas by value', top, [{ h: 'Idea ID', v: (i) => i.id }, { h: 'Title', v: (i) => i.title }, { h: 'Commodity', v: (i) => commodityName(ctx, i.commodity) }, { h: 'Stage', v: (i) => i.stage }, { h: 'Annualised', v: (i) => ideaAnnualised(i), f: 'inr' }, { h: `Committed ${ctx.fy}`, v: (i) => committedHard(ctx, i), f: 'inr' }, { h: 'Realised', v: (i) => realisedOf(ctx, [i]), f: 'inr' }]),
        ],
      }
    }
    const inflow = ctx.months.map((m) => { const l = ctx.ideas.filter((i) => (i.submittedAt ?? '').slice(0, 7) === m); return { month: m, n: l.length, value: l.reduce((a, i) => a + ideaAnnualised(i), 0) } })
    const topP = ctx.ideas.filter((i) => i.bucket === 'Pipeline').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10)
    return {
      kpis: [k('Ideas submitted', String(ctx.ideas.length)), k('Pipeline value', inrShort(s.pipeline)), k('Conversion', pct(safeDiv(d.steps[3].n, d.steps[0].n) * 100)), k('Dropped', `${s.counts.Dropped} · ${inrShort(s.values.Dropped)}`)],
      tables: [
        t('Funnel by bucket', d.buckets, [{ h: 'Bucket', v: (r) => r.bucket }, { h: 'Ideas', v: (r) => r.count, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' }]),
        t('Stage-to-stage conversion', d.steps, [{ h: 'Step', v: (r) => r.step }, { h: 'Ideas', v: (r) => r.n, f: 'int' }, { h: 'Conversion from previous', v: (r) => { const k2 = d.steps.indexOf(r); return k2 ? (r.n / Math.max(1, d.steps[k2 - 1].n)) * 100 : 100 }, f: 'pct' }]),
        t('Monthly idea inflow', inflow, [{ h: 'Month', v: (r) => monthLabel(r.month) }, { h: 'Ideas submitted', v: (r) => r.n, f: 'int' }, { h: 'Annualised value', v: (r) => r.value, f: 'inr' }]),
        t('Top 10 pipeline ideas', topP, [{ h: 'Idea ID', v: (i) => i.id }, { h: 'Title', v: (i) => i.title }, { h: 'Commodity', v: (i) => commodityName(ctx, i.commodity) }, { h: 'Stage', v: (i) => i.stage }, { h: 'Buyer', v: (i) => nameOf(ctx, i.buyerId) }, { h: 'Annualised', v: (i) => ideaAnnualised(i), f: 'inr' }]),
      ],
    }
  },
  bridge: (ctx) => {
    const b = bridgeData(ctx)
    return {
      kpis: [k('Realised', inrShort(b.R)), k('Committed', inrShort(b.C)), k('Pipeline', inrShort(b.P)), k('Total tracked', inrShort(b.total))],
      tables: [
        t('Savings bridge', b.rows, [{ h: 'Step', v: (r) => r.label }, { h: 'Value', v: (r) => r.value, f: 'inr' }, { h: '% of total tracked', v: (r) => (r.value / (b.total || 1)) * 100, f: 'pct' }]),
        commodityTable(ctx, 'Bridge by commodity'),
      ],
    }
  },
  commodity: (ctx, space) => {
    const rows = commodityRows(ctx)
    const group = (r: (typeof rows)[number]) => ctx.categories.find((c) => c.id === r.categoryId)?.name
    if (space === 'CO') return {
      kpis: [k('Commodities', String(rows.length)), k('Realised', inrShort(ctx.sum.realisedCounting)), k('Committed (remaining)', inrShort(ctx.sum.remainingCommitted)), k('Realisation rate', pct(realisationRate(ctx, ctx.all))), k('Price leakage', inrShort(rows.reduce((a, r) => a + r.leakage, 0)))],
      tables: [t('Commodity scorecard', rows, [
        { h: 'Code', v: (r) => r.code }, { h: 'Commodity', v: (r) => r.name }, { h: 'Commodity group', v: group },
        { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Committed (remaining)', v: (r) => r.remaining, f: 'inr' }, { h: 'Implemented', v: (r) => r.implemented, f: 'int' },
        { h: 'Realisation rate', v: (r) => realisationRate(ctx, r.ideas), f: 'pct' }, { h: 'Price leakage', v: (r) => r.leakage, f: 'inr' }, { h: 'Savings % of spend', v: (r) => r.spendPct, f: 'pct' },
      ])],
    }
    const sub = (r: (typeof rows)[number]) => r.ideas.filter(nonDraft)
    return {
      kpis: [k('Commodities', String(rows.length)), k('Ideas', String(rows.reduce((a, r) => a + r.submitted, 0))), k('Pipeline value', inrShort(ctx.sum.pipeline)), k('Beyond SLA', String(ctx.ideas.filter((i) => isBreach(ctx, i)).length))],
      tables: [t('Commodity scorecard', rows, [
        { h: 'Code', v: (r) => r.code }, { h: 'Commodity', v: (r) => r.name }, { h: 'Commodity group', v: group },
        { h: 'Ideas', v: (r) => r.submitted, f: 'int' }, { h: 'In pipeline', v: (r) => sub(r).filter((i) => i.bucket === 'Pipeline').length, f: 'int' }, { h: 'Pipeline value', v: (r) => r.pipeline, f: 'inr' },
        { h: 'Implemented', v: (r) => r.implemented, f: 'int' }, { h: 'Conversion', v: (r) => r.conversion, f: 'pct' }, { h: 'Dropped', v: (r) => r.dropped, f: 'int' },
        { h: 'Beyond SLA', v: (r) => sub(r).filter((i) => isBreach(ctx, i)).length, f: 'int' },
      ])],
    }
  },
  buyer: (ctx, space) => {
    const rows = buyerRows(ctx)
    if (space === 'CO') return {
      kpis: [k('Buyers', String(rows.length)), k('Realised', inrShort(rows.reduce((a, r) => a + r.realised, 0))), k('Overdue value', inrShort(rows.reduce((a, r) => a + r.overdueValue, 0)))],
      tables: [t('Buyer scorecard', rows, [
        { h: 'Buyer', v: (r) => r.name }, { h: 'Commodities', v: (r) => r.commodities.join(', ') }, { h: 'Realised', v: (r) => r.realised, f: 'inr' },
        { h: 'Committed (remaining)', v: (r) => r.committed, f: 'inr' }, { h: 'On-time', v: (r) => r.onTimePct, f: 'pct' }, { h: 'Done', v: (r) => r.done, f: 'int' },
        { h: 'Overdue', v: (r) => r.overdueValue, f: 'inr' }, { h: 'Overdue ideas', v: (r) => r.overdueCount, f: 'int' }, { h: 'Realisation rate', v: (r) => r.realisationRate, f: 'pct' },
      ])],
    }
    const sub = (r: (typeof rows)[number]) => r.ideas.filter(nonDraft)
    const impl = (r: (typeof rows)[number]) => sub(r).filter((i) => i.bucket === 'Implemented').length
    return {
      kpis: [k('Buyers', String(rows.length)), k('Ideas', String(rows.reduce((a, r) => a + sub(r).length, 0))), k('Beyond SLA', String(rows.reduce((a, r) => a + r.breaches, 0)))],
      tables: [t('Buyer scorecard', rows, [
        { h: 'Buyer', v: (r) => r.name }, { h: 'Commodities', v: (r) => r.commodities.join(', ') }, { h: 'Ideas', v: (r) => sub(r).length, f: 'int' },
        { h: 'Pipeline value', v: (r) => r.pipeline, f: 'inr' }, { h: 'Implemented', v: impl, f: 'int' }, { h: 'Conversion', v: (r) => safeDiv(impl(r), sub(r).length) * 100, f: 'pct' },
        { h: 'Avg ageing (days)', v: (r) => r.avgAge, f: 'num1' }, { h: 'Beyond SLA', v: (r) => r.breaches, f: 'int' },
      ])],
    }
  },
  supplier: (ctx) => {
    const rows = supplierRows(ctx)
    return {
      kpis: [k('Suppliers', String(rows.length)), k('Supplier-submitted', String(rows.reduce((a, r) => a + r.supplierSubmitted, 0))), k('Idea value', inrShort(rows.reduce((a, r) => a + r.value, 0)))],
      tables: [t('Supplier innovation scorecard', rows, [
        { h: 'Code', v: (r) => r.code }, { h: 'Supplier', v: (r) => r.name }, { h: 'Commodities', v: (r) => r.commodities.join(', ') }, { h: 'Ideas', v: (r) => r.ideas, f: 'int' },
        { h: 'Supplier-submitted', v: (r) => r.supplierSubmitted, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' }, { h: 'Implemented', v: (r) => r.implemented, f: 'int' },
        { h: 'Conversion', v: (r) => r.conversion, f: 'pct' }, { h: 'Gain-share', v: (r) => r.gainShare, f: 'pct' }, { h: 'Feasibility answered', v: (r) => `${r.feasResponded}/${r.feasRequests}` },
      ])],
    }
  },
  lever: (ctx) => {
    const d = leverData(ctx)
    const comm = commodityRows(ctx).filter((r) => r.realisedAll > 0)
    return {
      kpis: [k('Realised', inrShort(d.total)), k('Negotiated share', pct(d.negotiated)), k('Structural share', pct(d.structuralShare)), k('Flag', d.flag ? 'Heavy dependence on negotiation' : 'Within threshold')],
      tables: [
        t('Realised savings by category', d.rows, [{ h: 'Category', v: (r) => r.name }, { h: 'Category group', v: (r) => r.group }, { h: 'Ideas', v: (r) => r.count, f: 'int' }, { h: 'Implemented', v: (r) => r.implemented, f: 'int' }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Share', v: (r) => r.share, f: 'pct' }, { h: 'Pipeline', v: (r) => r.pipeline, f: 'inr' }, { h: 'Structural', v: (r) => (r.structural ? 'Yes' : 'No') }]),
        t('Share by category group', d.groups, [{ h: 'Category group', v: (r) => r.group }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Share', v: (r) => r.share, f: 'pct' }]),
        t('Structural share trend', d.trend, [{ h: 'Month', v: (r) => r.label }, { h: 'Structural', v: (r) => r.structural, f: 'inr' }, { h: 'Other categories', v: (r) => r.other, f: 'inr' }, { h: 'Month share', v: (r) => r.share, f: 'pct' }, { h: 'Cumulative share', v: (r) => r.cumShare, f: 'pct' }]),
        t('Structural share by commodity', comm, [{ h: 'Commodity', v: (r) => r.name }, { h: 'Realised', v: (r) => r.realisedAll, f: 'inr' }, { h: 'Structural share', v: (r) => r.structuralPct, f: 'pct' }]),
      ],
    }
  },
  execution: (ctx) => {
    const d = executionData(ctx)
    const list = [...d.overdue, ...d.due]
    return {
      kpis: [k('In execution', `${d.inExec.length} · ${inrShort(d.committed)}`), k('Due this month', String(d.due.length)), k('Overdue', String(d.overdue.length)), k('At risk', String(d.atRisk.length)), k('Done this month', String(d.doneMonth.length)), k('Dropped this month', String(d.droppedMonth.length))],
      tables: [
        t('Health', d.health, [{ h: 'Health', v: (r) => r.health }, { h: 'Ideas', v: (r) => r.items.length, f: 'int' }, { h: 'Committed', v: (r) => r.items.reduce((a, x) => a + x.committed, 0), f: 'inr' }]),
        t('Due & overdue', list, [{ h: 'Idea ID', v: (x) => x.idea.id }, { h: 'Title', v: (x) => x.idea.title }, { h: 'Owner', v: (x) => nameOf(ctx, x.idea.execution!.ownerId) }, { h: 'Due date', v: (x) => x.idea.execution!.targetDate, f: 'date' }, { h: 'Health', v: (x) => x.health }, { h: 'Committed', v: (x) => x.committed, f: 'inr' }]),
        t('Execution timeline', d.inExec, [{ h: 'Idea ID', v: (x) => x.idea.id }, { h: 'Title', v: (x) => x.idea.title }, { h: 'Owner', v: (x) => nameOf(ctx, x.idea.execution!.ownerId) }, { h: 'Start', v: (x) => x.idea.execution!.startDate, f: 'date' }, { h: 'Due date', v: (x) => x.idea.execution!.targetDate, f: 'date' }, { h: 'Original due date', v: (x) => x.idea.execution!.originalTargetDate, f: 'date' }, { h: 'Health', v: (x) => x.health }, { h: 'Progress', v: (x) => x.idea.execution!.progress, f: 'pct' }, { h: 'Committed', v: (x) => x.committed, f: 'inr' }]),
      ],
    }
  },
  drops: (ctx) => {
    const d = dropData(ctx)
    return {
      kpis: [k('Dropped', String(d.dropped.length)), k('Drop rate', pct(d.rate)), k('Value dropped', inrShort(d.value)), k('Top reason', d.byReason[0]?.reason ?? '—')],
      tables: [
        t('Month-wise drops by reason', d.months, [{ h: 'Month', v: (r) => monthLabel(r.month) }, ...d.reasons.map((rs) => ({ h: rs, v: (r: any) => r[rs], f: 'int' as Fmt })), { h: 'Total', v: (r) => r.total, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' }]),
        t('Drops by reason', d.byReason, [{ h: 'Reason', v: (r) => r.reason }, { h: 'Drops', v: (r) => r.count, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' }]),
        t('Drops by stage', d.stages, [{ h: 'Stage', v: (r) => r.stage }, { h: 'Drops', v: (r) => r.count, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' }]),
        t('Dropped ideas', d.dropped, [{ h: 'Idea ID', v: (i) => i.id }, { h: 'Title', v: (i) => i.title }, { h: 'Reason', v: (i) => i.dropReason }, { h: 'Stage', v: (i) => i.dropStage }, { h: 'Dropped on', v: (i) => i.droppedAt, f: 'date' }, { h: 'Value', v: (i) => ideaAnnualised(i), f: 'inr' }, { h: 'Remarks', v: (i) => i.dropRemarks }]),
      ],
    }
  },
  ageing: (ctx) => {
    const d = ageingData(ctx)
    return {
      kpis: [k('Open with SLA', String(d.rows.length)), k('Beyond SLA', String(d.breached.length)), k('Escalated', String(d.rows.filter((r) => r.sla.state === 'escalated').length)), k('Avg days in stage', isNaN(d.avgAge) ? '—' : num(d.avgAge, 1))],
      tables: [
        t('SLA status by stage', d.byStage, [{ h: 'Stage', v: (r) => r.stage }, ...['ok', 'due', 'breach', 'escalated'].map((s) => ({ h: SLA_STATE_STYLE[s].label, v: (r: any) => r[s], f: 'int' as Fmt })), { h: 'Total', v: (r) => r.total, f: 'int' }]),
        t('Beyond SLA by owner', d.byOwner, [{ h: 'Owner', v: (r) => r.label }, { h: 'Ideas in stage', v: (r) => r.list.length, f: 'int' }, { h: 'Beyond SLA', v: (r) => r.breach, f: 'int' }, { h: 'Escalated', v: (r) => r.escalated, f: 'int' }, { h: 'Avg days in stage', v: (r) => r.avgAge, f: 'num1' }]),
        t('Ideas beyond SLA', d.breached, [{ h: 'Idea ID', v: (r) => r.idea.id }, { h: 'Title', v: (r) => r.idea.title }, { h: 'Stage', v: (r) => r.idea.stage }, { h: 'Owner', v: (r) => r.owner.label }, { h: 'Working days', v: (r) => r.sla.working, f: 'int' }, { h: 'SLA days', v: (r) => r.sla.sla, f: 'int' }, { h: 'Status', v: (r) => SLA_STATE_STYLE[r.sla.state]?.label }, { h: 'Escalate to', v: (r) => r.sla.rule?.escalateTo }]),
      ],
    }
  },
  campaign: (ctx) => {
    const rows = campaignRows(ctx)
    return {
      kpis: [k('Campaigns', String(rows.length)), k('Ideas', String(rows.reduce((a, r) => a + r.ideas, 0))), k('Value', inrShort(rows.reduce((a, r) => a + r.value, 0))), k('Implemented', String(rows.reduce((a, r) => a + r.implemented, 0)))],
      tables: [t('Campaign effectiveness', rows, [
        { h: 'ID', v: (r) => r.id }, { h: 'Campaign / workshop', v: (r) => r.name }, { h: 'Type', v: (r) => r.type }, { h: 'Status', v: (r) => r.status }, { h: 'Commodity', v: (r) => commodityName(ctx, r.commodity) },
        { h: 'Start', v: (r) => r.startDate, f: 'date' }, { h: 'End', v: (r) => r.endDate, f: 'date' }, { h: 'Suppliers invited', v: (r) => r.suppliers, f: 'int' }, { h: 'Attended', v: (r) => r.attended, f: 'int' },
        { h: 'Ideas', v: (r) => r.ideas, f: 'int' }, { h: 'From suppliers', v: (r) => r.supplierIdeas, f: 'int' }, { h: 'Value', v: (r) => r.value, f: 'inr' },
        { h: 'Approved', v: (r) => r.approved, f: 'int' }, { h: 'Implemented', v: (r) => r.implemented, f: 'int' }, { h: 'Conversion', v: (r) => r.conversion, f: 'pct' }, { h: 'Realised', v: (r) => r.realised, f: 'inr' },
      ])],
    }
  },
  leakage: (ctx) => {
    const d = leakageData(ctx), fin = ageingData(ctx).fin
    return {
      kpis: [k('Committed to date', inrShort(d.committedTD)), k('Realised', inrShort(d.realised)), k('Realisation rate', pct(d.rate)), k('Price leakage', inrShort(d.leakage))],
      tables: [
        t('Committed vs realised by month', d.monthly, [{ h: 'Month', v: (r) => r.label }, { h: 'Committed', v: (r) => r.committed, f: 'inr' }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Validated', v: (r) => r.validated, f: 'inr' }, { h: 'Leakage', v: (r) => r.leakage, f: 'inr' }]),
        t('Price leakage by supplier', d.bySupplier, [{ h: 'Code', v: (r) => r.code }, { h: 'Supplier', v: (r) => r.name }, { h: 'Entries', v: (r) => r.entries, f: 'int' }, { h: 'Parts', v: (r) => r.parts, f: 'int' }, { h: 'Leakage', v: (r) => r.leakage, f: 'inr' }]),
        t('Realisation by commodity', d.byCommodity, [{ h: 'Commodity', v: (r) => r.name }, { h: `Committed ${ctx.fy}`, v: (r) => r.committedFy, f: 'inr' }, { h: 'Committed to date', v: (r) => r.committedTD, f: 'inr' }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Realisation rate', v: (r) => r.rate, f: 'pct' }, { h: 'Leakage', v: (r) => r.leakage, f: 'inr' }]),
        t('Finance validation SLA', fin, [{ h: 'Idea ID', v: (r) => r.ideaId }, { h: 'Month', v: (r) => monthLabel(r.month) }, { h: 'Working days pending', v: (r) => r.wd, f: 'int' }, { h: 'Realised', v: (r) => r.value, f: 'inr' }, { h: 'Breach', v: (r) => (r.breach ? 'Yes' : 'No') }]),
        t('Leakage entries', d.leakRows, [{ h: 'Month', v: (l) => monthLabel(l.month) }, { h: 'Idea ID', v: (l) => l.ideaId }, { h: 'Part', v: (l) => l.partCode }, { h: 'Supplier', v: (l) => supplierName(ctx, l.supplierCode) }, { h: 'MRN qty', v: (l) => l.mrnQty, f: 'int' }, { h: 'Approved price', v: (l) => l.approvedPrice }, { h: 'MRN price', v: (l) => l.mrnPrice }, { h: 'Leakage', v: (l) => l.leakage, f: 'inr' }]),
      ],
    }
  },
  closure: (ctx) => {
    const d = closureData(ctx), s = ctx.sum
    return {
      kpis: [k('Realised', inrShort(s.realisedCounting)), k(`Committed in ${ctx.fy}`, inrShort(d.inFy)), k('Implemented ideas', String(s.counts.Implemented)), k(`Carry-over to ${d.next}`, inrShort(d.carry)), k('Open ideas rolling', String(d.rollIn.length))],
      tables: [
        t('FY savings & carry-over by commodity', d.rows, [{ h: 'Commodity', v: (r) => r.name }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }, { h: 'Committed (remaining)', v: (r) => r.remaining, f: 'inr' }, { h: `Committed ${ctx.fy}`, v: (r) => r.committed, f: 'inr' }, { h: `Carry-over ${d.next}`, v: (r) => r.carryOver, f: 'inr' }]),
        t('Quarter phasing', d.quarters, [{ h: 'Quarter', v: (r) => r.q }, { h: 'Committed', v: (r) => r.committed, f: 'inr' }, { h: 'Realised', v: (r) => r.realised, f: 'inr' }]),
        t(`Open ideas rolling into ${d.next}`, d.rollIn, [{ h: 'Idea ID', v: (i) => i.id }, { h: 'Title', v: (i) => i.title }, { h: 'Stage', v: (i) => i.stage }, { h: 'Due date', v: (i) => i.execution?.targetDate, f: 'date' }, { h: 'Health', v: (i) => (i.execution ? healthOf(i) : '—') }, { h: 'Annualised', v: (i) => ideaAnnualised(i), f: 'inr' }]),
      ],
    }
  },
}

function commodityTable(ctx: Ctx, title: string) {
  return t(title, commodityRows(ctx), [
    { h: 'Code', v: (r) => r.code }, { h: 'Commodity', v: (r) => r.name }, { h: 'Realised', v: (r) => r.realised, f: 'inr' },
    { h: 'Committed', v: (r) => r.remaining, f: 'inr' },
    { h: 'Pipeline', v: (r) => r.pipeline, f: 'inr' }, { h: 'Ideas', v: (r) => r.submitted, f: 'int' }, { h: 'Conversion', v: (r) => r.conversion, f: 'pct' },
  ])
}

/** Run the export for a report of a workspace with the active filters */
export function runExport(kind: 'pdf' | 'excel', def: MisReport, ctx: Ctx, filters: string) {
  const spec = REPORT_EXPORT[def.key](ctx, def.space)
  const title = `${def.space} ${def.n}. ${def.name}`
  const base = `COIN_${def.space}${String(def.n).padStart(2, '0')}_${def.name.replace(/[^A-Za-z0-9]+/g, '_')}_${ctx.fy}`
  if (kind === 'excel') {
    exportExcel(base, [
      { name: 'Summary', rows: [
        { Item: 'Report', Value: title }, { Item: 'Workspace', Value: def.space === 'CO' ? 'Cost Optimisation' : 'Innovation Network' }, { Item: 'Audience', Value: def.audience }, { Item: 'Key visuals', Value: def.visuals }, { Item: 'Frequency', Value: def.frequency },
        { Item: 'Active filters', Value: filters }, { Item: 'Generated', Value: new Date().toLocaleString('en-IN') }, ...spec.kpis.map(([a, b]) => ({ Item: a, Value: b })),
      ] },
      ...spec.tables.map(toSheet),
      toSheet(ideaDetail(ctx, ctx.ideas)),
    ])
  } else {
    exportPdf({ filename: base, title: pdfText(title), subtitle: pdfText(`${def.audience} | ${def.frequency}`), filters: pdfText(filters), kpis: spec.kpis.slice(0, 6).map(([a, b]) => [pdfText(a), pdfText(b)] as [string, string]), sections: spec.tables.map(toPdf) })
  }
}
