// Live stage tracker — the six workflow stages (Idea submitted → … → Implemented) with dates, who acted and remarks (Section 14).
import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { AgeBadge, Icon, SlaPill, Tooltip, cn } from '../../components/ui'
import { BUCKET_STYLE, bucketFor, slaStatus, stageAgeDays } from '../../lib/calc'
import { STAGE, STAGE_SHORT } from '../../lib/masters'
import { daysBetween, fmtDate, todayIso } from '../../lib/format'
import { stagesOf } from './model'

type NodeState = 'done' | 'current' | 'future' | 'failed' | 'skipped' | 'bypassed' | 'terminal'
interface TNode { key: string; label: string; short: string; state: NodeState; enteredAt?: string; exitedAt?: string; by?: string; action?: string; remarks?: string; color: string }

function buildNodes(idea: Idea): TNode[] {
  const stages = stagesOf(idea)
  const terminal = idea.stage === 'Dropped' || idea.stage === 'Rejected'
  const draft = idea.stage === 'Draft'
  const cur = terminal ? idea.dropStage ?? '' : idea.stage
  const ci = draft ? -1 : stages.indexOf(cur)
  const hist = (s: string) => [...idea.stageHistory].reverse().find((h) => h.stage === s)
  const nodes: TNode[] = [{
    key: '__submitted', label: draft ? 'Draft' : STAGE.submitted, short: draft ? 'Draft' : STAGE.submitted, state: draft ? 'current' : 'done',
    enteredAt: draft ? idea.createdAt : idea.submittedAt ?? idea.createdAt, by: idea.submitterName, action: draft ? 'Draft saved' : 'Idea submitted',
    color: draft ? BUCKET_STYLE.Draft.color : BUCKET_STYLE.Pipeline.color,
  }]
  stages.forEach((s, k) => {
    const h = hist(s)
    let state: NodeState
    if (idea.stage === 'Implemented') state = 'done'
    else if (terminal) state = k < ci ? 'done' : k === ci ? 'failed' : 'skipped'
    else state = k < ci ? 'done' : k === ci ? 'current' : 'future'
    if (state === 'done' && !h) state = 'bypassed'
    const bucket = bucketFor(idea.route, s)
    const exit = s === 'Implemented' ? undefined : h?.exitedAt
    nodes.push({
      key: s, label: s, short: STAGE_SHORT[s] ?? s, state, enteredAt: s === 'Implemented' ? idea.execution?.effectiveDate ?? idea.implementedAt ?? h?.enteredAt : h?.enteredAt, exitedAt: exit,
      by: h?.by, action: s === 'Implemented' && idea.stage === 'Implemented' ? 'Marked Done' : h?.action, remarks: h?.remarks, color: BUCKET_STYLE[bucket].color,
    })
  })
  if (terminal) {
    const h = hist(idea.stage)
    nodes.push({ key: '__terminal', label: idea.stage, short: idea.stage, state: 'terminal', enteredAt: idea.droppedAt ?? h?.enteredAt, by: h?.by, action: idea.dropReason, remarks: idea.dropRemarks, color: idea.stage === 'Rejected' ? '#e0364f' : '#6b7280' })
  }
  return nodes
}

function Circle({ n, index, size = 32 }: { n: TNode; index: number; size?: number }) {
  const base = 'relative grid place-items-center rounded-full shrink-0 transition-all'
  const s = { width: size, height: size }
  if (n.state === 'done') return <span className={base} style={{ ...s, background: n.color, color: '#fff', boxShadow: `0 4px 12px -4px ${n.color}aa` }}><Icon name="Check" size={size * 0.5} strokeWidth={3} /></span>
  if (n.state === 'current') return (
    <span className={base} style={{ ...s, background: '#fff', border: `2.5px solid ${n.color}` }}>
      <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: n.color }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.color }} />
    </span>
  )
  if (n.state === 'failed') return <span className={base} style={{ ...s, background: '#e0364f', color: '#fff' }}><Icon name="X" size={size * 0.5} strokeWidth={3} /></span>
  if (n.state === 'terminal') return <span className={base} style={{ ...s, background: n.color, color: '#fff' }}><Icon name="Ban" size={size * 0.5} /></span>
  if (n.state === 'bypassed') return <span className={base} style={{ ...s, background: '#fff', border: `2px dashed ${n.color}`, color: n.color }}><Icon name="SkipForward" size={size * 0.42} /></span>
  return <span className={cn(base, 'bg-white border-2 border-slate-200 text-slate-400 text-[11px] font-bold')} style={s}>{index}</span>
}

function dateLine(n: TNode) {
  if (n.state === 'future' || n.state === 'skipped') return n.state === 'skipped' ? 'Not reached' : 'Pending'
  if (n.state === 'bypassed') return 'Skipped'
  if (!n.enteredAt) return '—'
  if (n.exitedAt) return `${fmtDate(n.enteredAt.slice(0, 10)).slice(0, 6)} → ${fmtDate(n.exitedAt.slice(0, 10)).slice(0, 6)}`
  return fmtDate(n.enteredAt.slice(0, 10))
}
function detail(n: TNode) {
  const days = n.enteredAt ? daysBetween(n.enteredAt.slice(0, 10), (n.exitedAt ?? todayIso()).slice(0, 10)) : null
  return (
    <div className="space-y-0.5">
      <div className="font-semibold">{n.label}</div>
      {n.enteredAt && <div>Entered {fmtDate(n.enteredAt.slice(0, 10))}{n.exitedAt ? ` · exited ${fmtDate(n.exitedAt.slice(0, 10))}` : ''}</div>}
      {days != null && n.state !== 'terminal' && n.key !== '__submitted' && <div>{days} day{days === 1 ? '' : 's'} in stage</div>}
      {n.by && <div>By {n.by}{n.action ? ` · ${n.action}` : ''}</div>}
      {!n.by && n.action && <div>{n.action}</div>}
      {n.remarks && <div className="text-muted italic">“{n.remarks}”</div>}
      {n.state === 'future' && <div className="text-muted">Not started</div>}
    </div>
  )
}

export function StageTracker({ idea, compact }: { idea: Idea; compact?: boolean }) {
  const slaRules = useStore((s) => s.slaRules)
  const nodes = useMemo(() => buildNodes(idea), [idea])
  const sla = slaStatus(idea, slaRules)
  const age = stageAgeDays(idea)
  const live = idea.bucket === 'Pipeline' || idea.bucket === 'In Execution' || idea.bucket === 'Draft'
  const lastReached = nodes.reduce((a, n, k) => (n.state === 'done' || n.state === 'current' || n.state === 'failed' || n.state === 'terminal' || n.state === 'bypassed' ? k : a), 0)
  const progress = nodes.length > 1 ? lastReached / (nodes.length - 1) : 0
  const minW = compact ? 74 : 104
  const n = nodes.length

  return (
    <div className="min-w-0">
      {/* horizontal stepper (≥ sm) */}
      <div className="hidden sm:block overflow-x-auto no-scrollbar pb-1">
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(${minW}px, 1fr))`, minWidth: n * minW }}>
          <div className="absolute h-[3px] rounded-full bg-slate-100" style={{ top: compact ? 13 : 15, left: `calc(100% / ${n} / 2)`, right: `calc(100% / ${n} / 2)` }}>
            <motion.div className="h-full rounded-full origin-left" style={{ background: 'linear-gradient(90deg, #4470d6, #ec8a1c 70%, #0f9f6e)' }}
              initial={{ scaleX: 0 }} animate={{ scaleX: progress }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          {nodes.map((node, k) => (
            <div key={node.key} className="relative flex flex-col items-center text-center px-1 min-w-0">
              <Tooltip content={detail(node)}>
                <span className="cursor-default"><Circle n={node} index={k} size={compact ? 28 : 32} /></span>
              </Tooltip>
              <div className={cn('mt-1.5 font-semibold leading-tight', compact ? 'text-[11px]' : 'text-[12px]', node.state === 'future' || node.state === 'skipped' ? 'text-muted' : 'text-ink')}>
                {compact ? node.short : node.label}
              </div>
              <div className={cn('text-muted num', compact ? 'text-[10.5px]' : 'text-[11px]')}>{dateLine(node)}</div>
              {!compact && node.by && node.state !== 'future' && <div className="text-[11px] text-ink-2 truncate max-w-full">{node.by}</div>}
              {!compact && node.remarks && (node.state === 'done' || node.state === 'terminal') && <div className="text-[10.5px] text-muted italic truncate max-w-full" title={node.remarks}>“{node.remarks}”</div>}
              {node.state === 'current' && live && (
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  <AgeBadge days={age} />
                  {sla.state !== 'none' && <SlaPill state={sla.state} left={sla.left} working={sla.working} />}
                </div>
              )}
              {node.state === 'terminal' && !compact && node.action && <div className="mt-1 text-[10.5px] font-semibold text-red-600 leading-tight">{node.action}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* vertical stepper (mobile) */}
      <ol className="sm:hidden">
        {nodes.map((node, k) => (
          <li key={node.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Circle n={node} index={k} size={26} />
              {k < nodes.length - 1 && <span className="w-[2px] flex-1 min-h-3 my-0.5 rounded" style={{ background: k < lastReached ? node.color : '#e5e7eb' }} />}
            </div>
            <div className="min-w-0 pb-3">
              <div className={cn('text-[12.5px] font-semibold leading-tight', node.state === 'future' || node.state === 'skipped' ? 'text-muted' : 'text-ink')}>{node.label}</div>
              <div className="text-[11.5px] text-muted">{dateLine(node)}{node.by && node.state !== 'future' ? ` · ${node.by}` : ''}</div>
              {node.remarks && <div className="text-[11px] text-muted italic">“{node.remarks}”</div>}
              {node.state === 'terminal' && node.action && <div className="text-[11px] font-semibold text-red-600">{node.action}</div>}
              {node.state === 'current' && live && (
                <div className="mt-1 flex flex-wrap gap-1"><AgeBadge days={age} />{sla.state !== 'none' && <SlaPill state={sla.state} left={sla.left} working={sla.working} />}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** SLA summary for the current stage (card header) */
export function CurrentStageSla({ idea }: { idea: Idea }) {
  const slaRules = useStore((s) => s.slaRules)
  const sla = slaStatus(idea, slaRules)
  if (sla.state === 'none' || idea.bucket !== 'Pipeline') return null
  return (
    <Tooltip content={<div><div className="font-semibold">{sla.key} SLA · {sla.sla} working days</div><div>Reminder on day {sla.rule?.reminderDay}; escalates to {sla.rule?.escalateTo} on day {sla.rule?.escalateDay}.</div><div>{sla.working} working day{sla.working === 1 ? '' : 's'} elapsed.</div></div>}>
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">Current-stage SLA <SlaPill state={sla.state} left={sla.left} working={sla.working} /></span>
    </Tooltip>
  )
}
