// Technical Evaluator home (one screen at xl) — KPIs, ideas routed to my department awaiting evaluation (with SLA), my evaluated ideas, ideas I submitted
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useMe } from '../../store/useStore'
import { EVALUATION_STAGES, LEVER_GROUP_STYLE } from '../../lib/masters'
import { BUCKET_STYLE, ideaAnnualised, slaStatus } from '../../lib/calc'
import { fmtDate, inrShort, pct, sum, workingDaysBetween } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Icon, InfoTip, LeverChip, SlaPill, useWarmup } from '../../components/ui'
import { HomeHeader, HomeSkeleton, MiniStat, Reveal, RevealGrid, SLA_RANK, StageTrackerMini, useDrill } from './shared'
import { useFitHeight, useRowsFit } from './fit'

export default function EvaluatorHome() {
  const ready = useWarmup(320)
  const me = useMe()!
  const { ideas, slaRules, levers, openIdea } = useStore()
  const nav = useNavigate()
  const drill = useDrill()
  const rule = slaRules.find((r) => r.stage === 'Technical evaluation')
  const [fitRef, fitH] = useFitHeight()

  const awaiting = useMemo(() => ideas
    .filter((i) => EVALUATION_STAGES.includes(i.stage) && i.techEval && !i.techEval.decision && i.techEval.evaluatorDept.includes(me.department))
    .map((i) => ({ i, sla: slaStatus(i, slaRules) }))
    .sort((a, b) => (SLA_RANK[b.sla.state] ?? 0) - (SLA_RANK[a.sla.state] ?? 0) || a.sla.left - b.sla.left), [ideas, slaRules, me.department])
  const evaluated = useMemo(() => ideas.filter((i) => i.techEval?.decision && i.techEval.by === me.name).sort((a, b) => (b.techEval!.at ?? '').localeCompare(a.techEval!.at ?? '')), [ideas, me.name])
  const mine = ideas.filter((i) => i.submitterId === me.id && i.stage !== 'Draft')
  const [awRef, awRows] = useRowsFit(58, 5, 2, awaiting.length)
  const [evRef, evRows] = useRowsFit(50, 7, 2, evaluated.length)
  const [mineRef, mineRows] = useRowsFit(50, 5, 1, mine.length)
  const breached = awaiting.filter((a) => a.sla.state === 'breach' || a.sla.state === 'escalated').length
  const goRate = evaluated.length ? (evaluated.filter((i) => i.techEval!.decision === 'Go').length / evaluated.length) * 100 : 0
  const turnaround = (() => {
    const days = evaluated.map((i) => {
      const h = i.stageHistory.find((x) => EVALUATION_STAGES.includes(x.stage))
      return h && i.techEval?.at ? workingDaysBetween(h.enteredAt.slice(0, 10), i.techEval.at.slice(0, 10)) : null
    }).filter((x): x is number => x != null)
    return days.length ? sum(days) / days.length : 0
  })()

  if (!ready) return <HomeSkeleton variant="people" />
  return (
    <div>
      <HomeHeader />
      <div ref={fitRef} style={fitH ? { height: fitH } : undefined}>
        <RevealGrid className="h-full grid grid-cols-12 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]">
          <Reveal className="col-span-12">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <MiniStat label="Awaiting evaluation" icon="FlaskConical" color="#2f5bc6" value={awaiting.length} sub={<>{inrShort(sum(awaiting.map((a) => ideaAnnualised(a.i))))} annualised at stake</>} />
              <MiniStat label="Beyond SLA" icon="Siren" color={breached ? '#e0364f' : '#0f9f6e'} value={breached} sub={rule ? `SLA ${rule.slaDays} working days · escalation day ${rule.escalateDay}` : 'Stage SLA'} />
              <MiniStat label="Evaluated by me" icon="ClipboardCheck" color="#0d9488" value={evaluated.length} sub={`${evaluated.filter((i) => i.techEval!.decision === 'Go').length} go · ${evaluated.filter((i) => i.techEval!.decision === 'No-go').length} no-go`} />
              <MiniStat label="Go rate" icon="CircleCheckBig" color="#0f9f6e" value={evaluated.length ? pct(goRate, 0) : '—'} sub="Go ÷ evaluated" />
              <MiniStat label="Avg turnaround" icon="Timer" color="#ec8a1c" value={turnaround ? `${turnaround.toFixed(1)} d` : '—'} sub="Working days, stage entry → decision" tip={<InfoTip title="C3 · Stage bottleneck" formula="Avg days per stage (R&D, NPD sample, PAP)">Measured on your decisions.</InfoTip>} />
            </div>
          </Reveal>

          {/* Awaiting evaluation — the main queue */}
          <Reveal className="col-span-12 xl:col-span-5 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="Inbox"
              title={<span className="flex items-center gap-1.5">Routed to {me.department} — awaiting evaluation<InfoTip title="Technical evaluation">Technical go / no-go and validation plan. Reminder on day {rule?.reminderDay ?? 8}; escalation to {rule?.escalateTo ?? "Evaluator's HOD + Commodity Lead"} on day {rule?.escalateDay ?? 11}.</InfoTip></span>}
              subtitle="Sorted by SLA urgency · click to review in the side panel"
              actions={awaiting.length ? <Badge color={breached ? '#e0364f' : '#4470d6'} dot>{awaiting.length}</Badge> : undefined}>
              <div ref={awRef} className="flex-1 min-h-0 overflow-hidden">
                {awaiting.length ? awaiting.slice(0, awRows).map(({ i, sla }) => {
                  const lever = levers.find((l) => l.id === i.leverId)
                  const g = lever ? LEVER_GROUP_STYLE[lever.group] : null
                  return (
                    <button key={i.id} onClick={() => openIdea(i.id)} title={`${i.techEval!.evaluatorDept} · ${sla.working} working days in stage`} className="group w-full h-[58px] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                      <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0" style={{ background: g?.soft, color: g?.color }}><Icon name={lever?.icon ?? 'FlaskConical'} size={16} /></span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 min-w-0"><span className="font-mono text-[10.5px] text-muted shrink-0">{i.id}</span><span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title}</span></span>
                        <span className="flex items-center gap-2 mt-1 min-w-0 overflow-hidden"><LeverChip leverId={i.leverId} compact /><span className="text-[11px] text-muted truncate">{i.stage} · {sla.working} wd in stage</span></span>
                      </span>
                      <span className="flex flex-col items-end gap-1"><SlaPill state={sla.state} left={sla.left} working={sla.working} /><span className="text-[12px] font-bold text-ink num">{inrShort(ideaAnnualised(i))}</span></span>
                    </button>
                  )
                }) : <EmptyState icon="CheckCheck" title={`Nothing waiting for ${me.department}`} desc="Ideas routed to your department by lever appear here with their SLA timer." className="py-6" />}
                {awaiting.length > awRows && <div className="h-7 flex items-center text-[11.5px] font-semibold text-muted">+ {awaiting.length - awRows} more awaiting</div>}
              </div>
              <div className="shrink-0 mt-2 pt-3 border-t border-line">
                <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted"><span className="flex items-center gap-1 shrink-0"><Icon name="Timer" size={12} />Evaluation SLA</span><span className="normal-case font-medium truncate">{rule ? `${rule.slaDays} working days · reminder day ${rule.reminderDay} · ${rule.escalateTo} on day ${rule.escalateDay}` : ''}</span></div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {([['ok', 'Within SLA', '#0f9f6e'], ['due', 'Reminder due', '#ec8a1c'], ['breach', 'Breached', '#e0364f'], ['escalated', 'Escalated', '#a3143a']] as const).map(([k, l, c]) => {
                    const n = awaiting.filter((a) => a.sla.state === k).length
                    return <div key={k} className="rounded-lg border border-line bg-slate-50/60 px-2.5 py-1.5"><div className="text-[17px] font-bold num leading-none" style={{ color: n ? c : '#cbd5e1' }}>{n}</div><div className="text-[10.5px] text-muted mt-1 truncate">{l}</div></div>
                  })}
                </div>
              </div>
            </Card>
          </Reveal>

          {/* My decisions */}
          <Reveal className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="History" title="My evaluated ideas" subtitle="Your go / no-go decisions and where each idea is now">
              <div ref={evRef} className="flex-1 min-h-0 overflow-hidden">
                {evaluated.length ? evaluated.slice(0, evRows).map((i) => (
                  <button key={i.id} onClick={() => openIdea(i.id)} className="group w-full h-[50px] flex items-center gap-2.5 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                    <Badge color={i.techEval!.decision === 'Go' ? '#0f9f6e' : '#e0364f'} icon={i.techEval!.decision === 'Go' ? 'Check' : 'X'}>{i.techEval!.decision}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title}</span>
                      <span className="flex items-center gap-2 mt-0.5 min-w-0"><StageTrackerMini idea={i} className="shrink-0" /><span className="text-[11px] text-muted truncate">{i.stage} · {fmtDate(i.techEval!.at?.slice(0, 10))}</span></span>
                    </span>
                    <span className="text-[12px] font-bold text-ink num shrink-0">{inrShort(ideaAnnualised(i))}</span>
                  </button>
                )) : <EmptyState icon="FlaskConical" title="No decisions recorded yet" desc="Once you give a go / no-go with a validation plan, the idea appears here with its live status." className="py-6" />}
                {evaluated.length > evRows && <div className="h-7 flex items-center text-[11.5px] font-semibold text-muted">+ {evaluated.length - evRows} earlier decisions</div>}
              </div>
            </Card>
          </Reveal>

          {/* Ideas I submitted */}
          <Reveal className="col-span-12 md:col-span-6 xl:col-span-3 min-h-0">
            <Card className="flex-1 min-h-0" bodyClass="flex flex-col" icon="Lightbulb" title="Ideas I submitted" subtitle={`${mine.length} submitted · ${inrShort(sum(mine.map((x) => ideaAnnualised(x))))} annualised`}
              actions={<Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={() => drill({}, '/my-ideas', false)}>All</Button>}>
              {mine.length ? (
                <>
                  <div ref={mineRef} className="flex-1 min-h-0 overflow-hidden">
                    {mine.slice(0, mineRows).map((i) => (
                      <button key={i.id} onClick={() => openIdea(i.id)} className="group w-full h-[50px] flex flex-col justify-center gap-1 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5">
                        <span className="flex items-center justify-between gap-2 min-w-0"><span className="text-[12.5px] font-semibold text-ink truncate group-hover:text-brand-700">{i.title}</span><span className="text-[12px] font-bold text-ink num shrink-0">{inrShort(ideaAnnualised(i))}</span></span>
                        <span className="flex items-center gap-2 min-w-0"><StageTrackerMini idea={i} className="shrink-0" /><span className="text-[11px] text-muted truncate">{i.stage}</span></span>
                      </button>
                    ))}
                    {mine.length > mineRows && <button onClick={() => drill({}, '/my-ideas', false)} className="h-7 flex items-center text-left text-[11.5px] font-semibold text-muted hover:text-brand-700">+ {mine.length - mineRows} more</button>}
                  </div>
                  <div className="shrink-0 mt-2 pt-3 border-t border-line grid grid-cols-2 gap-2">
                    {(['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const).map((b) => {
                      const l = mine.filter((i) => i.bucket === b)
                      const st = BUCKET_STYLE[b]
                      return (
                        <button key={b} onClick={() => drill({ bucket: b }, '/my-ideas', false)} className="rounded-xl border px-2.5 py-1.5 text-left hover:-translate-y-0.5 transition-all min-w-0" style={{ borderColor: `${st.color}33`, background: st.soft }}>
                          <div className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: st.text }}>{b}</div>
                          <div className="flex items-baseline justify-between gap-1"><span className="text-[17px] font-bold text-ink num leading-tight">{l.length}</span><span className="text-[10.5px] text-muted num truncate">{inrShort(sum(l.map((x) => ideaAnnualised(x))))}</span></div>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : <EmptyState icon="Lightbulb" title={`No ideas yet from ${me.department}`} desc="Evaluators see the best engineering ideas first — share yours." action={<Button variant="primary" icon="CirclePlus" onClick={() => nav('/submit')}>Submit idea</Button>} className="flex-1 py-4" />}
            </Card>
          </Reveal>
        </RevealGrid>
      </div>
    </div>
  )
}
