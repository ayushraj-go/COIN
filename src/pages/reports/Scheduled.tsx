// MIS scheduled emails for the current workspace: each report's frequency, next send date and recipients
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Avatar, Tooltip, DataTable, Button, Icon, type Column } from '../../components/ui'
import { useStore } from '../../store/useStore'
import { type Space, MIS_REPORTS, SPACE_ORDER, SPACE_META } from './space'
import { reportHref } from './Library'
import { addMonthsYm, fmtDate, parse, thirdWorkingDay, ymOf, iso, fyOf, fyEnd, addWorkingDays, daysBetween, monthLong } from '../../lib/format'
import type { RoleKey, User } from '../../lib/types'
import { FREQ_STYLE, SectionNote } from './chartkit'

const AUDIENCE_ROLES: Record<string, { roles?: RoleKey[]; dept?: string; owners?: boolean }[]> = {
  'Sourcing team': [{ roles: ['buyer', 'lead', 'head'] }],
  'Sourcing Head, Management': [{ roles: ['head', 'mgmt'] }],
  'Commodity Leads': [{ roles: ['lead'] }],
  'Sourcing Head': [{ roles: ['head'] }],
  'Sourcing, supplier reviews': [{ roles: ['buyer', 'lead', 'head'] }],
  'Owners, Leads': [{ roles: ['buyer', 'lead'] }],
  'Sourcing Excellence': [{ dept: 'Sourcing Excellence' }],
  'Finance, Sourcing Head': [{ roles: ['finance', 'head'] }],
  'Management, Finance': [{ roles: ['mgmt', 'finance'] }],
}
export function audienceUsers(audience: string, users: User[]) {
  const rules = AUDIENCE_ROLES[audience] ?? []
  return users.filter((u) => u.active && rules.some((r) => (r.roles ? u.roles.some((x) => r.roles!.includes(x)) : false) || (r.dept ? u.department === r.dept : false)))
}

/** Cadence rule and next send date per frequency (demo today from the system clock) */
export function schedule(freq: string, today: string, campaigns: { name: string; endDate: string; status: string }[], lrm: string) {
  const d = parse(today)
  const monthly = () => { const cur = thirdWorkingDay(ymOf(today)); return cur >= today ? cur : thirdWorkingDay(addMonthsYm(ymOf(today), 1)) }
  switch (freq) {
    case 'Live': return { rule: 'Live dashboard — always current; no scheduled email', next: null as string | null, covers: 'Real time' }
    case 'Live / monthly': return { rule: 'Live dashboard + monthly email on the 3rd working day, after the realisation run', next: monthly(), covers: `${monthLong(addMonthsYm(ymOf(monthly()), -1))} realisation` }
    case 'Monthly': return { rule: '3rd working day of each month, after the realisation run', next: monthly(), covers: `${monthLong(addMonthsYm(ymOf(monthly()), -1))} realisation` }
    case 'Weekly': {
      const add = (8 - d.getDay()) % 7 || 7
      return { rule: 'Every Monday, 09:00', next: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + add)), covers: 'Open ideas as of the send date' }
    }
    case 'Quarterly': {
      const qStarts = ['04', '07', '10', '01']
      const cands = [0, 1, 2, 3, 4].map((k) => thirdWorkingDay(addMonthsYm(ymOf(today), k))).filter((x) => qStarts.includes(x.slice(5, 7)) && x >= today)
      return { rule: '3rd working day after each quarter end (Q1 Apr–Jun … Q4 Jan–Mar)', next: cands[0] ?? null, covers: 'Previous quarter' }
    }
    case 'Annual': {
      const fy = fyOf(today)
      const next = thirdWorkingDay(addMonthsYm(ymOf(fyEnd(fy)), 1))
      return { rule: 'After FY close (31 March) — 3rd working day of April', next, covers: `${fy} closure & carry-over` }
    }
    case 'Per campaign': {
      const open = campaigns.filter((c) => c.status !== 'Closed' && c.endDate >= today).sort((a, b) => a.endDate.localeCompare(b.endDate))
      const c = open[0]
      return { rule: 'Working day after each campaign / workshop closes', next: c ? addWorkingDays(c.endDate, 1) : null, covers: c ? c.name : 'No open campaign' }
    }
    default: return { rule: '—', next: null, covers: '—' }
  }
  void lrm
}

export default function Scheduled({ today, onOpenMailer, space }: { today: string; onOpenMailer: () => void; space: Space | null }) {
  const users = useStore((s) => s.users)
  const campaigns = useStore((s) => s.campaigns)
  const settings = useStore((s) => s.settings)
  const nav = useNavigate()
  const rows = useMemo(() => (space ? [space] : SPACE_ORDER).flatMap((sp) => MIS_REPORTS[sp]).map((r) => ({ ...r, id: `${r.space}-${r.key}`, s: schedule(r.frequency, today, campaigns, settings.lastRealisationMonth), people: audienceUsers(r.audience, users) })), [space, today, campaigns, users, settings.lastRealisationMonth])
  const showMailer = space !== 'IN'
  const mailer = schedule('Monthly', today, campaigns, settings.lastRealisationMonth)
  const cols: Column<(typeof rows)[number]>[] = [
    ...(space ? [] : [{ key: 'space', label: 'Workspace', value: (r: (typeof rows)[number]) => r.space, render: (r: (typeof rows)[number]) => <Badge color={SPACE_META[r.space].color}>{r.space}</Badge> }]),
    { key: 'n', label: '#', width: 40, value: (r) => r.n, render: (r) => <span className="h-6 w-6 rounded-md bg-slate-100 text-ink-2 text-[11px] font-bold grid place-items-center">{r.n}</span> },
    { key: 'name', label: 'Report', value: (r) => r.name, render: (r) => <span className="font-semibold text-ink">{r.name}</span> },
    { key: 'audience', label: 'Audience', value: (r) => r.audience },
    { key: 'frequency', label: 'Frequency', value: (r) => r.frequency, render: (r) => <Badge color={FREQ_STYLE[r.frequency] ?? '#64748b'} dot>{r.frequency}</Badge> },
    { key: 'rule', label: 'Schedule', value: (r) => r.s.rule, render: (r) => <span className="block max-w-[300px] truncate text-ink-2" title={r.s.rule}>{r.s.rule}</span> },
    { key: 'next', label: 'Next send', value: (r) => r.s.next ?? '9999', render: (r) => (r.s.next ? <span className="num font-semibold text-ink">{fmtDate(r.s.next)} <span className="text-muted font-normal">· in {daysBetween(today, r.s.next)} d</span></span> : <span className="text-muted">Live</span>) },
    {
      key: 'recipients', label: 'Recipients', value: (r) => r.people.map((u) => u.email).join(', '),
      render: (r) => (
        <Tooltip content={<div className="space-y-0.5">{r.people.map((u) => <div key={u.id}>{u.name} · {u.email}</div>)}</div>}>
          <span className="inline-flex items-center">
            <span className="flex -space-x-1.5">{r.people.slice(0, 5).map((u) => <Avatar key={u.id} name={u.name} color={u.avatarColor} size={22} ring />)}</span>
            <span className="ml-2 text-[12px] text-muted">{r.people.length}</span>
          </span>
        </Tooltip>
      ),
    },
    { key: 'open', label: '', render: (r) => <Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={(e) => { e.stopPropagation(); nav(reportHref(r, space)) }}>Open</Button> },
  ]
  return (
    <div className="grid gap-3">
      <div className="grid gap-3">
        <Card title="Scheduled report emails" icon="CalendarClock" subtitle="Each report is emailed as PDF + Excel with the recipient's commodity scope">
          <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} exportName={`COIN_Scheduled_emails_${space ?? 'all'}`} onRowClick={(r) => nav(reportHref(r, space))} />
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {showMailer && <div className="card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-2"><Icon name="Mail" size={14} />Monthly Cost Optimisation Report <Badge color={SPACE_META.CO.color}>CO</Badge></div>
            <div className="text-[22px] font-bold text-ink mt-1 num">{mailer.next ? fmtDate(mailer.next) : '—'}</div>
            <div className="text-[12px] text-muted">Next automatic send · after the realisation run on the 3rd working day · {settings.mailerRecipients.length} management recipients + Commodity Lead cuts</div>
            <Button size="sm" className="mt-3" iconRight="ArrowRight" onClick={onOpenMailer}>Open monthly mailer</Button>
          </div>}
          <Card title="Cadence by frequency" icon="Repeat">
            <div className="space-y-2">
              {['Live', 'Live / monthly', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Per campaign'].filter((f) => rows.some((r) => r.frequency === f)).map((f) => {
                const s = schedule(f, today, campaigns, settings.lastRealisationMonth)
                return (
                  <div key={f} className="flex items-start gap-2.5">
                    <Badge color={FREQ_STYLE[f]} dot className="shrink-0 mt-0.5">{f}</Badge>
                    <div className="min-w-0 text-[12px] leading-snug"><div className="text-ink-2">{s.rule}</div>{s.next && <div className="text-muted">Next {fmtDate(s.next)} · {s.covers}</div>}</div>
                  </div>
                )
              })}
            </div>
          </Card>
          <div className="lg:col-span-2"><SectionNote icon="ShieldCheck">Scheduled emails respect access control — each recipient receives only the commodities mapped to them unless their role is organisation-wide.</SectionNote></div>
        </div>
      </div>
    </div>
  )
}
