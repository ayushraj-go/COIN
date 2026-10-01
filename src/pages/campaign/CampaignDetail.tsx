// Campaign detail — one email campaign (outreach batch): funnel, replies from the Supplier Portal, recipients, the email sent.
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { OutreachBatch } from '../../lib/types'
import { renderSupplierTemplate, supplierTemplateVars, useMe, useStore } from '../../store/useStore'
import { can } from '../../lib/nav'
import { daysBetween, fmtDate, fmtDateTime, todayIso } from '../../lib/format'
import { Button, EmptyState, Icon } from '../../components/ui'
import { EmailPreview, useOutreachBatches, useSupplierResponses, useSupplierTemplates } from './Outreach'
import { batchDeadline, batchFunnel, batchName, commodityLabel, isBatchLive, kindOf, linkResponses, npdProgress, type RecipientState } from './metrics'
import { KindIcon, NewCampaignWizard, ReplyRow } from './Workspace'
import { FUNNEL_COLORS, LinkBtn, Pager, Panel, Pill, PortalTag, usePaged, type PillTone } from './kit'

const STATE_TONE: Record<RecipientState, PillTone> = { Replied: 'teal', Opened: 'neutral', Delivered: 'muted' }

export default function OutreachCampaignDetail({ batch: b }: { batch: OutreachBatch }) {
  const nav = useNavigate()
  const me = useMe()
  const canManage = can(me, 'campaign')
  const batches = useOutreachBatches()
  const responses = useSupplierResponses()
  const templates = useSupplierTemplates()
  const suppliers = useStore((s) => s.suppliers)
  const commodities = useStore((s) => s.commodities)
  const emails = useStore((s) => s.emails)
  const ideas = useStore((s) => s.ideas)
  const openIdea = useStore((s) => s.openIdea)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [mailFor, setMailFor] = useState<string>('')
  const [rPage, setRPage] = useState(0)
  const [pPage, setPPage] = useState(0)

  const replies = useMemo(() => [...(linkResponses(responses, batches).byBatch.get(b.id) ?? [])].sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)), [responses, batches, b.id])
  const f = useMemo(() => batchFunnel(b, replies), [b, replies])
  const ideasN = replies.filter((r) => r.type === 'Idea').length
  const approvedN = replies.filter((r) => { const i = r.ideaId ? ideas.find((x) => x.id === r.ideaId) : undefined; return !!i && npdProgress(i).approved }).length
  const kind = kindOf(b)
  const name = batchName(b, commodities)
  const today = todayIso()
  const live = isBatchLive(b, today)
  const deadline = batchDeadline(b)
  const recips = b.recipients.map((code) => ({ code, s: suppliers.find((x) => x.code === code), state: f.perSupplier[code] }))
  const order: Record<RecipientState, number> = { Replied: 0, Opened: 1, Delivered: 2 }
  recips.sort((x, y) => order[x.state] - order[y.state] || (x.s?.name ?? x.code).localeCompare(y.s?.name ?? y.code))
  const silent = recips.filter((r) => r.state !== 'Replied').map((r) => r.code)
  const rp = usePaged(replies, 6, rPage)
  const pp = usePaged(recips, 8, pPage)

  // the email actually logged for a recipient; else re-render the template
  const mailSup = suppliers.find((s) => s.code === (mailFor || b.recipients[0]))
  const logged = mailSup ? emails.find((e) => e.at === b.sentAt && e.to.includes(mailSup.contactEmail)) : undefined
  const tpl = templates.find((t) => t.id === b.templateId)
  const vars = mailSup ? supplierTemplateVars(mailSup, b.commodities, commodities, { workshopDate: b.workshopDate, replyBy: b.replyBy, senderName: b.sentByName }) : null
  const mail = logged ? { subject: logged.subject, body: logged.body } : tpl && vars ? { subject: renderSupplierTemplate(tpl.subject, vars), body: renderSupplierTemplate(tpl.body, vars) } : null

  const stages: { label: string; value: number; note: string; color: string }[] = [
    { label: 'Sent', value: f.sent, note: `${f.delivered} delivered`, color: '#94a3b8' },
    { label: 'Opened', value: f.opened, note: 'read receipts', color: FUNNEL_COLORS.opened },
    { label: 'Replied', value: f.replied, note: `${f.replies} ${f.replies === 1 ? 'response' : 'responses'}`, color: FUNNEL_COLORS.replied },
    { label: 'Ideas received', value: ideasN, note: 'open or part-specific', color: FUNNEL_COLORS.ideas },
    { label: 'Approved', value: approvedN, note: 'moving to NPD sample', color: FUNNEL_COLORS.approved },
  ]
  const left = daysBetween(today, deadline)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/campaigns" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink -mb-1 self-start"><Icon name="ArrowLeft" size={14} />Campaigns</Link>

      {/* header */}
      <div className="flex flex-wrap items-start gap-4">
        <KindIcon kind={kind} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span>{kind}</span><span>·</span><span className="font-mono text-[11.5px]">{b.id}</span>
            {live ? <Pill tone="live" dot>Live · {left === 0 ? 'closes today' : `${left}d left`}</Pill> : <Pill tone="muted">Completed</Pill>}
          </div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.015em] text-ink mt-0.5 break-words">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
            <span className="inline-flex items-center gap-1"><Icon name="Send" size={13} className="text-muted" />Sent {fmtDateTime(b.sentAt)} by {b.sentByName}</span>
            <span className="inline-flex items-center gap-1"><Icon name="FileText" size={13} className="text-muted" />{b.templateName}</span>
            {b.workshopDate && <span className="inline-flex items-center gap-1"><Icon name="Presentation" size={13} className="text-muted" />Workshop {fmtDate(b.workshopDate)}</span>}
            {b.replyBy && <span className="inline-flex items-center gap-1"><Icon name="AlarmClock" size={13} className="text-muted" />Reply by {fmtDate(b.replyBy)}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">{b.commodities.map((c) => <Pill key={c}><span className="font-mono">{c}</span>{commodityLabel(commodities, c)}</Pill>)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button icon="Inbox" onClick={() => nav('/campaigns?tab=responses')}>Responses</Button>
          {canManage && silent.length > 0 && <Button variant="primary" icon="BellRing" onClick={() => setReminderOpen(true)}>Remind {silent.length} silent</Button>}
        </div>
      </div>

      {/* funnel */}
      <div className="card grid grid-cols-2 md:grid-cols-5 gap-px !bg-line overflow-hidden">
        {stages.map((s, i) => (
          <div key={s.label} className="bg-white px-4 py-3 min-w-0">
            <div className="text-[12px] text-muted">{s.label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[22px] leading-tight font-semibold text-ink num">{s.value}</span>
              {i > 0 && <span className="text-[11.5px] text-muted num">{f.sent ? Math.round((s.value / f.sent) * 100) : 0}%</span>}
            </div>
            <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${f.sent ? Math.min(100, (s.value / f.sent) * 100) : 0}%`, background: s.color }} /></div>
            <div className="text-[11.5px] text-muted mt-1 truncate">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-7 flex flex-col gap-4 min-w-0">
          <Panel pad={false} title="Replies" sub={`${f.replies} from ${f.replied} of ${f.sent} suppliers`} actions={<><PortalTag /><LinkBtn icon="ArrowRight" onClick={() => nav('/campaigns?tab=responses')}>Manage</LinkBtn></>}>
            {rp.slice.length ? rp.slice.map((r) => (
              <ReplyRow key={r.id} r={r} supplierName={suppliers.find((s) => s.code === r.supplierCode)?.name ?? r.supplierCode} commodity={commodityLabel(commodities, r.commodity)}
                onClick={() => (r.ideaId ? openIdea(r.ideaId) : nav('/campaigns?tab=responses'))} />
            )) : <EmptyState icon="Inbox" title="No replies yet" desc={b.replyBy ? `Suppliers were asked to reply by ${fmtDate(b.replyBy)}. Replies submitted on the Supplier Portal appear here.` : 'Replies submitted on the Supplier Portal appear here.'} />}
            {rp.pages > 1 && <Pager className="px-4 py-2 border-t border-line" {...rp} onPage={setRPage} noun="replies" />}
          </Panel>

          <Panel title="Email sent" sub={mailSup ? `as received by ${mailSup.name}` : undefined}
            actions={b.recipients.length > 1 ? (
              <select className="input !h-8 !w-auto max-w-[200px] !text-[12px]" value={mailSup?.code} onChange={(e) => setMailFor(e.target.value)} aria-label="Recipient">
                {recips.map((r) => <option key={r.code} value={r.code}>{r.s?.name ?? r.code}</option>)}
              </select>
            ) : undefined}>
            {mail && mailSup ? (
              <EmailPreview from={`${b.sentByName} <sourcing@ambergroupindia.com>`} to={`${mailSup.contactName} <${mailSup.contactEmail}>`} subject={mail.subject} body={mail.body} clamp />
            ) : <EmptyState icon="Mail" title="Email not available" desc="The template used for this campaign was removed." />}
          </Panel>
        </div>

        <Panel className="xl:col-span-5" pad={false} title="Recipients" sub={`${f.sent} vendors · ${f.replied} replied · ${f.opened - f.replied} opened`}>
          {pp.slice.map(({ code, s, state }) => (
            <div key={code} className="px-4 py-2.5 border-t border-line first:border-t-0 flex items-center gap-3">
              <span className="h-8 w-8 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold bg-slate-100 text-ink-2">{(s?.name ?? code).slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 min-w-0"><span className="text-[12.5px] font-medium text-ink truncate">{s?.name ?? code}</span><span className="font-mono text-[10.5px] text-muted shrink-0">{code}</span></span>
                <span className="block text-[11.5px] text-muted truncate">{s ? `${s.contactName} · ${s.city} · ${s.contactEmail}` : 'Not in vendor master'}</span>
              </span>
              <Pill tone={STATE_TONE[state]} dot={state === 'Replied'}>{state}</Pill>
            </div>
          ))}
          <Pager className="px-4 py-2 border-t border-line" {...pp} onPage={setPPage} noun="vendors" />
        </Panel>
      </div>

      {reminderOpen && (
        <NewCampaignWizard open={reminderOpen} onClose={() => setReminderOpen(false)} initialTemplateId="ST03"
          preset={{ kind: 'Reminder', commodities: b.commodities, only: silent, name: `Reminder · ${name}`, replyBy: b.replyBy }} />
      )}
    </div>
  )
}
