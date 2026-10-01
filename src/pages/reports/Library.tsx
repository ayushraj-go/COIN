// MIS report library for the current workspace (CO or IN); with no workspace chosen, both libraries in CO → IN order
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Icon, SpotlightCard, Stagger } from '../../components/ui'
import { REPORTS_NOTE } from '../../lib/scope'
import { LEVER_GROUP_STYLE } from '../../lib/masters'
import { HEALTH_STYLE, BUCKET_STYLE } from '../../lib/calc'
import { inrShort, pct } from '../../lib/format'
import type { Idea, LeverGroup } from '../../lib/types'
import {
  type Ctx, homeData, bridgeData, commodityRows, buyerRows, supplierRows, leverData, executionData, dropData, ageingData, campaignRows, leakageData, closureData, nonDraft,
} from './model'
import { MiniBars, MiniHBars, MiniDonut, FREQ_STYLE } from './chartkit'
import { type Space, type MisReport, MIS_REPORTS, SPACE_ORDER, LIB_INTRO_BY_SPACE } from './space'
import { SpaceHeading } from './KpiLibrary'

export const REPORT_ICON: Record<string, string> = {
  home: 'LayoutDashboard', bridge: 'ChartColumnStacked', commodity: 'Boxes', buyer: 'UserRoundCheck', supplier: 'Factory', lever: 'SlidersHorizontal',
  execution: 'Rocket', drops: 'CircleX', ageing: 'Hourglass', campaign: 'Megaphone', leakage: 'Droplets', closure: 'CalendarCheck2',
}

type Preview = { visual: React.ReactNode; stat: string; statLabel: string; color?: string }

function usePreviews(ctx: Ctx) {
  return useMemo(() => {
    const s = ctx.sum
    const home = homeData(ctx)
    const b = bridgeData(ctx)
    const comm = commodityRows(ctx)
    const buyers = buyerRows(ctx)
    const sup = supplierRows(ctx)
    const lev = leverData(ctx)
    const ex = executionData(ctx)
    const dr = dropData(ctx)
    const ag = ageingData(ctx)
    const cam = campaignRows(ctx)
    const lk = leakageData(ctx)
    const cl = closureData(ctx)
    const co: Record<string, Preview> = {
      home: { visual: <MiniBars width={130} height={52} data={home.trend.map((m) => (m.future ? 0 : m.realised))} color="#0f9f6e" gap={2} />, stat: inrShort(s.realisedCounting), statLabel: 'realised FY to date', color: '#0f9f6e' },
      bridge: { visual: <MiniBars width={130} height={52} data={b.rows.map((r) => r.value)} colors={b.rows.map((r) => r.color)} gap={6} />, stat: inrShort(b.total), statLabel: 'realised + committed + pipeline' },
      commodity: { visual: <MiniBars width={130} height={52} data={comm.map((r) => r.realised)} color="#0f9f6e" gap={2} />, stat: `${comm.filter((r) => r.realised > 0).length} / ${comm.length}`, statLabel: 'commodities with realised saving' },
      buyer: { visual: <MiniHBars width={130} rowH={6} gap={4} data={buyers.slice(0, 6).map((r) => ({ v: r.realised, max: Math.max(1, ...buyers.map((x) => x.realised)), color: '#0f9f6e' }))} />, stat: inrShort(buyers.reduce((a, r) => a + r.overdueValue, 0)), statLabel: 'overdue across buyers', color: '#e0364f' },
      lever: { visual: <MiniDonut size={58} stroke={10} parts={lev.groups.map((g) => ({ v: g.realised, color: LEVER_GROUP_STYLE[g.group as LeverGroup]?.color ?? '#94a3b8' }))} label={pct(lev.structuralShare, 0)} />, stat: pct(lev.structuralShare), statLabel: 'structural share', color: lev.flag ? '#e0364f' : '#4f46e5' },
      execution: { visual: <MiniDonut size={58} stroke={10} parts={ex.health.map((h) => ({ v: h.items.length, color: HEALTH_STYLE[h.health].color }))} label={ex.inExec.length} />, stat: String(ex.overdue.length), statLabel: 'overdue · past due date', color: ex.overdue.length ? '#e0364f' : '#0f9f6e' },
      leakage: { visual: <MiniBars width={130} height={52} data={lk.monthly.map((m) => m.realised)} color="#0f9f6e" gap={4} />, stat: inrShort(lk.leakage), statLabel: 'price leakage', color: '#e0364f' },
      closure: { visual: <MiniDonut size={58} stroke={10} parts={[{ v: cl.inFy, color: '#ec8a1c' }, { v: cl.carry, color: '#4f46e5' }]} />, stat: inrShort(cl.carry), statLabel: `carry-over into ${cl.next}`, color: '#4f46e5' },
    }
    const subN = (ideas: Idea[]) => ideas.filter(nonDraft).length
    const inn: Record<string, Preview> = {
      home: { visual: <MiniDonut size={58} stroke={10} parts={(['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const).map((k) => ({ v: s.counts[k], color: BUCKET_STYLE[k].color }))} label={ctx.ideas.length} />, stat: inrShort(s.pipeline), statLabel: `pipeline · ${s.counts.Pipeline} ideas`, color: '#1e3a5f' },
      commodity: { visual: <MiniBars width={130} height={52} data={comm.map((r) => r.submitted)} color="#4470d6" gap={2} />, stat: String(comm.reduce((a, r) => a + r.submitted, 0)), statLabel: `ideas across ${comm.length} commodities` },
      buyer: { visual: <MiniHBars width={130} rowH={6} gap={4} data={buyers.slice(0, 6).map((r) => ({ v: subN(r.ideas), max: Math.max(1, ...buyers.map((x) => subN(x.ideas))), color: '#4470d6' }))} />, stat: String(buyers.reduce((a, r) => a + r.breaches, 0)), statLabel: 'ideas beyond SLA', color: buyers.some((r) => r.breaches) ? '#e0364f' : '#0f9f6e' },
      supplier: { visual: <MiniBars width={130} height={52} data={sup.slice(0, 12).map((r) => r.value)} color="#0d9488" gap={2} />, stat: String(sup.reduce((a, r) => a + r.supplierSubmitted, 0)), statLabel: 'supplier-submitted ideas' },
      drops: { visual: <MiniBars width={130} height={52} data={dr.months.map((m) => m.total)} color="#6b7280" gap={2} />, stat: pct(dr.rate), statLabel: `drop rate · ${dr.dropped.length} ideas` },
      ageing: { visual: <MiniHBars width={130} rowH={6} gap={4} data={ag.byStage.map((st) => ({ v: st.breach + st.escalated, max: Math.max(1, ...ag.byStage.map((x) => x.total)), color: '#e0364f' }))} />, stat: String(ag.breached.length), statLabel: 'ideas beyond SLA', color: ag.breached.length ? '#e0364f' : '#0f9f6e' },
      campaign: { visual: <MiniHBars width={130} rowH={6} gap={4} data={cam.slice(0, 6).map((c) => ({ v: c.ideas, max: Math.max(1, ...cam.map((x) => x.ideas)), color: '#db2777' }))} />, stat: String(cam.reduce((a, c) => a + c.ideas, 0)), statLabel: `ideas from ${cam.length} campaigns` },
    }
    return { CO: co, IN: inn } as Record<Space, Record<string, Preview>>
  }, [ctx])
}

/** Link to a report; with no workspace chosen the link carries the view so scorecards open the right variant */
export const reportHref = (r: MisReport, space: Space | null) => `/reports/${r.key}${space ? '' : `?view=${r.space}`}`

export default function Library({ ctx, space }: { ctx: Ctx; space: Space | null }) {
  const nav = useNavigate()
  const prev = usePreviews(ctx)
  const spaces = space ? [space] : SPACE_ORDER
  const all = spaces.flatMap((s) => MIS_REPORTS[s])
  return (
    <div className="grid gap-3">
      <div className="card rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-line text-ink-2 grid place-items-center shrink-0"><Icon name="LibraryBig" size={19} /></div>
        <div className="flex-1 min-w-[260px]">
          <div className="text-[13.5px] font-semibold text-ink">{space ? LIB_INTRO_BY_SPACE[space] : 'No workspace chosen yet, so MIS shows both libraries: Cost Optimisation (execution and realisation) first, then Innovation Network (ideas and the network).'}</div>
          <div className="text-[12px] text-muted mt-0.5">{REPORTS_NOTE}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">{Object.entries(FREQ_STYLE).map(([f, c]) => { const n = all.filter((r) => r.frequency === f).length; return n ? <Badge key={f} color={c} dot>{f} · {n}</Badge> : null })}</div>
      </div>
      {spaces.map((sp) => (
        <div key={sp} className="grid gap-3">
          {!space && <SpaceHeading space={sp} count={MIS_REPORTS[sp].length} unit="reports" />}
          <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {MIS_REPORTS[sp].map((r) => {
              const p = prev[sp][r.key]
              return (
                <SpotlightCard key={`${sp}-${r.key}`} onClick={() => nav(reportHref(r, space))} color="rgb(15 23 42 / .05)" className="rounded-2xl h-full">
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 text-ink-2 grid place-items-center border border-line"><Icon name={REPORT_ICON[r.key]} size={18} /></div>
                        <span className="absolute -top-1.5 -left-1.5 h-5 min-w-5 px-1 rounded-full bg-white border border-gold-200 text-gold-700 text-[10px] font-extrabold grid place-items-center shadow-sm">{r.n}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-ink leading-tight">{r.name}</div>
                        <div className="flex items-center gap-1 text-[11.5px] text-muted mt-0.5"><Icon name="Users" size={12} />{r.audience}</div>
                      </div>
                      <Badge color={FREQ_STYLE[r.frequency] ?? '#64748b'} dot className="shrink-0">{r.frequency}</Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 rounded-xl bg-slate-50/80 border border-slate-100 px-3 py-2.5 min-h-[78px]">
                      <div className="min-w-0">
                        <div className="text-[19px] font-bold num leading-none" style={{ color: p.color ?? '#1e3a5f' }}>{p.stat}</div>
                        <div className="text-[11px] text-muted mt-1 leading-tight">{p.statLabel}</div>
                      </div>
                      <div className="shrink-0">{p.visual}</div>
                    </div>
                    <div className="mt-2.5 text-[11.5px] text-ink-2 leading-snug flex-1"><span className="font-semibold text-muted">Key visuals · </span>{r.visuals}</div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 text-muted"><Icon name="FileSpreadsheet" size={13} />Excel<Icon name="FileText" size={13} />PDF</span>
                      <span className="font-semibold text-ink-2 flex items-center gap-1">Open report <Icon name="ArrowRight" size={13} /></span>
                    </div>
                  </div>
                </SpotlightCard>
              )
            })}
          </Stagger>
        </div>
      ))}
    </div>
  )
}
