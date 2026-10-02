// M12 — rules & configuration: approval matrix, drop reasons, SLA & reminder rules, email templates, FY calendar, settings, audit trail, data
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Badge, Button, Icon, Toggle, Segmented, Modal, DataTable, Field, Avatar, KV, Stat, cn, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { approvalLevels, ideaAnnualised } from '../../lib/calc'
import { LAKH } from '../../lib/masters'
import { APPROVAL_NOTE, APPROVAL_MATRIX_DOC, NOTIF_TRIGGERS, NOTIF_FOOTNOTE, NOTIF_INTRO, NFRS, DECISIONS, REALISATION_CYCLE } from '../../lib/scope'
import { fmtDateTime, fmtDate, fyMonths, fyLabel, monthLabel, monthLong, thirdWorkingDay, addMonthsYm, inrShort, fyEnd, fyStart, ymOf, todayIso } from '../../lib/format'
import type { ApprovalRule, EmailTemplate, SlaRule } from '../../lib/types'
import { SectionIntro, useRO } from './common'

const nowUndo = (msg: string, undo: () => void) => useStore.getState().toast(msg, 'success', undo)

// ─── Approval matrix ──────────────────────────────────────────────────────────
export function ApprovalAdmin() {
  const ro = useRO()
  const settings = useStore((s) => s.settings)
  const rules = useStore((s) => s.approvalRules)
  const ideas = useStore((s) => s.ideas)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsert = useStore((s) => s.upsert)
  const [x, setX] = useState(settings.xThresholdLakh)
  const [y, setY] = useState(settings.yThresholdLakh)
  const [re, setRe] = useState(settings.reapprovalPct)
  useEffect(() => { setX(settings.xThresholdLakh); setY(settings.yThresholdLakh); setRe(settings.reapprovalPct) }, [settings.xThresholdLakh, settings.yThresholdLakh, settings.reapprovalPct])
  const [simA, setSimA] = useState(65)
  const [simI, setSimI] = useState(10)
  const [edit, setEdit] = useState<ApprovalRule | null>(null)
  const dirty = x !== settings.xThresholdLakh || y !== settings.yThresholdLakh || re !== settings.reapprovalPct
  const valid = x > 0 && y > 0 && re >= 0 && re <= 100
  const atApproval = ideas.filter((i) => i.stage === 'Sourcing approval')
  const needHead = (xx: number, yy: number) => atApproval.filter((i) => approvalLevels(ideaAnnualised(i), i.oneTimeInvestment, xx, yy).includes('Sourcing Head')).length
  const save = () => {
    const prevS = { ...useStore.getState().settings }, prevR = useStore.getState().approvalRules
    updateSettings({ xThresholdLakh: x, yThresholdLakh: y, reapprovalPct: re })
    rules.forEach((r) => upsert('approvalRules', { ...r, thresholdLakh: r.kind === 'value' ? x : y }))
    nowUndo(`Approval matrix saved · ₹ X = ${x} lakh, ₹ Y = ${y} lakh`, () => useStore.setState({ settings: prevS, approvalRules: prevR }))
  }
  const chain = simA > 0 || simI > 0 ? approvalLevels(simA * LAKH, simI * LAKH, x, y) : []
  const fill = (s: string, r: ApprovalRule) => s.replace('₹ X lakh', `₹ ${r.kind === 'value' ? x : y} lakh`).replace('₹ Y lakh', `₹ ${y} lakh`)
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50/70 px-4 py-3">
        <Icon name="Scale" size={16} className="text-gold-600 mt-0.5" />
        <div className="text-[12.5px] text-ink-2"><b className="text-ink">{APPROVAL_NOTE}</b> {DECISIONS.find((d) => d.n === 4)?.decision} — proposed: {DECISIONS.find((d) => d.n === 4)?.proposed}.</div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <Card className="xl:col-span-7 rounded-2xl" title="Approval matrix (configurable)" icon="GitBranch" subtitle="Value slab decides the approver chain; the investment rule adds the Sourcing Head">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="₹ X — value threshold" hint="Above this, Commodity Lead → Sourcing Head">
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[12.5px]">₹</span><input className="input pl-6 pr-14 num" type="number" min={1} disabled={ro} value={x} onChange={(e) => setX(Number(e.target.value))} /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-muted">lakh</span></div>
            </Field>
            <Field label="₹ Y — investment threshold" hint="One-time investment above this adds the Sourcing Head">
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[12.5px]">₹</span><input className="input pl-6 pr-14 num" type="number" min={1} disabled={ro} value={y} onChange={(e) => setY(Number(e.target.value))} /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-muted">lakh</span></div>
            </Field>
            <Field label="Re-approval above" hint="Changes after approval need a reason; re-approval above this %">
              <div className="relative"><input className="input pr-8 num" type="number" min={0} max={100} disabled={ro} value={re} onChange={(e) => setRe(Number(e.target.value))} /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-muted">%</span></div>
            </Field>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Rule</th><th>Condition</th><th>Approver chain</th><th style={{ textAlign: 'right' }}>Threshold</th><th /></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className={cn(!ro && 'clickable')} onClick={() => !ro && setEdit(r)}>
                    <td className="font-mono text-[11.5px] text-muted">{r.id}</td>
                    <td className="font-medium text-ink">{fill(r.condition, r)}</td>
                    <td><span className="flex items-center gap-1 flex-wrap">{r.approver.split(/→|\+/).map((a) => a.trim()).filter(Boolean).map((a, k, arr) => <React.Fragment key={a}><Badge color={a.includes('Head') ? '#2f5bc6' : '#bf8f3f'}>{a}</Badge>{k < arr.length - 1 && <Icon name="ArrowRight" size={12} className="text-muted" />}</React.Fragment>)}{r.approver.startsWith('+') && <span className="text-[11px] text-muted">added</span>}</span></td>
                    <td className="num font-semibold" style={{ textAlign: 'right' }}>₹ {r.kind === 'value' ? x : y} lakh</td>
                    <td>{!ro && <Icon name="PencilLine" size={14} className="text-muted" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11.5px] text-muted">Scope text: {APPROVAL_MATRIX_DOC.map(([a, b]) => `${a}: ${b}`).join(' · ')}</div>
          {!ro && (
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
              <span className="text-[12px] text-muted">{atApproval.length} ideas at Approval · {needHead(x, y)} would need the Sourcing Head (now {needHead(settings.xThresholdLakh, settings.yThresholdLakh)})</span>
              <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={!dirty} onClick={() => { setX(settings.xThresholdLakh); setY(settings.yThresholdLakh); setRe(settings.reapprovalPct) }}>Discard</Button><Button size="sm" variant="primary" icon="Save" disabled={!dirty || !valid} onClick={save}>Save matrix</Button></div>
            </div>
          )}
        </Card>
        <Card className="xl:col-span-5 rounded-2xl" title="Approval simulator" icon="FlaskConical" subtitle="Who approves an idea of this size?">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annualised impact (₹ lakh)"><input className="input num" type="number" min={0} value={simA} onChange={(e) => setSimA(Number(e.target.value))} /></Field>
            <Field label="One-time investment (₹ lakh)"><input className="input num" type="number" min={0} value={simI} onChange={(e) => setSimI(Number(e.target.value))} /></Field>
          </div>
          <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted mb-2">Approver chain</div>
            <div className="flex items-center gap-2 flex-wrap">
              {chain.map((c, k) => <React.Fragment key={c}>{k > 0 && <Icon name="ArrowRight" size={14} className="text-brand-400" />}<span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-brand-200 text-[12.5px] font-semibold text-ink"><Icon name={c === 'Sourcing Head' ? 'Crown' : 'UserCheck'} size={14} className="text-brand-600" />{c}</span></React.Fragment>)}
            </div>
            <div className="text-[11.5px] text-muted mt-2">
              {simA * LAKH > x * LAKH ? `₹ ${simA} lakh is above ₹ X (${x} lakh)` : `₹ ${simA} lakh is within ₹ X (${x} lakh)`}{simI > y ? ` · investment ₹ ${simI} lakh is above ₹ Y (${y} lakh)` : ''}. SLA at Approval: 3 working days per level.
            </div>
          </div>
        </Card>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="GitBranch" title={`Edit rule ${edit?.id ?? ''}`} size="sm"
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" icon="Save" disabled={!edit?.condition.trim() || !edit?.approver.trim()} onClick={() => { const prev = useStore.getState().approvalRules; upsert('approvalRules', edit); nowUndo(`Rule ${edit!.id} updated`, () => useStore.setState({ approvalRules: prev })); setEdit(null) }}>Save rule</Button></>}>
        {edit && (
          <div className="grid gap-3">
            <Field label="Condition" hint="Use ₹ X lakh / ₹ Y lakh — replaced by the thresholds above"><input className="input" value={edit.condition} onChange={(e) => setEdit({ ...edit, condition: e.target.value })} /></Field>
            <Field label="Approver chain" hint="Use → between levels; prefix + for an added approver"><input className="input" value={edit.approver} onChange={(e) => setEdit({ ...edit, approver: e.target.value })} /></Field>
            <Field label="Threshold type"><select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as ApprovalRule['kind'] })}><option value="value">Annualised value (₹ X)</option><option value="investment">One-time investment (₹ Y)</option></select></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Drop reasons ─────────────────────────────────────────────────────────────
export function DropReasonsAdmin() {
  const ro = useRO()
  const reasons = useStore((s) => s.dropReasons)
  const ideas = useStore((s) => s.ideas)
  const setList = useStore((s) => s.setList)
  const [add, setAdd] = useState('')
  const [editing, setEditing] = useState<{ i: number; v: string } | null>(null)
  const commit = (list: string[], msg: string) => { const prev = reasons; setList('dropReasons', list); nowUndo(msg, () => setList('dropReasons', prev)) }
  const move = (i: number, d: number) => { const l = [...reasons]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); commit(l, 'Drop reasons reordered') }
  const dup = (v: string, skip = -1) => reasons.some((r, k) => k !== skip && r.toLowerCase() === v.trim().toLowerCase())
  return (
    <Card className="rounded-2xl" title="Drop reasons" icon="CircleX" subtitle="Drop needs a reason code and remarks; the committed value is removed from landing and the drop is counted in its month">
      <div className="space-y-1.5">
        {reasons.map((r, i) => {
          const n = ideas.filter((x) => x.dropReason === r).length
          const isEdit = editing?.i === i
          return (
            <div key={r + i} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
              <span className="h-6 w-6 rounded-md bg-slate-100 text-[11px] font-bold text-ink-2 grid place-items-center shrink-0">{i + 1}</span>
              {isEdit
                ? <input autoFocus className="input !h-8 flex-1" value={editing.v} onChange={(e) => setEditing({ i, v: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); if (e.key === 'Enter' && editing.v.trim() && !dup(editing.v, i)) { const l = [...reasons]; l[i] = editing.v.trim(); commit(l, 'Drop reason renamed'); setEditing(null) } }} />
                : <span className="flex-1 min-w-0 text-[13px] font-medium text-ink truncate">{r}</span>}
              {/Other/.test(r) && <Badge color="#bf8f3f">Remarks mandatory</Badge>}
              <span className="text-[11.5px] text-muted num w-20 text-right">{n} idea{n === 1 ? '' : 's'}</span>
              {!ro && (
                <span className="flex items-center gap-0.5">
                  {isEdit
                    ? <><Button size="xs" variant="primary" disabled={!editing.v.trim() || dup(editing.v, i)} onClick={() => { const l = [...reasons]; l[i] = editing.v.trim(); commit(l, 'Drop reason renamed'); setEditing(null) }}>Save</Button><Button size="xs" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></>
                    : <>
                      <Button size="xs" variant="ghost" icon="ArrowUp" disabled={i === 0} onClick={() => move(i, -1)} title="Move up" />
                      <Button size="xs" variant="ghost" icon="ArrowDown" disabled={i === reasons.length - 1} onClick={() => move(i, 1)} title="Move down" />
                      <Button size="xs" variant="ghost" icon="PencilLine" onClick={() => setEditing({ i, v: r })} title="Rename" />
                      <Button size="xs" variant="ghost" icon="Trash2" onClick={() => commit(reasons.filter((_, k) => k !== i), `“${r}” removed — existing drops keep their reason`)} title="Remove" />
                    </>}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {!ro && (
        <div className="flex flex-wrap items-start gap-2 mt-3">
          <div className="w-[340px] max-w-full"><input className="input" placeholder="New drop reason" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && add.trim() && !dup(add)) { commit([...reasons.filter((r) => !/Other/.test(r)), add.trim(), ...reasons.filter((r) => /Other/.test(r))], `“${add.trim()}” added`); setAdd('') } }} />{add && dup(add) && <div className="text-[11.5px] text-red-600 mt-1">Reason already exists</div>}</div>
          <Button variant="primary" icon="Plus" disabled={!add.trim() || dup(add)} onClick={() => { commit([...reasons.filter((r) => !/Other/.test(r)), add.trim(), ...reasons.filter((r) => /Other/.test(r))], `“${add.trim()}” added`); setAdd('') }}>Add reason</Button>
          <span className="text-[11.5px] text-muted self-center">New reasons are added above “Other (remarks mandatory)”.</span>
        </div>
      )}
    </Card>
  )
}

// ─── SLA & reminder rules ─────────────────────────────────────────────────────
export function SlaAdmin() {
  const ro = useRO()
  const rules = useStore((s) => s.slaRules)
  const upsert = useStore((s) => s.upsert)
  const [draft, setDraft] = useState<SlaRule[]>(rules)
  useEffect(() => setDraft(rules), [rules])
  const errOf = (r: SlaRule) => (r.slaDays < 1 ? 'SLA must be ≥ 1 day' : r.reminderDay < 1 || r.reminderDay > r.slaDays ? 'Reminder must fall within the SLA' : r.escalateDay <= r.slaDays ? 'Escalation must come after the SLA' : !r.escalateTo.trim() ? 'Escalate-to is required' : null)
  const setF = (k: number, patch: Partial<SlaRule>) => setDraft((d) => d.map((r, i) => (i === k ? { ...r, ...patch } : r)))
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules)
  const anyErr = draft.some((r) => errOf(r))
  const save = () => { const prev = useStore.getState().slaRules; draft.forEach((r) => upsert('slaRules', r, 'stage')); nowUndo('SLA & reminder rules saved', () => useStore.setState({ slaRules: prev })) }
  return (
    <div className="grid gap-3">
      <SectionIntro icon="BellRing">{NOTIF_INTRO} Stage SLAs are counted in working days (Decision 11: as proposed).</SectionIntro>
      <Card className="rounded-2xl" title="Stage SLAs, reminders and escalation" icon="Timer" subtitle="Reminder on the reminder day; escalation on the escalation day"
        actions={!ro && <><Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(rules)}>Discard</Button><Button size="sm" variant="primary" icon="Save" disabled={!dirty || anyErr} onClick={save}>Save rules</Button></>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Stage</th><th style={{ textAlign: 'right' }}>SLA (working days)</th><th style={{ textAlign: 'right' }}>Reminder on day</th><th>Escalate to</th><th style={{ textAlign: 'right' }}>Escalate on day</th><th style={{ width: 240 }}>Timeline</th></tr></thead>
            <tbody>
              {draft.map((r, k) => {
                const e = errOf(r)
                const max = Math.max(r.escalateDay, r.slaDays) + 1
                const numIn = (key: 'slaDays' | 'reminderDay' | 'escalateDay') => <input type="number" min={1} disabled={ro} className="input !h-8 !w-20 text-right num" value={r[key]} onChange={(ev) => setF(k, { [key]: Number(ev.target.value) } as any)} />
                return (
                  <tr key={r.stage} className={cn(e && 'bg-red-50/50')}>
                    <td><div className="font-semibold text-ink">{r.stage}</div>{e && <div className="text-[11px] text-red-600">{e}</div>}</td>
                    <td style={{ textAlign: 'right' }}>{numIn('slaDays')}</td>
                    <td style={{ textAlign: 'right' }}>{numIn('reminderDay')}</td>
                    <td><input disabled={ro} className="input !h-8" value={r.escalateTo} onChange={(ev) => setF(k, { escalateTo: ev.target.value })} /></td>
                    <td style={{ textAlign: 'right' }}>{numIn('escalateDay')}</td>
                    <td>
                      <div className="relative h-4 rounded-full bg-slate-100 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-emerald-200" style={{ width: `${(Math.min(r.reminderDay, r.slaDays) / max) * 100}%` }} />
                        <div className="absolute inset-y-0 bg-amber-200" style={{ left: `${(r.reminderDay / max) * 100}%`, width: `${(Math.max(0, r.slaDays - r.reminderDay) / max) * 100}%` }} />
                        <div className="absolute inset-y-0 bg-red-200" style={{ left: `${(r.slaDays / max) * 100}%`, width: `${(Math.max(0, r.escalateDay - r.slaDays) / max) * 100}%` }} />
                        <div className="absolute inset-y-0 bg-red-500" style={{ left: `${(r.escalateDay / max) * 100}%`, right: 0 }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted mt-0.5"><span>day 0</span><span>reminder {r.reminderDay}</span><span>SLA {r.slaDays}</span><span>esc. {r.escalateDay}</span></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="rounded-2xl" title="Email triggers" icon="Mail" subtitle="Emails sent at each hand-off">
        <DataTable rows={NOTIF_TRIGGERS} rowKey={(t) => t.trigger} maxHeight={420} exportName="COIN_Notification_triggers"
          columns={[
            { key: 'trigger', label: 'Trigger', render: (t) => <span className="font-medium text-ink">{t.trigger}</span> },
            { key: 'recipient', label: 'Recipient' },
            { key: 'channel', label: 'Channel' },
            { key: 'timing', label: 'Timing', render: (t) => <span className="text-ink-2">{t.timing}</span> },
            { key: 'critical', label: 'Mutable', value: (t) => (t.critical ? 'No — critical' : 'Yes'), render: (t) => (t.critical ? <Badge color="#e0364f" icon="ShieldAlert">Cannot be muted</Badge> : <Badge color="#64748b">Can mute · digest</Badge>) },
          ]} />
        <div className="text-[11.5px] text-muted mt-2">{NOTIF_FOOTNOTE}</div>
      </Card>
    </div>
  )
}

// ─── Email templates ──────────────────────────────────────────────────────────
const PLACEHOLDERS = ['recipient', 'ideaId', 'title', 'commodity', 'impact', 'secureLink', 'campaign', 'date', 'venue', 'targetDate', 'month', 'realised', 'monthRealised', 'link']
// Retired placeholders: still recognised in older templates (render blank) but no longer offered for insertion
const RETIRED_PLACEHOLDERS = ['target', 'landing', 'gap']
export function TemplatesAdmin() {
  const ro = useRO()
  const templates = useStore((s) => s.emailTemplates)
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const campaigns = useStore((s) => s.campaigns)
  const settings = useStore((s) => s.settings)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const [sel, setSel] = useState(templates[0]?.id)
  const cur = templates.find((t) => t.id === sel) ?? templates[0]
  const [draft, setDraft] = useState<EmailTemplate | null>(cur ?? null)
  useEffect(() => setDraft(cur ?? null), [cur?.id, cur?.subject, cur?.body, cur?.name])
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [lastField, setLastField] = useState<'subject' | 'body'>('body')
  const subjRef = useRef<HTMLInputElement>(null)
  const sample = useMemo(() => {
    const i = ideas.find((x) => x.execution) ?? ideas[0]
    const c = campaigns[0]
    return {
      recipient: 'Arjun Mehta', ideaId: i?.id ?? 'COIN-FY27-FAS-0012', title: i?.title ?? '', commodity: commodities.find((x) => x.code === i?.commodity)?.name ?? '', impact: inrShort(i ? ideaAnnualised(i) : 0),
      secureLink: 'https://coin.ambergroupindia.com/secure/7f3a9c', campaign: c?.name ?? '', date: fmtDate(c?.workshopDate ?? c?.startDate), venue: c?.venue ?? 'Amber Rajpura Plant',
      targetDate: fmtDate(i?.execution?.targetDate), month: monthLong(settings.lastRealisationMonth), realised: '₹ 11.70 Cr', monthRealised: '₹ 7.13 Cr',
      link: `https://coin.ambergroupindia.com/reports/home?month=${settings.lastRealisationMonth}`,
    } as Record<string, string>
  }, [ideas, campaigns, commodities, settings.lastRealisationMonth])
  const render = (s: string) => s.split(/(\{\{\s*\w+\s*\}\})/g).map((part, k) => {
    const m = part.match(/^\{\{\s*(\w+)\s*\}\}$/)
    if (!m) return <React.Fragment key={k}>{part}</React.Fragment>
    if (RETIRED_PLACEHOLDERS.includes(m[1])) return <React.Fragment key={k} />
    return sample[m[1]] != null ? <mark key={k} className="bg-brand-50 text-brand-800 rounded px-0.5">{sample[m[1]]}</mark> : <mark key={k} className="bg-red-100 text-red-700 rounded px-0.5" title="Unknown placeholder">{part}</mark>
  })
  const unknown = draft ? [...(draft.subject + draft.body).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).filter((p) => !PLACEHOLDERS.includes(p) && !RETIRED_PLACEHOLDERS.includes(p)) : []
  const insert = (p: string) => {
    if (!draft || ro) return
    const tag = `{{${p}}}`
    const el = lastField === 'body' ? bodyRef.current : subjRef.current
    const key = lastField
    const val = draft[key]
    const s = el?.selectionStart ?? val.length, e = el?.selectionEnd ?? val.length
    setDraft({ ...draft, [key]: val.slice(0, s) + tag + val.slice(e) })
    setTimeout(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length) }, 0)
  }
  const dirty = draft && cur && (draft.subject !== cur.subject || draft.body !== cur.body || draft.name !== cur.name)
  const save = () => { if (!draft) return; const prev = useStore.getState().emailTemplates; upsert('emailTemplates', draft); nowUndo(`Template “${draft.name}” saved`, () => useStore.setState({ emailTemplates: prev })) }
  const addNew = () => { const id = `T${String(templates.length + 1).padStart(2, '0')}-${Date.now().toString(36).slice(-3)}`; upsert('emailTemplates', { id, name: 'New template', subject: 'COIN · {{ideaId}}', body: 'Dear {{recipient}},\n\n\n— COIN · Cost Innovation Hub' }); setSel(id) }
  const del = () => { if (!cur) return; const prev = useStore.getState().emailTemplates; remove('emailTemplates', cur.id); setSel(templates.find((t) => t.id !== cur.id)?.id); nowUndo(`Template “${cur.name}” deleted`, () => useStore.setState({ emailTemplates: prev })) }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      <Card className="xl:col-span-3 rounded-2xl" title="Templates" icon="Mails" actions={!ro && <Button size="xs" variant="outline" icon="Plus" onClick={addNew}>New</Button>}>
        <div className="space-y-1">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={cn('w-full text-left rounded-xl px-3 py-2 border transition', t.id === cur?.id ? 'border-brand-200 bg-brand-50/70' : 'border-transparent hover:bg-slate-50')}>
              <div className="text-[12.5px] font-semibold text-ink truncate">{t.name}</div>
              <div className="text-[11px] text-muted truncate">{t.subject}</div>
            </button>
          ))}
        </div>
      </Card>
      {draft && (
        <>
          <Card className="xl:col-span-5 rounded-2xl" title="Edit template" icon="PencilLine" subtitle="Click a placeholder to insert it at the cursor"
            actions={!ro && <><Button size="xs" variant="ghost" icon="Trash2" onClick={del}>Delete</Button><Button size="xs" variant="ghost" disabled={!dirty} onClick={() => setDraft(cur!)}>Discard</Button><Button size="xs" variant="primary" icon="Save" disabled={!dirty || !draft.name.trim() || !draft.subject.trim()} onClick={save}>Save</Button></>}>
            <div className="grid gap-3">
              <Field label="Template name"><input className="input" disabled={ro} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Subject"><input ref={subjRef} className="input" disabled={ro} value={draft.subject} onFocus={() => setLastField('subject')} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
              <Field label="Body"><textarea ref={bodyRef} className="input font-mono !text-[12.5px]" rows={11} disabled={ro} value={draft.body} onFocus={() => setLastField('body')} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
              <div>
                <div className="label">Placeholders</div>
                <div className="flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <button key={p} disabled={ro} onClick={() => insert(p)} className="h-6 px-2 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono text-ink-2 hover:border-brand-200 hover:text-brand-700 disabled:opacity-60">{`{{${p}}}`}</button>)}</div>
              </div>
              {unknown.length > 0 && <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] px-3 py-2"><Icon name="CircleAlert" size={14} />Unknown placeholder{unknown.length > 1 ? 's' : ''}: {unknown.map((u) => `{{${u}}}`).join(', ')}</div>}
            </div>
          </Card>
          <Card className="xl:col-span-4 rounded-2xl" title="Live preview" icon="Eye" subtitle="Rendered with sample data">
            <div className="rounded-xl border border-line overflow-hidden">
              <div className="px-3 py-2 border-b border-line bg-gradient-to-r from-brand-50 to-white text-[12px]">
                <div className="text-muted">From <span className="text-ink-2">COIN · Cost Innovation Hub</span></div>
                <div className="text-muted">To <span className="text-ink-2">{sample.recipient}</span></div>
                <div className="font-bold text-ink mt-0.5">{render(draft.subject)}</div>
              </div>
              <div className="px-3 py-3 text-[12.5px] text-ink-2 whitespace-pre-wrap leading-relaxed bg-white">{render(draft.body)}</div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── FY calendar ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export function CalendarAdmin() {
  const ro = useRO()
  const settings = useStore((s) => s.settings)
  const fyClosed = useStore((s) => s.fyClosed)
  const updateSettings = useStore((s) => s.updateSettings)
  const fy = settings.currentFy
  const today = todayIso()
  const sm = settings.fyStartMonth
  const qLabel = (q: number) => { const a = (sm - 1 + q * 3) % 12; return `${MONTH_NAMES[a].slice(0, 3)}–${MONTH_NAMES[(a + 2) % 12].slice(0, 3)}` }
  const set = (patch: Partial<typeof settings>, msg: string) => { const prev = { ...useStore.getState().settings }; updateSettings(patch); nowUndo(msg, () => useStore.setState({ settings: prev })) }
  const months = fyMonths(fy)
  return (
    <div className="grid gap-3">
      <SectionIntro icon="CalendarRange">Financial year April–March, configurable; all reports switch FY and quarter from one selector. Quarters: Q1 (Apr–Jun) to Q4 (Jan–Mar).</SectionIntro>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <Card className="xl:col-span-4 rounded-2xl" title="FY settings" icon="Settings2">
          <div className="grid gap-3">
            <Field label="Current FY" hint={fyLabel(fy)}>
              <select className="input" disabled={ro} value={fy} onChange={(e) => set({ currentFy: e.target.value }, `Current FY set to ${e.target.value}`)}>{['FY26', 'FY27', 'FY28'].map((f) => <option key={f} value={f}>{fyLabel(f)}</option>)}</select>
            </Field>
            <Field label="FY start month" hint={sm === 4 ? 'April — Amber standard' : 'A changed start month applies from the next FY rollover'}>
              <select className="input" disabled={ro} value={sm} onChange={(e) => set({ fyStartMonth: Number(e.target.value) }, `FY start month set to ${MONTH_NAMES[Number(e.target.value) - 1]}`)}>{MONTH_NAMES.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select>
            </Field>
            <KV k="FY start" v={fmtDate(fyStart(fy))} />
            <KV k="FY end (closure & carry-over)" v={fmtDate(fyEnd(fy))} />
            <KV k="Last realisation run" v={monthLong(settings.lastRealisationMonth)} />
            <KV k={`${fy} closure`} v={fyClosed[fy] ? <Badge color="#0f9f6e" icon="LockKeyhole">Booked</Badge> : <Badge color="#64748b">Open</Badge>} />
          </div>
        </Card>
        <Card className="xl:col-span-8 rounded-2xl" title={`${fy} calendar`} icon="CalendarDays" subtitle="Monthly realisation runs on the 3rd working day for the previous month">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {[0, 1, 2, 3].map((q) => (
              <div key={q} className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white px-3 py-2">
                <div className="text-[11px] font-bold text-brand-700">Q{q + 1}</div>
                <div className="text-[14px] font-bold text-ink">{qLabel(q)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {months.map((m) => {
              const run = thirdWorkingDay(addMonthsYm(m, 1))
              const realised = m <= settings.lastRealisationMonth
              const current = ymOf(today) === m
              return (
                <div key={m} className={cn('rounded-xl border px-2.5 py-2', current ? 'border-brand-300 bg-brand-50 shadow-sm' : realised ? 'border-emerald-200 bg-emerald-50/50' : 'border-line bg-white')}>
                  <div className="flex items-center justify-between"><span className="text-[12.5px] font-bold text-ink">{monthLabel(m)}</span>{current && <Badge color="#2f5bc6">Today</Badge>}</div>
                  <div className="text-[10.5px] text-muted mt-0.5">Run {fmtDate(run)}</div>
                  <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: realised ? '#0f9f6e' : '#64748b' }}>{realised ? 'Realised · mailer sent' : run < today ? 'Run due' : 'Scheduled'}</div>
                </div>
              )
            })}
          </div>
          <div className="text-[11.5px] text-muted mt-3">{REALISATION_CYCLE[5]}</div>
        </Card>
      </div>
    </div>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function SettingsAdmin() {
  const ro = useRO()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const set = (patch: Partial<typeof settings>, msg: string) => { const prev = { ...useStore.getState().settings }; updateSettings(patch); nowUndo(msg, () => useStore.setState({ settings: prev })) }
  const [timeout, setTimeoutV] = useState(settings.sessionTimeoutMin)
  const [reap, setReap] = useState(settings.reapprovalPct)
  useEffect(() => { setTimeoutV(settings.sessionTimeoutMin); setReap(settings.reapprovalPct) }, [settings.sessionTimeoutMin, settings.reapprovalPct])
  const Row = ({ icon, title, desc, children }: { icon: string; title: string; desc: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0"><Icon name={icon} size={16} /></span>
      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink">{title}</div><div className="text-[11.5px] text-muted leading-snug">{desc}</div></div>
      <div className="shrink-0">{children}</div>
    </div>
  )
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
      <Card className="xl:col-span-7 rounded-2xl" title="Settings" icon="Settings2" subtitle="Changes apply immediately; undo for 5 seconds">
        <Row icon="ShieldCheck" title="Finance validation before savings count" desc={<>Realised savings are counted only after Finance validation (Decision 2 — proposed: Yes). Off: all MRN-based realised savings count.</>}>
          <Toggle disabled={ro} checked={settings.financeValidation} onChange={(v) => set({ financeValidation: v }, `Finance validation ${v ? 'on' : 'off'}`)} label={settings.financeValidation ? 'On' : 'Off'} />
        </Row>
        <Row icon="TimerReset" title="Session timeout" desc="Sign out after this many minutes of inactivity (Section 15: 30 minutes)">
          <div className="flex items-center gap-2"><input type="number" min={5} max={240} disabled={ro} className="input !h-8 !w-20 text-right num" value={timeout} onChange={(e) => setTimeoutV(Number(e.target.value))} onBlur={() => timeout !== settings.sessionTimeoutMin && timeout >= 5 && timeout <= 240 && set({ sessionTimeoutMin: timeout }, `Session timeout set to ${timeout} minutes`)} /><span className="text-[12px] text-muted">min</span></div>
        </Row>
        <Row icon="RefreshCcwDot" title="Re-approval threshold" desc="Approved values are locked; a change after approval needs a reason and re-approval above this %">
          <div className="flex items-center gap-2"><input type="number" min={0} max={100} disabled={ro} className="input !h-8 !w-20 text-right num" value={reap} onChange={(e) => setReap(Number(e.target.value))} onBlur={() => reap !== settings.reapprovalPct && reap >= 0 && reap <= 100 && set({ reapprovalPct: reap }, `Re-approval threshold set to ${reap}%`)} /><span className="text-[12px] text-muted">%</span></div>
        </Row>
        <Row icon="Trophy" title="Contributor leaderboard visible to all users" desc="Decision 9 — top 10 contributors per quarter on the home page (leaderboard only; no payout)">
          <Toggle disabled={ro} checked={settings.leaderboardVisible} onChange={(v) => set({ leaderboardVisible: v }, `Leaderboard ${v ? 'visible' : 'hidden'}`)} label={settings.leaderboardVisible ? 'Visible' : 'Hidden'} />
        </Row>
        <Row icon="Rows3" title="Table density" desc="Compact (40 px rows) or comfortable (52 px rows) — default for all tables">
          <Segmented size="sm" value={settings.density} onChange={(k) => !ro && set({ density: k as 'compact' | 'comfortable' }, `Density set to ${k}`)} options={[{ key: 'compact', label: 'Compact', icon: 'Rows4' }, { key: 'comfortable', label: 'Comfortable', icon: 'Rows3' }]} />
        </Row>
      </Card>
      <Card className="xl:col-span-5 rounded-2xl" title="Non-functional requirements" icon="ServerCog" subtitle="Section 15">
        {NFRS.map(([k, v]) => <KV key={k} k={k} v={<span className="text-[12px] font-normal text-ink-2">{v}</span>} />)}
      </Card>
    </div>
  )
}

// ─── Audit trail ──────────────────────────────────────────────────────────────
interface AuditRow { id: string; at: string; userId: string; userName: string; ideaId: string; title: string; action: string; field?: string; oldValue?: string; newValue?: string; remarks?: string; kind: string }
const KIND = (a: string, f?: string) => (/Approved|Rejected|approval/i.test(a) ? 'Approval' : /override/i.test(a) ? 'Override' : /Dropped|Rejected/i.test(a) ? 'Drop' : f === 'stage' || /Submitted|Completed|Validated|Moved|Sent back|Implemented/i.test(a) ? 'Stage change' : /Target date|Due date|Milestone|Progress|phasing|Owner|Reassign/i.test(a) ? 'Execution' : /Created/i.test(a) ? 'Create' : /Edited|Feasibility|Technical|NPD|PAP|synced|comment|attachment|info/i.test(a) ? 'Edit' : 'Other')
export function AuditAdmin() {
  const ideas = useStore((s) => s.ideas)
  const users = useStore((s) => s.users)
  const openIdea = useStore((s) => s.openIdea)
  const [q, setQ] = useState('')
  const [user, setUser] = useState('All')
  const [kind, setKind] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const all = useMemo<AuditRow[]>(() => ideas.flatMap((i) => i.activity.map((a) => ({ ...a, id: `${i.id}|${a.id}`, ideaId: i.id, title: i.title, kind: KIND(a.action, a.field) }))).sort((a, b) => (a.at < b.at ? 1 : -1)), [ideas])
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    return all.filter((r) => (user === 'All' || r.userId === user) && (kind === 'All' || r.kind === kind) && (!from || r.at.slice(0, 10) >= from) && (!to || r.at.slice(0, 10) <= to) && (!k || `${r.ideaId} ${r.title} ${r.action} ${r.field ?? ''} ${r.oldValue ?? ''} ${r.newValue ?? ''} ${r.remarks ?? ''} ${r.userName}`.toLowerCase().includes(k)))
  }, [all, q, user, kind, from, to])
  const kinds = ['Create', 'Stage change', 'Approval', 'Override', 'Execution', 'Drop', 'Edit', 'Other']
  const kColor: Record<string, string> = { Create: '#64748b', 'Stage change': '#4470d6', Approval: '#2f5bc6', Override: '#bf8f3f', Execution: '#ec8a1c', Drop: '#e0364f', Edit: '#7c3aed', Other: '#64748b' }
  const actors = [...new Set(all.map((r) => r.userId))].map((id) => ({ id, name: all.find((r) => r.userId === id)?.userName ?? id })).sort((a, b) => a.name.localeCompare(b.name))
  const cols: Column<AuditRow>[] = [
    { key: 'at', label: 'Time', value: (r) => r.at, render: (r) => <span className="num text-ink-2">{fmtDateTime(r.at)}</span> },
    { key: 'user', label: 'User', value: (r) => r.userName, render: (r) => <span className="inline-flex items-center gap-1.5"><Avatar name={r.userName} color={users.find((u) => u.id === r.userId)?.avatarColor ?? '#64748b'} size={20} /><span className="text-[12px]">{r.userName}</span></span> },
    { key: 'ideaId', label: 'Idea', render: (r) => <span className="font-mono text-[11.5px] font-semibold text-brand-700">{r.ideaId}</span> },
    { key: 'kind', label: 'Type', render: (r) => <Badge color={kColor[r.kind]}>{r.kind}</Badge> },
    { key: 'action', label: 'Action', render: (r) => <span className="block max-w-[260px] truncate font-medium text-ink" title={r.action}>{r.action}</span> },
    { key: 'field', label: 'Field', value: (r) => r.field ?? '', render: (r) => <span className="font-mono text-[11px] text-muted">{r.field || '—'}</span> },
    { key: 'change', label: 'Old → new', value: (r) => (r.oldValue || r.newValue ? `${r.oldValue ?? ''} → ${r.newValue ?? ''}` : ''), render: (r) => (r.oldValue || r.newValue ? <span className="block max-w-[260px] truncate text-[12px]" title={`${r.oldValue ?? '—'} → ${r.newValue ?? '—'}`}><span className="text-red-600/80 line-through decoration-red-300">{r.oldValue || '—'}</span> <Icon name="ArrowRight" size={11} className="inline text-muted" /> <span className="text-emerald-700 font-medium">{r.newValue || '—'}</span></span> : <span className="text-muted">—</span>) },
    { key: 'remarks', label: 'Remarks', value: (r) => r.remarks ?? '', render: (r) => <span className="block max-w-[220px] truncate text-muted" title={r.remarks}>{r.remarks || '—'}</span> },
  ]
  return (
    <Card className="rounded-2xl" title="Audit trail" icon="History" subtitle="Every create, stage change, value edit, override, date change and approval — user, time, old and new value">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-3">
        {kinds.map((k) => { const n = all.filter((r) => r.kind === k).length; return <button key={k} onClick={() => setKind(kind === k ? 'All' : k)} className={cn('rounded-xl border px-2.5 py-1.5 text-left transition', kind === k ? 'border-brand-300 bg-brand-50' : 'border-line bg-white hover:border-brand-200')}><Stat label={k} value={n.toLocaleString('en-IN')} tone={kColor[k]} /></button> })}
      </div>
      <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} exportName="COIN_Audit_trail" maxHeight={600} onRowClick={(r) => openIdea(r.ideaId)}
        toolbar={<>
          <div className="relative"><Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 pl-8 w-[220px] text-[12.5px]" placeholder="Search idea, action, value…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input !h-8 !w-auto text-[12.5px]" value={user} onChange={(e) => setUser(e.target.value)}><option value="All">All users</option>{actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select className="input !h-8 !w-auto text-[12.5px]" value={kind} onChange={(e) => setKind(e.target.value)}><option value="All">All types</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
          <input type="date" className="input !h-8 !w-auto text-[12.5px]" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
          <input type="date" className="input !h-8 !w-auto text-[12.5px]" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
          {(q || user !== 'All' || kind !== 'All' || from || to) && <Button size="sm" variant="ghost" icon="X" onClick={() => { setQ(''); setUser('All'); setKind('All'); setFrom(''); setTo('') }}>Clear</Button>}
        </>} />
    </Card>
  )
}

// ─── Data: backup, import, reset ──────────────────────────────────────────────
const DATA_KEYS = ['users', 'levers', 'categories', 'commodities', 'plants', 'departments', 'suppliers', 'parts', 'dropReasons', 'slaRules', 'approvalRules', 'emailTemplates', 'settings', 'buyerTargets', 'plantTargets', 'ideas', 'campaigns', 'ledger', 'notifications', 'emails', 'savedViews', 'emailPrefs', 'fyClosed'] as const
export function DataAdmin() {
  const ro = useRO()
  const state = useStore()
  const toast = useStore((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; data: Record<string, any> } | null>(null)
  const [reset, setReset] = useState(false)
  const snapshot = () => Object.fromEntries(DATA_KEYS.map((k) => [k, (useStore.getState() as any)[k]]))
  const size = useMemo(() => new Blob([JSON.stringify(Object.fromEntries(DATA_KEYS.map((k) => [k, (state as any)[k]])))]).size, [state.ideas, state.ledger, state.users, state.notifications, state.emails]) // eslint-disable-line
  const exportJson = () => {
    const payload = { app: 'COIN — Cost Innovation Hub', version: 1, exportedAt: new Date().toISOString(), data: snapshot() }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `COIN_backup_${todayIso()}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Full backup exported as JSON', 'success')
  }
  const onFile = (f: File) => {
    const r = new FileReader()
    r.onload = () => {
      try {
        const j = JSON.parse(String(r.result))
        const data = j?.data ?? j
        if (!Array.isArray(data?.ideas) || !Array.isArray(data?.users) || !Array.isArray(data?.commodities)) throw new Error('File is not a COIN backup (ideas, users and commodities are required)')
        setPending({ name: f.name, data })
      } catch (e) { toast(`Import failed: ${(e as Error).message}`, 'error') }
    }
    r.readAsText(f)
  }
  const doImport = () => {
    if (!pending) return
    const prev = snapshot()
    const patch = Object.fromEntries(DATA_KEYS.filter((k) => pending.data[k] !== undefined).map((k) => [k, pending.data[k]]))
    useStore.setState(patch as any)
    toast(`Imported ${pending.name} · ${Object.keys(patch).length} data sets`, 'success', () => useStore.setState(prev as any))
    setPending(null)
  }
  const counts: [string, number, string][] = [['Ideas', state.ideas.length, 'Lightbulb'], ['Ledger entries', state.ledger.length, 'BookOpenCheck'], ['Users', state.users.length, 'Users'], ['Vendors', state.suppliers.length, 'Factory'], ['Parts', state.parts.length, 'Package'], ['Campaigns', state.campaigns.length, 'Megaphone'], ['Notifications', state.notifications.length, 'Bell'], ['Emails', state.emails.length, 'Mail']]
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {counts.map(([k, v, icon]) => <div key={k} className="card rounded-xl px-3 py-2.5 flex items-center gap-2.5"><span className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center"><Icon name={icon} size={15} /></span><Stat label={k} value={v.toLocaleString('en-IN')} /></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="rounded-2xl" title="Export full backup" icon="DatabaseBackup" subtitle={`All masters and transactions · ${(size / 1024).toFixed(0)} KB`}>
          <p className="text-[12.5px] text-ink-2">Downloads one JSON file with every master, idea, ledger entry, campaign, notification, email and setting held in this browser.</p>
          <Button className="mt-3" variant="primary" icon="Download" onClick={exportJson}>Export JSON backup</Button>
          <div className="text-[11px] text-muted mt-2">Production: {NFRS.find(([k]) => k === 'Backup')?.[1]}.</div>
        </Card>
        <Card className="rounded-2xl" title="Import backup" icon="DatabaseZap" subtitle="Replaces the data sets found in the file">
          <p className="text-[12.5px] text-ink-2">Select a COIN JSON backup. You will see what it contains before anything is replaced; the import can be undone for 5 seconds.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
          <Button className="mt-3" icon="Upload" disabled={ro} onClick={() => fileRef.current?.click()}>Choose JSON file…</Button>
        </Card>
        <Card className="rounded-2xl" title="Reset demo data" icon="RotateCcw" subtitle="Restore the original seeded portfolio">
          <p className="text-[12.5px] text-ink-2">Discards every local change (ideas, masters, settings) and reloads the demo seed: 15 commodities with their FY27 idea portfolio.</p>
          <Button className="mt-3" variant="danger" icon="RotateCcw" disabled={ro} onClick={() => setReset(true)}>Reset demo…</Button>
        </Card>
      </div>
      <Modal open={!!pending} onClose={() => setPending(null)} icon="DatabaseZap" title="Import this backup?" subtitle={pending?.name} size="sm"
        footer={<><Button onClick={() => setPending(null)}>Cancel</Button><Button variant="primary" icon="Upload" onClick={doImport}>Replace data</Button></>}>
        {pending && <div className="grid gap-1">{DATA_KEYS.filter((k) => pending.data[k] !== undefined).map((k) => <KV key={k} k={k} v={Array.isArray(pending.data[k]) ? `${pending.data[k].length} records` : 'object'} />)}</div>}
      </Modal>
      <Modal open={reset} onClose={() => setReset(false)} icon="RotateCcw" title="Reset all demo data?" subtitle="This cannot be undone" size="sm"
        footer={<><Button onClick={() => setReset(false)}>Cancel</Button><Button variant="danger" icon="RotateCcw" onClick={() => { useStore.getState().resetDemo(); setReset(false); toast('Demo data reset to the original seed', 'info') }}>Reset demo data</Button></>}>
        <p className="text-[12.5px] text-ink-2">Every idea, ledger entry, master change and setting made in this browser will be replaced by the original seed. Export a backup first if you may need it.</p>
      </Modal>
    </div>
  )
}
