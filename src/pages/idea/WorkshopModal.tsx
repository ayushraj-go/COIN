// Stage 2 — the workshop event: the points to discuss, who attends and who answers for it. Closing an event either
// schedules a follow-up discussion or, once both forms are done, sends the idea to management approval.
import { useEffect, useState } from 'react'
import type { Idea, WorkshopEvent } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { DEPARTMENTS, STAGE } from '../../lib/masters'
import { ideaAnnualised } from '../../lib/calc'
import { workshopGaps } from '../../lib/workflow'
import { addDays, fmtDate, todayIso } from '../../lib/format'
import { Button, Chip, Field, Icon, Modal, Segmented } from '../../components/ui'

const toast = () => useStore.getState().toast
const emailOk = (x: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim())
const lines = (x: string) => x.split('\n').map((l) => l.trim()).filter(Boolean)

interface Plan { date: string; time: string; venue: string; points: string; spocName: string; spocEmail: string }
const planFor = (spoc: { name: string; email: string }): Plan => ({ date: addDays(todayIso(), 7), time: '11:00', venue: '', points: '', spocName: spoc.name, spocEmail: spoc.email })
const planOk = (p: Plan) => !!p.date && p.date >= todayIso() && !!p.venue.trim() && lines(p.points).length > 0 && !!p.spocName.trim() && emailOk(p.spocEmail)
const toEvent = (p: Plan) => ({ date: p.date, time: p.time || undefined, venue: p.venue.trim(), points: lines(p.points), spoc: { name: p.spocName.trim(), email: p.spocEmail.trim() } })

function PlanFields({ plan, set }: { plan: Plan; set: (p: Plan) => void }) {
  const up = (k: keyof Plan) => (e: { target: { value: string } }) => set({ ...plan, [k]: e.target.value })
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date" required><input className="input" type="date" min={todayIso()} value={plan.date} onChange={up('date')} /></Field>
        <Field label="Time"><input className="input" type="time" value={plan.time} onChange={up('time')} /></Field>
        <Field label="Venue / link" required><input className="input" value={plan.venue} onChange={up('venue')} placeholder="Noida · room 2, or a Teams link" /></Field>
      </div>
      <Field label="Points to discuss" required hint="One point on each line">
        <textarea className="input" rows={3} value={plan.points} onChange={up('points')} placeholder={'Is the change workable on the line?\nDoes the new price hold for the full volume?'} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Point of contact (SPOC)" required hint="If someone else attends, enter their name here"><input className="input" value={plan.spocName} onChange={up('spocName')} /></Field>
        <Field label="SPOC email" required error={plan.spocEmail && !emailOk(plan.spocEmail) ? 'Enter a valid email' : undefined}><input className="input" type="email" value={plan.spocEmail} onChange={up('spocEmail')} /></Field>
      </div>
    </div>
  )
}

/** Create the workshop event — the first one, or a new one after the idea came back */
export function WorkshopEventModal({ idea, open, onClose }: { idea: Idea; open: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan>(() => planFor({ name: idea.submitterName, email: idea.submitterEmail ?? '' }))
  const [attendees, setAttendees] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    setPlan(planFor({ name: idea.submitterName, email: idea.submitterEmail ?? '' }))
    setAttendees([...new Set([idea.department, 'Sourcing', 'Finance'])].filter((d) => DEPARTMENTS.includes(d)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (d: string) => setAttendees((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))
  const submit = () => {
    useStore.getState().createWorkshopEvent(idea.id, { ...toEvent(plan), attendees })
    toast()(`Workshop event created — invitation sent to ${plan.spocName.trim()}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" icon="Presentation" title="Create workshop event" subtitle={`${idea.id} · ${idea.title}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="CalendarPlus" disabled={!planOk(plan) || !attendees.length} onClick={submit}>Create event</Button></>}>
      <div className="grid gap-3">
        <PlanFields plan={plan} set={setPlan} />
        <Field label="Departments attending" required>
          <div className="flex flex-wrap gap-1.5">{DEPARTMENTS.map((d) => <Chip key={d} active={attendees.includes(d)} onClick={() => flip(d)}>{d}</Chip>)}</div>
        </Field>
      </div>
    </Modal>
  )
}

/** Close the event after the discussion: schedule a follow-up, or go ahead to management approval */
export function CloseEventModal({ idea, event, open, onClose }: { idea: Idea; event?: WorkshopEvent; open: boolean; onClose: () => void }) {
  const gaps = workshopGaps(idea, ideaAnnualised(idea)).filter((g) => g !== 'Workshop event')
  const [outcome, setOutcome] = useState<'Go ahead' | 'Follow-up'>('Go ahead')
  const [notes, setNotes] = useState('')
  const [closedBy, setClosedBy] = useState('')
  const [plan, setPlan] = useState<Plan>(() => planFor({ name: idea.submitterName, email: idea.submitterEmail ?? '' }))
  useEffect(() => {
    if (!open || !event) return
    setOutcome(gaps.length ? 'Follow-up' : 'Go ahead'); setNotes(''); setClosedBy(event.spoc.name)
    setPlan(planFor(event.spoc))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!event) return null
  const followUp = outcome === 'Follow-up'
  const ready = !!notes.trim() && !!closedBy.trim() && (followUp ? planOk(plan) : !gaps.length)
  const submit = () => {
    const ok = useStore.getState().closeWorkshopEvent(idea.id, event.id, { notes: notes.trim(), closedBy: closedBy.trim(), outcome, followUp: followUp ? toEvent(plan) : undefined })
    if (ok) toast()(followUp ? `Follow-up discussion scheduled for ${fmtDate(plan.date)}` : `${idea.id} goes to ${STAGE.approval}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" icon="ClipboardList" title={`Close event ${event.no}`} subtitle={`${fmtDate(event.date)} · ${event.venue} · SPOC ${event.spoc.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={followUp ? 'primary' : 'success'} icon={followUp ? 'CalendarPlus' : 'CircleCheck'} disabled={!ready} onClick={submit}>{followUp ? 'Schedule follow-up' : 'Go ahead to management approval'}</Button></>}>
      <div className="grid gap-3">
        <Segmented value={outcome} onChange={(k) => setOutcome(k as typeof outcome)} options={[{ key: 'Go ahead', label: 'Go ahead', icon: 'CircleCheck' }, { key: 'Follow-up', label: 'Follow-up discussion', icon: 'CalendarPlus' }]} />
        {!followUp && gaps.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900 flex items-start gap-2">
            <Icon name="TriangleAlert" size={15} className="shrink-0 mt-px" />
            <span>Finish these before Go ahead: <b>{gaps.join(', ')}</b>.</span>
          </div>
        )}
        <Field label="What was discussed and decided" required><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Field label="Your name" required hint="The ID is shared, so the person closing the event is recorded"><input className="input" value={closedBy} onChange={(e) => setClosedBy(e.target.value)} /></Field>
        {followUp && <PlanFields plan={plan} set={setPlan} />}
      </div>
    </Modal>
  )
}
