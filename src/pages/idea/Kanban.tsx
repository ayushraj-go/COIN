// Kanban by stage group — HTML5 drag and drop, permission-checked, confirm prompt, undo (M2, Section 14).
import { useMemo, useState, type DragEvent } from 'react'
import { motion } from 'motion/react'
import type { Idea } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { AgeBadge, Avatar, Icon, LeverChip, RemarksModal, SlaPill, Tooltip, cn } from '../../components/ui'
import { BUCKET_STYLE } from '../../lib/calc'
import { can } from '../../lib/nav'
import { inrShort, sum } from '../../lib/format'
import { STAGE_GROUPS, kanbanMove, withUndo, type IdeaRow, type MoveResult, type StageGroup } from './model'
import { DropModal, MarkDoneModal } from './Modals'

function KanbanCard({ r, dragging, draggable, shakeKey, onDragStart, onDragEnd, onOpen }: {
  r: IdeaRow; dragging: boolean; draggable: boolean; shakeKey: number; onDragStart: (e: DragEvent) => void; onDragEnd: () => void; onOpen: () => void
}) {
  const owner = useStore((s) => s.users.find((u) => u.id === r.ownerId))
  const i = r.idea
  const live = i.bucket === 'Pipeline' || i.bucket === 'In Execution'
  const breach = r.sla.state === 'breach' || r.sla.state === 'escalated'
  return (
    <motion.div
      key={shakeKey}
      layout="position"
      initial={shakeKey ? { x: 0 } : { opacity: 0, y: 6 }}
      animate={shakeKey ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { opacity: 1, y: 0 }}
      transition={shakeKey ? { duration: 0.45 } : { duration: 0.25 }}
    >
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={cn(
          'group rounded-xl border bg-white p-2.5 shadow-[0_1px_2px_rgb(15_23_42/.05)] transition-all cursor-pointer select-none',
          'hover:shadow-[0_8px_20px_-10px_rgb(15_23_42/.3)] hover:-translate-y-px hover:border-slate-300',
          dragging ? 'opacity-40 ring-2 ring-brand-300' : 'border-line',
          breach && !dragging && 'border-l-[3px] border-l-red-500',
          draggable && 'active:cursor-grabbing',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10.5px] font-semibold text-muted truncate">{i.id}</span>
          <span className="flex items-center gap-1 shrink-0">
            {i.isSupplierSubmission && <Tooltip content={`Supplier idea · ${i.supplierCode}`}><Icon name="Factory" size={12} className="text-teal-600" /></Tooltip>}
            {i.infoRequested && <Tooltip content="More info requested"><Icon name="MessageCircleQuestion" size={12} className="text-amber-600" /></Tooltip>}
            {live && <AgeBadge days={r.age} />}
          </span>
        </div>
        <div className="mt-1 text-[12.5px] font-semibold text-ink leading-snug line-clamp-2" title={i.title}>{i.title}</div>
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          <LeverChip leverId={i.leverId} compact />
          {breach && <SlaPill state={r.sla.state} left={r.sla.left} working={r.sla.working} />}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn('text-[14px] font-bold num', r.annual < 0 ? 'text-red-600' : 'text-ink')}>
            {inrShort(r.annual)}{i.scope === 'Open' && <span className="ml-1 text-[10px] font-semibold text-amber-600 align-middle">EST.</span>}
          </span>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10.5px] text-muted truncate max-w-[90px]">{r.commodityName.split(' (')[0]}</span>
            {owner && <Avatar name={owner.name} color={owner.avatarColor} size={22} />}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export function KanbanBoard({ rows, draftCount = 0 }: { rows: IdeaRow[]; draftCount?: number }) {
  const me = useMe()
  const openIdea = useStore((s) => s.openIdea)
  const moveToStage = useStore((s) => s.moveToStage)
  const toast = useStore((s) => s.toast)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [shake, setShake] = useState<{ id: string; n: number }>({ id: '', n: 0 })
  const [pending, setPending] = useState<{ row: IdeaRow; group: StageGroup; stage: string; backward: boolean } | null>(null)
  const [dropFor, setDropFor] = useState<Idea | null>(null)
  const [doneFor, setDoneFor] = useState<Idea | null>(null)
  const canDrag = can(me, 'validate') || can(me, 'approve') || can(me, 'execute')

  const columns = useMemo(() => STAGE_GROUPS.map((g) => {
    const items = rows.filter((r) => g.stages.includes(r.idea.stage)).sort((a, b) => b.annual - a.annual)
    return { g, items, total: sum(items.map((r) => r.annual)) }
  }), [rows])
  const dragRow = dragId ? rows.find((r) => r.id === dragId) ?? null : null
  const validity = useMemo<Record<string, MoveResult>>(() => (dragRow ? Object.fromEntries(STAGE_GROUPS.map((g) => [g.key, kanbanMove(me, dragRow.idea, g.key)])) : {}), [dragRow, me])

  const handleDrop = (g: StageGroup) => {
    const id = dragId
    setDragId(null); setOver(null)
    const r = rows.find((x) => x.id === id)
    if (!r) return
    const res = kanbanMove(me, r.idea, g.key)
    if (res.ok === false) {
      if (res.same) return
      setShake((s) => ({ id: r.id, n: s.n + 1 }))
      toast(res.reason, 'error')
      return
    }
    if (res.kind === 'drop') setDropFor(r.idea)
    else if (res.kind === 'done') setDoneFor(r.idea)
    else setPending({ row: r, group: g, stage: res.stage, backward: res.backward })
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <Icon name={canDrag ? 'GripVertical' : 'Eye'} size={13} />
          {canDrag ? 'Drag a card to move it — each move is permission-checked and confirmed; click a card for the side panel' : 'Read-only board — stage moves need Buyer, Commodity Lead or Sourcing Head rights'}
        </span>
        {draftCount > 0 && <span className="flex items-center gap-1"><Icon name="PencilLine" size={12} />{draftCount} draft{draftCount === 1 ? '' : 's'} not shown on the board</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
        {columns.map(({ g, items, total }) => {
          const st = BUCKET_STYLE[g.bucket]
          const v = validity[g.key]
          const valid = !!dragRow && v?.ok === true
          const invalid = !!dragRow && v?.ok === false && !(v as any).same
          const isOver = over === g.key
          return (
            <section key={g.key}
              onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== g.key) setOver(g.key) }}
              onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver((o) => (o === g.key ? null : o)) }}
              onDrop={(e) => { e.preventDefault(); handleDrop(g) }}
              className={cn('snap-start shrink-0 w-[272px] rounded-2xl border flex flex-col transition-all', 'h-[calc(100vh-300px)] min-h-[440px]',
                isOver && valid ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-300/60' : isOver && invalid ? 'border-red-300 bg-red-50/60 ring-2 ring-red-200' : valid ? 'border-emerald-200 bg-emerald-50/25' : invalid ? 'border-line bg-slate-100/70 opacity-70' : 'border-line bg-slate-50/80')}>
              <header className="px-3 pt-2.5 pb-2 border-b border-line/70 rounded-t-2xl bg-white/70 backdrop-blur-sm" style={{ boxShadow: `inset 0 3px 0 ${st.color}` }}>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background: st.soft, color: st.color }}><Icon name={g.icon} size={13} /></span>
                  <span className="text-[12px] font-bold text-ink leading-tight line-clamp-2 flex-1 min-h-[30px] flex items-center" title={g.label}>{g.label}</span>
                  <span className="min-w-6 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center num" style={{ background: st.soft, color: st.text }}>{items.length}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{g.bucket}</span>
                  <span className="font-bold num text-ink-2">{inrShort(total)}</span>
                </div>
              </header>
              <div className="flex-1 p-2 space-y-2">
                  {items.map((r) => (
                    <KanbanCard key={r.id} r={r} dragging={dragId === r.id} draggable={canDrag}
                      shakeKey={shake.id === r.id ? shake.n : 0}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; setDragId(r.id) }}
                      onDragEnd={() => { setDragId(null); setOver(null) }}
                      onOpen={() => openIdea(r.id)} />
                  ))}
                {!items.length && (
                  <div className={cn('rounded-xl border-2 border-dashed text-center text-[11.5px] py-6 px-3', valid ? 'border-emerald-300 text-emerald-700' : 'border-slate-200 text-muted')}>
                    {valid ? <>Drop to move to<br /><b>{(v as any).stage}</b></> : 'No ideas at this stage'}
                  </div>
                )}
                {isOver && invalid && (v as any).reason && (
                  <div className="sticky bottom-0 rounded-lg bg-red-600 text-white text-[11px] font-medium px-2.5 py-1.5 shadow-lg">{(v as any).reason}</div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <RemarksModal open={!!pending} onClose={() => setPending(null)} required={!!pending?.backward} variant={pending?.backward ? 'danger' : 'primary'} icon="Kanban"
        confirmLabel={`Move to ${pending?.stage ?? ''}`} title="Confirm stage move"
        subtitle={pending ? `${pending.row.id} · ${pending.row.idea.stage} → ${pending.stage}${pending.backward ? ' — moving back needs remarks' : ''}` : ''}
        placeholder={pending?.backward ? 'Why is the idea moving back?' : 'Optional remarks for the audit trail'}
        onConfirm={(remarks) => {
          if (!pending) return
          const { row, stage } = pending
          withUndo(row.id, () => moveToStage(row.id, stage, remarks || undefined), `${row.id} moved to ${stage}`)
        }}>
        {pending && (
          <div className="mb-3 rounded-xl border border-line bg-slate-50 p-3">
            <div className="text-[12.5px] font-semibold text-ink leading-snug">{pending.row.idea.title}</div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
              <span>{pending.row.idea.stage}</span><Icon name="ArrowRight" size={12} /><span className="font-semibold text-ink">{pending.stage}</span>
              <span className="ml-auto num font-semibold text-ink-2">{inrShort(pending.row.annual)}</span>
            </div>
            {pending.row.idea.bucket === 'Pipeline' && pending.group.bucket === 'In Execution' && (
              <div className="mt-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">Moving past Approval creates the execution record (owner, 31 March due date, milestones) and locks approved values.</div>
            )}
          </div>
        )}
      </RemarksModal>
      {dropFor && <DropModal idea={dropFor} open={!!dropFor} onClose={() => setDropFor(null)} />}
      {doneFor && <MarkDoneModal idea={doneFor} open={!!doneFor} onClose={() => setDoneFor(null)} />}
    </div>
  )
}
