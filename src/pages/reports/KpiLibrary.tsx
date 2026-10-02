// Section 10 — Sourcing KPIs in six groups, computed live for the active filter scope. Group A headline values come from useSummary.
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Chip, Icon, InfoTip, Stagger, Money, Count, cn } from '../../components/ui'
import { useSummary } from '../../lib/hooks'
import { ideaAnnualised, ideaCommitted, stageAgeDays, STRUCTURAL_LEVERS, type Summary } from '../../lib/calc'
import { KPIS, STRUCTURAL_NOTE } from '../../lib/scope'
import { type Space, SPACE_ORDER, SPACE_META, KPI_INTRO_BY_SPACE, kpisOf, CO_STAGES } from './space'
import { inrShort, pct, num, monthLabel, daysBetween } from '../../lib/format'
import { exportExcel, exportPdf } from '../../lib/export'
import type { Idea, RouteKey } from '../../lib/types'
import {
  type Ctx, groupSum, nonDraft, isHardIdea, safeDiv, mean, realisedOf, committedHard, isOverdue, isOnTime, isBreach, realisationRate, stageOwner, quarterPhasing,
  funnelSteps, stageDurations, leverData, ALL_STAGES_ORDER, NEGOTIATION_FLAG_PCT,
} from './model'
import { ideasUrl, useIdeaList, MeterRow, MiniBars, pdfText, inrBig, type Drill } from './chartkit'

interface BRow { key: string; label: string; value: number; display: string; drill?: Drill; ideas?: Idea[]; sub?: string; color?: string }
interface Head { v: number; kind: 'money' | 'pct' | 'count' | 'days'; digits?: number; sub?: React.ReactNode; color?: string; display?: string }
interface KDef { id: string; head: (ctx: Ctx, sm: Summary, n: number, space: Space) => Head; rows: (ctx: Ctx, dim: string, sm: Summary, n: number, space: Space) => BRow[]; max?: (rows: BRow[]) => number; marker?: number; asc?: boolean; extra?: (ctx: Ctx) => React.ReactNode }

const GROUP_COLOR: Record<string, string> = { A: '#475569', B: '#0891b2', C: '#7c3aed', D: '#ec8a1c', E: '#bf8f3f', F: '#0d9488' }
const GROUP_NOTE: Record<string, string> = {
  A: 'Savings in the pipeline, in execution and realised',
  B: 'How ideas move through the funnel', C: 'How fast ideas move', D: 'How reliably approved ideas deliver', E: 'Where the savings come from', F: 'How wide the innovation network is',
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dimsOf = (cut: string) => cut.split(',').map((x) => cap(x.trim()))
const rateTone = (p: number) => (p >= 100 ? '#0f9f6e' : p >= 80 ? '#ec8a1c' : '#e0364f')
const ROUTES: RouteKey[] = ['Commercial', 'Supplier change', 'Technical', 'Internal', 'To be confirmed']

interface Part { key: string; label: string; ideas: Idea[]; drill?: Drill }
function partition(ctx: Ctx, dim: string): Part[] {
  const scope = ctx.scopeCommodities
  const out: Part[] = (() => {
    switch (dim) {
      case 'Commodity': return scope.map((c) => ({ key: c.code, label: c.name, ideas: ctx.all.filter((i) => i.commodity === c.code), drill: { commodity: c.code } }))
      case 'Commodity group': return ctx.categories.filter((cat) => scope.some((c) => c.categoryId === cat.id)).map((cat) => ({ key: cat.id, label: cat.name, ideas: ctx.all.filter((i) => i.categoryId === cat.id), drill: { category: cat.id } }))
      case 'Buyer': return ctx.users.filter((u) => u.roles.includes('buyer')).map((u) => ({ key: u.id, label: u.name, ideas: ctx.all.filter((i) => i.buyerId === u.id), drill: { buyer: u.id } }))
      case 'Plant': return ctx.plants.map((p) => ({ key: p.id, label: `${p.name} · ${p.bu}`, ideas: ctx.all.filter((i) => i.plant === p.id), drill: { plant: p.id } }))
      case 'Category': case 'Lever': return ctx.levers.map((l) => ({ key: l.id, label: l.name, ideas: ctx.all.filter((i) => i.leverId === l.id), drill: { lever: l.id } }))
      case 'Route': return ROUTES.map((r) => ({ key: r, label: r, ideas: ctx.all.filter((i) => i.route === r), drill: { route: r } }))
      case 'Campaign': return ctx.campaigns.map((c) => ({ key: c.id, label: c.name, ideas: ctx.ideas.filter((i) => i.campaignId === c.id), drill: { campaign: c.id } }))
      case 'Department': return [...new Set(ctx.ideas.map((i) => i.department))].map((d) => ({ key: d, label: d, ideas: ctx.ideas.filter((i) => i.department === d), drill: { dept: d } }))
      default: return []
    }
  })()
  return out.filter((p) => p.ideas.length)
}
const byParts = (ctx: Ctx, dim: string, f: (p: Part) => number, disp: (v: number, p: Part) => string, sub?: (p: Part) => string): BRow[] =>
  partition(ctx, dim).map((p) => { const v = f(p); return { key: p.key, label: p.label, value: v, display: disp(v, p), drill: p.drill, ideas: p.ideas, sub: sub?.(p) } })

const money = (v: number) => inrShort(v)
const days = (v: number) => (isNaN(v) ? '—' : `${num(v, 1)} d`)
const pipelineOf = (ideas: Idea[]) => ideas.filter((i) => i.bucket === 'Pipeline' && isHardIdea(i)).reduce((a, i) => a + ideaAnnualised(i), 0)
const committedExec = (ctx: Ctx, ideas: Idea[]) => ideas.filter((i) => i.bucket === 'In Execution' && isHardIdea(i)).reduce((a, i) => a + ideaCommitted(i, ctx.fy), 0)
const conv = (ideas: Idea[]) => { const s = ideas.filter(nonDraft); return safeDiv(s.filter((i) => i.bucket === 'Implemented').length, s.length) * 100 }
const dropRate = (ideas: Idea[]) => { const s = ideas.filter(nonDraft); return safeDiv(s.filter((i) => i.bucket === 'Dropped').length, s.length) * 100 }
const openIdeas = (ideas: Idea[]) => ideas.filter((i) => i.bucket === 'Pipeline' || i.bucket === 'In Execution')
const c1 = (ideas: Idea[]) => mean(ideas.filter((i) => i.submittedAt && i.approvedAt).map((i) => daysBetween(i.submittedAt!, i.approvedAt!)))
const c2 = (ideas: Idea[]) => mean(ideas.filter((i) => i.bucket === 'Implemented' && i.approvedAt && i.implementedAt).map((i) => daysBetween(i.approvedAt!, i.implementedAt!)))
const onTime = (ideas: Idea[]) => { const done = ideas.filter((i) => i.bucket === 'Implemented' && i.execution); const ok = done.filter(isOnTime).length; return { pct: done.length ? (ok / done.length) * 100 : NaN, ok, done: done.length } }
function topSuppliers(ctx: Ctx, codes: string[] | null, n: number) {
  const scope = new Set(ctx.scopeCommodities.map((c) => c.code))
  const pool = ctx.suppliers.filter((s) => (codes ? s.commodities.some((c) => codes.includes(c)) : s.commodities.some((c) => scope.has(c)))).sort((a, b) => b.spend - a.spend).slice(0, n)
  const submitted = new Set(ctx.ideas.filter((i) => i.isSupplierSubmission && i.supplierCode).map((i) => i.supplierCode!))
  const yes = pool.filter((s) => submitted.has(s.code))
  return { pool, yes, pct: safeDiv(yes.length, pool.length) * 100 }
}

/** C3 per workspace: IN reads review and approval stages, CO reads NPD sample, execution and PAP stages */
const stagesOf = (ctx: Ctx, space: Space) => stageDurations(ctx, ctx.ideas).filter((x) => CO_STAGES.includes(x.stage) === (space === 'CO'))

const DEFS: KDef[] = [
  {
    id: 'A2', head: (ctx, sm) => { const spend = ctx.scopeCommodities.reduce((a, c) => a + c.addressableSpend, 0); return { v: safeDiv(sm.realised, spend) * 100, kind: 'pct', digits: 3, sub: <>{inrShort(sm.realised)} of {inrBig(spend)} addressable spend</> } },
    rows: (ctx, dim) => byParts(ctx, dim, (p) => { const spend = dim === 'Commodity' ? ctx.commodities.find((c) => c.code === p.key)?.addressableSpend ?? 0 : ctx.scopeCommodities.filter((c) => c.categoryId === p.key).reduce((a, c) => a + c.addressableSpend, 0); return safeDiv(realisedOf(ctx, p.ideas), spend) * 100 }, (v) => pct(v, 3)),
  },
  { id: 'A3', head: (_c, sm) => ({ v: sm.pipeline, kind: 'money', color: '#3b74f2', sub: <>{sm.counts.Pipeline} ideas in Pipeline</> }), rows: (ctx, dim) => byParts(ctx, dim, (p) => pipelineOf(p.ideas), money).map((r) => ({ ...r, drill: { ...r.drill, bucket: 'Pipeline' } })) },
  {
    id: 'A4', head: (ctx, sm) => ({ v: committedExec(ctx, ctx.all), kind: 'money', color: '#ec8a1c', sub: <>incl. implemented ideas: {inrShort(sm.committed)}</> }),
    rows: (ctx, dim) => {
      if (dim === 'Quarter') {
        const q = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
        ctx.all.filter((i) => i.bucket === 'In Execution').forEach((i) => { const p = quarterPhasing(ctx, i); q.Q1 += p.Q1; q.Q2 += p.Q2; q.Q3 += p.Q3; q.Q4 += p.Q4 })
        return (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((k) => ({ key: k, label: `${k} ${({ Q1: 'Apr–Jun', Q2: 'Jul–Sep', Q3: 'Oct–Dec', Q4: 'Jan–Mar' })[k]}`, value: q[k], display: money(q[k]), drill: { bucket: 'In Execution' } }))
      }
      return byParts(ctx, dim, (p) => committedExec(ctx, p.ideas), money).map((r) => ({ ...r, drill: { ...r.drill, bucket: 'In Execution' } }))
    },
  },
  {
    id: 'A5', head: (_c, sm) => ({ v: sm.realised, kind: 'money', color: '#0f9f6e', sub: <>{inrShort(sm.realisedValidated)} Finance-validated</> }),
    rows: (ctx, dim) => {
      if (dim === 'Month') return ctx.months.filter((m) => m <= ctx.lrm).map((m) => { const rows = ctx.hardLed.filter((l) => l.month === m); const v = rows.reduce((a, l) => a + l.realised, 0); const ids = new Set(rows.map((l) => l.ideaId)); return { key: m, label: monthLabel(m), value: v, display: money(v), ideas: ctx.ideas.filter((i) => ids.has(i.id)) } })
      if (dim === 'Supplier') {
        const m = new Map<string, number>()
        ctx.hardLed.forEach((l) => m.set(l.supplierCode, (m.get(l.supplierCode) ?? 0) + l.realised))
        return [...m.entries()].map(([code, v]) => ({ key: code, label: ctx.suppliers.find((s) => s.code === code)?.name ?? code, value: v, display: money(v), drill: { supplier: code } }))
      }
      return byParts(ctx, dim, (p) => realisedOf(ctx, p.ideas), money)
    },
  },
  { id: 'A9', head: (ctx, sm) => ({ v: sm.carryOver, kind: 'money', color: '#4f46e5', sub: <>beyond {ctx.fy} close (31 March)</> }), rows: (ctx, dim) => byParts(ctx, dim, (p) => groupSum(ctx, p.ideas).carryOver, money) },
  {
    id: 'B1', head: (ctx) => ({ v: ctx.ideas.length, kind: 'count', sub: <>{inrShort(ctx.ideas.reduce((a, i) => a + ideaAnnualised(i), 0))} annualised</> }),
    rows: (ctx) => {
      const m = new Map<string, Idea[]>()
      ctx.ideas.forEach((i) => m.set(i.stage, [...(m.get(i.stage) ?? []), i]))
      return [...m.entries()].sort((a, b) => ALL_STAGES_ORDER.indexOf(a[0]) - ALL_STAGES_ORDER.indexOf(b[0])).map(([st, list]) => ({ key: st, label: st, value: list.length, display: `${list.length} · ${inrShort(list.reduce((a, i) => a + ideaAnnualised(i), 0))}`, drill: { stage: st }, ideas: list }))
    },
    asc: true,
  },
  {
    id: 'B2', head: (ctx) => ({ v: conv(ctx.ideas), kind: 'pct', color: '#0f9f6e', sub: <>{ctx.ideas.filter((i) => i.bucket === 'Implemented').length} of {ctx.ideas.length} submitted</> }),
    rows: (ctx, dim) => byParts(ctx, dim, (p) => conv(p.ideas), (v, p) => `${pct(v, 0)} · ${p.ideas.filter(nonDraft).length}`), max: () => 100,
    extra: (ctx) => { const st = funnelSteps(ctx.all); return <div className="flex items-center gap-1 text-[10.5px] text-muted flex-wrap">{st.map((s, k) => <span key={s.step} className="inline-flex items-center gap-1">{k > 0 && <Icon name="ChevronRight" size={10} />}<b className="text-ink-2">{s.step}</b>{k > 0 && <span className="num">{pct((s.n / Math.max(1, st[k - 1].n)) * 100, 0)}</span>}</span>)}</div> },
  },
  {
    id: 'B3', head: (ctx) => { const d = ctx.ideas.filter((i) => i.bucket === 'Dropped'); const m = new Map<string, number>(); d.forEach((i) => m.set(i.dropReason ?? '—', (m.get(i.dropReason ?? '—') ?? 0) + 1)); const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return { v: dropRate(ctx.ideas), kind: 'pct', color: '#6b7280', sub: <>{d.length} dropped · top: {top?.[0] ?? '—'}</> } },
    rows: (ctx, dim) => {
      const dropped = ctx.ideas.filter((i) => i.bucket === 'Dropped')
      if (dim === 'Reason' || dim === 'Stage') {
        const m = new Map<string, Idea[]>()
        dropped.forEach((i) => { const k = (dim === 'Reason' ? i.dropReason : i.dropStage) ?? '—'; m.set(k, [...(m.get(k) ?? []), i]) })
        return [...m.entries()].map(([k, list]) => ({ key: k, label: k, value: list.length, display: `${list.length}`, ideas: list, drill: dim === 'Reason' ? { bucket: 'Dropped', dropReason: k } : undefined }))
      }
      return byParts(ctx, dim, (p) => dropRate(p.ideas), (v, p) => `${pct(v, 0)} · ${p.ideas.filter((i) => i.bucket === 'Dropped').length}`).map((r) => ({ ...r, drill: { ...r.drill, bucket: 'Dropped' } }))
    },
    extra: (ctx) => <div className="flex items-end gap-2"><MiniBars width={120} height={20} color="#6b7280" data={ctx.months.map((m) => ctx.ideas.filter((i) => i.bucket === 'Dropped' && (i.droppedAt ?? '').slice(0, 7) === m).length)} /><span className="text-[10px] text-muted">month-wise, Apr → Mar</span></div>,
  },
  {
    id: 'B4', head: (ctx) => { const o = openIdeas(ctx.ideas); return { v: mean(o.map((i) => stageAgeDays(i))), kind: 'days', color: '#ec8a1c', sub: <>{ctx.ideas.filter((i) => isBreach(ctx, i)).length} ideas beyond SLA</> } },
    rows: (ctx, dim) => {
      if (dim === 'Owner') {
        const m = new Map<string, { label: string; list: Idea[] }>()
        ctx.ideas.filter((i) => i.bucket === 'Pipeline').forEach((i) => { const o = stageOwner(ctx, i); const e = m.get(o.key) ?? { label: o.label, list: [] }; e.list.push(i); m.set(o.key, e) })
        return [...m.entries()].map(([k, e]) => { const b = e.list.filter((i) => isBreach(ctx, i)).length; return { key: k, label: e.label, value: b, display: `${b} over SLA · ${e.list.length}`, ideas: e.list, color: b ? '#e0364f' : '#0f9f6e' } })
      }
      const m = new Map<string, Idea[]>()
      openIdeas(ctx.ideas).forEach((i) => m.set(i.stage, [...(m.get(i.stage) ?? []), i]))
      return [...m.entries()].map(([st, list]) => { const a = mean(list.map((i) => stageAgeDays(i))); const b = list.filter((i) => isBreach(ctx, i)).length; return { key: st, label: st, value: a, display: `${num(a, 0)} d${b ? ` · ${b} over` : ''}`, drill: { stage: st }, ideas: list, color: b ? '#e0364f' : '#ec8a1c' } })
    },
  },
  { id: 'C1', head: (ctx) => ({ v: c1(ctx.ideas), kind: 'days', color: '#7c3aed', sub: <>{ctx.ideas.filter((i) => i.approvedAt).length} approved ideas</> }), rows: (ctx, dim) => byParts(ctx, dim, (p) => c1(p.ideas), days).filter((r) => !isNaN(r.value)) },
  { id: 'C2', head: (ctx) => ({ v: c2(ctx.ideas), kind: 'days', color: '#7c3aed', sub: <>{ctx.ideas.filter((i) => i.bucket === 'Implemented').length} ideas Done</> }), rows: (ctx, dim) => byParts(ctx, dim, (p) => c2(p.ideas), days).filter((r) => !isNaN(r.value)) },
  {
    id: 'C3', head: (ctx, _sm, _n, space) => { const s = stagesOf(ctx, space).filter((x) => x.stage !== 'Team feasibility check' || space === 'CO'); const top = [...s].sort((a, b) => b.avg - a.avg)[0]; return { v: top?.avg ?? NaN, kind: 'days', color: '#e0364f', sub: <>slowest: {top?.stage ?? '—'} · {space === 'CO' ? 'Execution started (NPD sample, PAP, go-live)' : 'R&D and sourcing approval'}</> } },
    rows: (ctx, _dim, _sm, _n, space) => stagesOf(ctx, space).map((s) => ({ key: s.stage, label: s.stage, value: s.avg, display: `${num(s.avg, 1)} d · ${s.n}`, drill: { stage: s.stage }, color: /R&D|NPD|PAP/.test(s.stage) ? '#e0364f' : '#7c3aed' })),
  },
  { id: 'D1', head: (ctx) => { const o = onTime(ctx.ideas); return { v: o.pct, kind: 'pct', color: '#0f9f6e', sub: <>{o.ok} of {o.done} Done by original due date</> } }, rows: (ctx, dim) => byParts(ctx, dim, (p) => onTime(p.ideas).pct, (v, p) => { const o = onTime(p.ideas); return `${pct(v, 0)} · ${o.ok}/${o.done}` }).filter((r) => !isNaN(r.value)), max: () => 100 },
  { id: 'D2', head: (ctx) => { const o = ctx.ideas.filter((i) => isOverdue(ctx, i)); return { v: o.reduce((a, i) => a + committedHard(ctx, i), 0), kind: 'money', color: '#e0364f', sub: <>{o.length} ideas past due date</> } }, rows: (ctx, dim) => byParts(ctx, dim, (p) => p.ideas.filter((i) => isOverdue(ctx, i)).reduce((a, i) => a + committedHard(ctx, i), 0), money).map((r) => ({ ...r, drill: { ...r.drill, health: 'Delayed' }, color: '#e0364f' })) },
  { id: 'D3', head: (ctx) => { const r = realisationRate(ctx, ctx.ideas); return { v: r, kind: 'pct', color: rateTone(r), sub: <>realised ÷ committed to {monthLabel(ctx.lrm)}</> } }, rows: (ctx, dim) => byParts(ctx, dim, (p) => realisationRate(ctx, p.ideas), (v) => pct(v, 0)).filter((r) => r.value > 0), max: () => 120, marker: 100 },
  {
    id: 'D4', head: (ctx) => ({ v: ctx.led.reduce((a, l) => a + l.leakage, 0), kind: 'money', color: '#e0364f', sub: <>{ctx.led.filter((l) => l.leakage > 0).length} ledger entries</> }),
    rows: (ctx, dim) => {
      const m = new Map<string, { v: number; ids: Set<string> }>()
      ctx.led.filter((l) => l.leakage > 0).forEach((l) => { const k = dim === 'Supplier' ? l.supplierCode : l.partCode; const e = m.get(k) ?? { v: 0, ids: new Set<string>() }; e.v += l.leakage; e.ids.add(l.ideaId); m.set(k, e) })
      return [...m.entries()].map(([k, e]) => {
        const desc = dim === 'Part' ? ctx.all.flatMap((i) => i.parts).find((p) => p.partCode === k)?.description : ctx.suppliers.find((s) => s.code === k)?.name
        return { key: k, label: dim === 'Part' ? `${k} · ${desc ?? ''}` : desc ?? k, value: e.v, display: money(e.v), drill: dim === 'Supplier' ? { supplier: k } : { q: k }, ideas: ctx.ideas.filter((i) => e.ids.has(i.id)), color: '#e0364f' }
      })
    },
  },
  {
    id: 'E1', head: (ctx) => { const d = leverData(ctx); return { v: d.negotiated, kind: 'pct', color: d.flag ? '#e0364f' : '#7c3aed', sub: <>{d.flag ? <b className="text-red-600">Flag: </b> : null}negotiated (commercial) share · flag &gt; {NEGOTIATION_FLAG_PCT}%</> } },
    rows: (ctx) => leverData(ctx).rows.filter((r) => r.realised > 0).map((r) => ({ key: r.id, label: r.name, value: r.share, display: `${pct(r.share)} · ${inrShort(r.realised)}`, drill: { lever: r.id }, color: r.group === 'Commercial' ? '#7c3aed' : STRUCTURAL_LEVERS.includes(r.id) ? '#4f46e5' : '#0d9488' })), max: () => 100,
  },
  { id: 'E2', head: (ctx) => { const d = leverData(ctx); return { v: d.structuralShare, kind: 'pct', color: '#4f46e5', sub: <>{inrShort(d.structuralTotal)} of {inrShort(d.total)} realised</> } }, rows: (ctx, dim) => byParts(ctx, dim, (p) => { const t = realisedOf(ctx, p.ideas); return safeDiv(realisedOf(ctx, p.ideas.filter((i) => STRUCTURAL_LEVERS.includes(i.leverId))), t) * 100 }, (v) => pct(v)).filter((r) => r.value > 0), max: () => 100 },
  {
    id: 'F1', head: (ctx, _sm, n) => { const t = topSuppliers(ctx, null, n); return { v: t.pct, kind: 'pct', color: '#0d9488', sub: <>{t.yes.length} of top-{t.pool.length} suppliers by spend submitted ≥ 1 idea</> } },
    rows: (ctx, _dim, _sm, n) => ctx.scopeCommodities.map((c) => { const t = topSuppliers(ctx, [c.code], n); return { key: c.code, label: c.name, value: t.pct, display: `${pct(t.pct, 0)} · ${t.yes.length}/${t.pool.length}`, drill: { commodity: c.code } } }).filter((r) => r.display.indexOf('/0') < 0), max: () => 100,
  },
  {
    id: 'F2', head: (ctx) => { const withIdeas = ctx.campaigns.filter((c) => ctx.ideas.some((i) => i.campaignId === c.id)); const n = ctx.ideas.filter((i) => i.campaignId).length; return { v: safeDiv(n, withIdeas.length), kind: 'count', digits: 1, color: '#db2777', sub: <>ideas per campaign · {n} ideas, {inrShort(ctx.ideas.filter((i) => i.campaignId).reduce((a, i) => a + ideaAnnualised(i), 0))}</> } },
    rows: (ctx, dim) => byParts(ctx, dim, (p) => p.ideas.length, (v, p) => `${v} · ${inrShort(p.ideas.reduce((a, i) => a + ideaAnnualised(i), 0))} · ${pct(conv(p.ideas), 0)}`),
  },
  { id: 'F3', head: (ctx) => ({ v: ctx.ideas.length, kind: 'count', color: '#0d9488', sub: <>from {new Set(ctx.ideas.map((i) => i.department)).size} departments</> }), rows: (ctx, dim) => byParts(ctx, dim, (p) => p.ideas.length, (v, p) => `${v} · ${inrShort(p.ideas.reduce((a, i) => a + ideaAnnualised(i), 0))}`) },
]

function HeadValue({ h }: { h: Head }) {
  if (h.v == null || isNaN(h.v)) return <span>—</span>
  if (h.kind === 'money') return <Money value={h.v} />
  if (h.kind === 'pct') return <Count value={h.v} digits={h.digits ?? 1} suffix="%" />
  if (h.kind === 'days') return <Count value={h.v} digits={1} suffix=" d" />
  return <Count value={h.v} digits={h.digits ?? 0} />
}

function KpiTile({ def, ctx, sm, onRow, n, setN, space }: { def: KDef; ctx: Ctx; sm: Summary; onRow: (r: BRow, title: string) => void; n: number; setN: (n: number) => void; space: Space }) {
  const meta = KPIS.find((k) => k.id === def.id)!
  const dims = dimsOf(meta.cut)
  const [dim, setDim] = useState(dims[0])
  const head = useMemo(() => def.head(ctx, sm, n, space), [def, ctx, sm, n, space])
  const rows = useMemo(() => { const r = def.rows(ctx, dim, sm, n, space); return r.sort((a, b) => (def.asc && def.id !== 'B1' ? a.value - b.value : def.id === 'B1' ? 0 : b.value - a.value)) }, [def, ctx, dim, sm, n, space])
  const max = def.max ? def.max(rows) : Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)).filter((v) => isFinite(v)))
  const g = def.id[0]
  const color = GROUP_COLOR[g]
  return (
    <div className="card p-3 flex flex-col min-w-0 h-full hover:shadow-[0_10px_30px_-14px_rgb(15_23_42/.25)] transition-shadow relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10.5px] font-extrabold px-1.5 h-5 rounded grid place-items-center text-white shrink-0" style={{ background: color }}>{def.id}</span>
          <span className="text-[12.5px] font-semibold text-ink truncate">{meta.kpi}</span>
          <InfoTip title={`${def.id} · ${meta.kpi}`} formula={meta.formula}>Cut by: {meta.cut}{def.id === 'E2' ? ` · ${STRUCTURAL_NOTE}` : ''}</InfoTip>
        </div>
        {def.id === 'F1' && (
          <select value={n} onChange={(e) => setN(Number(e.target.value))} className="h-6 text-[11px] font-semibold border border-line rounded-md px-1 bg-white" title="N — top suppliers by spend">
            {[5, 10, 15, 20].map((x) => <option key={x} value={x}>Top {x}</option>)}
          </select>
        )}
      </div>
      <div className="mt-2 text-[22px] leading-none font-bold tracking-tight" style={{ color: head.color ?? '#1e3a5f' }}><HeadValue h={head} /></div>
      <div className="text-[11px] text-muted mt-1 truncate">{head.sub}</div>
      <div className="font-mono text-[10px] text-slate-400 mt-1 truncate" title={meta.formula}>{meta.formula}</div>
      {def.extra && <div className="mt-1.5">{def.extra(ctx)}</div>}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted mr-0.5">Cut by</span>
        {dims.map((d) => <Chip key={d} active={d === dim} onClick={() => setDim(d)} color={color}>{d}</Chip>)}
      </div>
      <div className="mt-2 space-y-0.5 flex-1">
        {rows.slice(0, 20).map((r) => (
          <MeterRow key={r.key} label={r.label} value={isFinite(r.value) ? Math.abs(r.value) : 0} max={max} marker={def.marker} color={r.color ?? color} display={r.display} onClick={r.drill || r.ideas ? () => onRow(r, `${def.id} · ${meta.kpi} · ${r.label}`) : undefined} />
        ))}
        {!rows.length && <div className="text-[11.5px] text-muted py-3 text-center">No data for the active filters</div>}
      </div>
    </div>
  )
}

export default function KpiLibrary({ ctx, filterText, space }: { ctx: Ctx; filterText: string; space: Space | null }) {
  const sm = useSummary() // KPI group A — same summary every dashboard uses
  const [n, setN] = useState(10)
  const nav = useNavigate()
  const list = useIdeaList()
  const onRow = (r: BRow, title: string) => {
    if (r.drill && Object.keys(r.drill).length && !r.ideas) return nav(ideasUrl(r.drill))
    if (r.ideas) return list.show(title, r.ideas.filter(nonDraft), r.drill ? ideasUrl(r.drill) : undefined)
    if (r.drill) nav(ideasUrl(r.drill))
  }
  const spaces = space ? [space] : SPACE_ORDER
  const total = new Set(spaces.flatMap((s) => kpisOf(s).map((k) => k.id))).size
  const doExport = (kind: 'excel' | 'pdf') => {
    const rows = spaces.flatMap((sp) => kpisOf(sp).map((m) => {
      const d = DEFS.find((x) => x.id === m.id)!
      const h = d.head(ctx, m.id[0] === 'A' ? sm : ctx.sum, n, sp)
      const v = h.v == null || isNaN(h.v) ? '—' : h.kind === 'money' ? inrShort(h.v) : h.kind === 'pct' ? pct(h.v, h.digits ?? 1) : h.kind === 'days' ? `${num(h.v, 1)} days` : num(h.v, h.digits ?? 0)
      return { space: sp, id: m.id, group: m.group, kpi: m.kpi, value: v, raw: h.v, formula: m.formula, cut: m.cut }
    }))
    const name = `COIN_KPI_library_${space ?? 'all'}_${ctx.fy}`
    if (kind === 'excel') exportExcel(name, [{ name: 'KPI library', rows: rows.map((r) => ({ Workspace: SPACE_META[r.space].name, ID: r.id, Group: r.group, KPI: r.kpi, Value: r.value, 'Raw value': isFinite(r.raw) ? +r.raw.toFixed(4) : '', 'Formula / definition': r.formula, 'Cut by': r.cut })) }, { name: 'Filters', rows: [{ 'Active filters': filterText }] }])
    else exportPdf({ filename: name, title: `KPI library - ${space ? SPACE_META[space].name : 'all workspaces'}`, subtitle: pdfText(space ? KPI_INTRO_BY_SPACE[space] : 'Cost Optimisation and Innovation Network KPIs'), filters: pdfText(filterText), sections: spaces.flatMap((sp) => [...new Set(kpisOf(sp).map((k) => k.group))].map((g) => ({ title: pdfText(`${sp} · ${g}`), head: ['ID', 'KPI', 'Value', 'Formula / definition', 'Cut by'], body: rows.filter((r) => r.space === sp && r.group === g).map((r) => [r.id, r.kpi, r.value, r.formula, r.cut].map(pdfText)) }))) })
  }
  return (
    <div className="grid gap-3">
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[280px]">
          <div className="text-[13px] font-semibold text-ink">{space ? KPI_INTRO_BY_SPACE[space] : `${total} KPIs across both workspaces. Cost Optimisation KPIs measure execution and realisation; Innovation Network KPIs measure the idea network.`}</div>
          <div className="text-[11.5px] text-muted mt-1">Every value is computed live for the filters above; click a row to open the ideas behind it.</div>
        </div>
        <Button size="sm" icon="FileSpreadsheet" onClick={() => doExport('excel')}>Excel</Button>
        <Button size="sm" icon="FileText" onClick={() => doExport('pdf')}>PDF</Button>
      </div>
      {spaces.map((sp) => {
        const kp = kpisOf(sp)
        const groups = [...new Set(kp.map((k) => k.group))]
        return (
          <div key={sp} className="grid gap-3">
            {!space && <SpaceHeading space={sp} count={kp.length} />}
            {groups.map((g) => (
              <section key={g}>
                <div className="flex items-baseline gap-2 mb-2 mt-1">
                  <h3 className="text-[13.5px] font-bold text-ink flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GROUP_COLOR[g[0]] }} />{g}</h3>
                  <span className="text-[12px] text-muted">{g[0] === 'A' ? (sp === 'IN' ? 'Savings value waiting in the pipeline' : 'Savings committed, realised and carried over') : GROUP_NOTE[g[0]]}</span>
                </div>
                <Stagger className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3')}>
                  {kp.filter((k) => k.group === g).map((m) => DEFS.find((d) => d.id === m.id)!).map((d) => <KpiTile key={d.id} def={d} ctx={ctx} sm={g[0] === 'A' ? sm : ctx.sum} onRow={onRow} n={n} setN={setN} space={sp} />)}
                </Stagger>
              </section>
            ))}
          </div>
        )
      })}
      {list.el}
    </div>
  )
}

/** Section heading for a workspace when MIS shows both (no workspace chosen yet) */
export function SpaceHeading({ space, count, unit = 'KPIs' }: { space: Space; count: number; unit?: string }) {
  const m = SPACE_META[space]
  return (
    <div className="flex items-center gap-2.5 pt-2 pb-1.5 border-b border-line min-w-0">
      <span className="h-6 px-2 rounded-md text-[11px] font-extrabold grid place-items-center border shrink-0" style={{ color: m.color, borderColor: `${m.color}40`, background: `${m.color}10` }}>{space}</span>
      <h2 className="text-[15px] font-bold text-ink shrink-0">{m.name}</h2>
      <span className="text-[12px] text-muted shrink-0">· {count} {unit}</span>
      <span className="hidden xl:inline text-[12px] text-muted truncate min-w-0">· {m.tagline}</span>
    </div>
  )
}
