// M7 — Campaign page: live yield counter, conversion, ideas, attendance, invite log, post-workshop summary.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import type { Idea, LeverGroup } from '../lib/types'
import { useMe, useStore } from '../store/useStore'
import { can } from '../lib/nav'
import { BUCKET_STYLE, ideaAnnualised } from '../lib/calc'
import { LEVER_GROUP_STYLE } from '../lib/masters'
import { addDays, daysBetween, fmtDate, fmtDateTime, inrShort, sum, todayIso } from '../lib/format'
import {
  Avatar, Badge, Button, Card, Count, DataTable, EmptyState, Icon, InfoTip, KV, LeverChip, Money, PageHeader, ProgressBar, SkeletonGrid, StageBadge, Tooltip, UserChip, cn, useWarmup, type Column,
} from '../components/ui'
import {
  ATTENDANCE, ATT_STYLE, AttendanceBar, CampaignFormModal, CampaignStatusBadge, CampaignTypeBadge, GOLD, PRIMARY, campaignStats, copyText, dateRange, launchWithToast, submissionLink, YTick, type AttendanceStatus,
} from './campaign/shared'
import OutreachCampaignDetail from './campaign/CampaignDetail'
import { useOutreachBatches } from './campaign/Outreach'

/** /campaigns/:id — an email campaign (outreach batch) or a workshop / commodity campaign */
export default function CampaignPage() {
  const { id } = useParams()
  const batch = useOutreachBatches().find((b) => b.id === id)
  if (batch) return <OutreachCampaignDetail batch={batch} />
  return <WorkshopCampaignPage />
}

function WorkshopCampaignPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const campaign = useStore((s) => s.campaigns.find((c) => c.id === id))
  const ideas = useStore((s) => s.ideas)
  const commodities = useStore((s) => s.commodities)
  const categories = useStore((s) => s.categories)
  const suppliers = useStore((s) => s.suppliers)
  const users = useStore((s) => s.users)
  const levers = useStore((s) => s.levers)
  const emails = useStore((s) => s.emails)
  const { updateCampaign, setAttendance, openIdea, toast } = useStore.getState()
  const ready = useWarmup()
  const [editOpen, setEditOpen] = useState(false)
  const [summary, setSummary] = useState(campaign?.summary ?? '')
  const [openMail, setOpenMail] = useState<string | null>(null)
  useEffect(() => { setSummary(campaign?.summary ?? '') }, [campaign?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => (campaign ? campaignStats(campaign, ideas) : null), [campaign, ideas])
  const byLever = useMemo(() => {
    if (!stats) return []
    const m = new Map<string, { leverId: string; name: string; group: LeverGroup; value: number; count: number }>()
    stats.list.filter((i) => i.bucket !== 'Dropped').forEach((i) => {
      const l = levers.find((x) => x.id === i.leverId)
      const r = m.get(i.leverId) ?? { leverId: i.leverId, name: l?.name ?? i.leverId, group: (l?.group ?? 'Commercial') as LeverGroup, value: 0, count: 0 }
      r.value += ideaAnnualised(i); r.count++
      m.set(i.leverId, r)
    })
    return [...m.values()].sort((a, b) => b.value - a.value)
  }, [stats, levers])

  if (!campaign || !stats) {
    return <Card><EmptyState icon="Megaphone" title="Campaign not found" desc={`No campaign with ID ${id} exists.`} action={<Button icon="ArrowLeft" onClick={() => nav('/campaigns')}>Back to campaigns</Button>} /></Card>
  }
  if (!ready) return <><PageHeader icon="Megaphone" title={campaign.name} subtitle="Loading campaign…" /><SkeletonGrid rows={3} /></>

  const c = campaign
  const canManage = can(me, 'campaign')
  const cm = commodities.find((x) => x.code === c.commodity)
  const cat = categories.find((x) => x.id === c.categoryId)
  const mails = emails.filter((e) => e.subject.includes(c.name) || e.body.includes(c.name))
  const daysLeft = daysBetween(todayIso(), c.endDate)
  const link = submissionLink(c.id)
  const supIdeas = (code: string) => stats.list.filter((i) => i.supplierCode === code && i.isSupplierSubmission).length
  const groupsPresent = [...new Set(byLever.map((b) => b.group))]

  const close = () => {
    updateCampaign(c.id, { status: 'Closed' })
    toast(`${c.name} closed — add the post-workshop summary below`, 'success', () => updateCampaign(c.id, { status: 'Live' }))
    setTimeout(() => document.getElementById('summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }
  const reopen = () => { updateCampaign(c.id, { status: 'Live' }); toast(`${c.name} reopened for submissions`, 'info', () => updateCampaign(c.id, { status: 'Closed' })) }
  const mark = (code: string, st: AttendanceStatus) => {
    const prev = c.attendance[code]
    if (prev === st) return
    setAttendance(c.id, code, st)
    const name = suppliers.find((s) => s.code === code)?.name ?? code
    toast(`${name} marked ${st}`, 'success', () => setAttendance(c.id, code, prev ?? 'Invited'))
  }
  const saveSummary = () => { updateCampaign(c.id, { summary: summary.trim() }); toast('Post-workshop summary saved', 'success') }
  const snapshot = () => {
    const a = stats.att
    const lines = `${stats.count} ideas captured (${stats.supplierIdeas} from suppliers) worth ${inrShort(stats.value)} annualised; ${stats.implemented} implemented — conversion ${stats.conversion.toFixed(0)}%. Attendance: ${a.Attended} attended, ${a.Accepted} accepted, ${a.Declined} declined, ${a.Invited} awaiting reply.${byLever[0] ? ` Largest lever: ${byLever[0].name} (${inrShort(byLever[0].value)}).` : ''}`
    setSummary((s) => (s.trim() ? `${s.trim()}\n${lines}` : lines))
  }

  const columns: Column<Idea>[] = [
    { key: 'id', label: 'Idea ID', render: (i) => <span className="font-mono text-[12px] font-semibold text-ink">{i.id}</span>, value: (i) => i.id },
    { key: 'title', label: 'Title', render: (i) => <span className="block max-w-[170px] truncate text-ink" title={i.title}>{i.title}</span>, value: (i) => i.title },
    { key: 'submitter', label: 'Submitted by', render: (i) => <span className="block leading-tight"><span className="block truncate max-w-[120px]">{i.submitterName}</span>{i.isSupplierSubmission && <span className="block text-[11px] text-muted">Supplier</span>}</span>, value: (i) => i.submitterName },
    { key: 'lever', label: 'Lever', render: (i) => <LeverChip leverId={i.leverId} compact />, value: (i) => levers.find((l) => l.id === i.leverId)?.name },
    { key: 'stage', label: 'Stage', render: (i) => <StageBadge stage={i.stage} bucket={i.bucket} />, value: (i) => i.stage },
    { key: 'value', label: 'Annualised', align: 'right', render: (i) => <span className="num font-semibold" style={{ color: i.bucket === 'Dropped' ? '#6b7280' : undefined }}>{inrShort(ideaAnnualised(i))}</span>, value: (i) => ideaAnnualised(i) },
  ]

  return (
    <div>
      <Link to="/campaigns?tab=workshops" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-brand-700 mb-2"><Icon name="ArrowLeft" size={14} />Workshops &amp; drives</Link>
      <PageHeader icon={c.type === 'Workshop' ? 'Presentation' : 'Megaphone'} title={c.name}
        badge={<span className="hidden sm:inline-flex items-center gap-1.5"><CampaignStatusBadge status={c.status} /><CampaignTypeBadge type={c.type} /></span>}
        subtitle={`${c.id} · ${cm?.name ?? c.commodity} · ${cat?.name ?? ''} · ${dateRange(c.startDate, c.endDate)}`}
        actions={<>
          <Button icon="Table2" onClick={() => nav(`/ideas?campaign=${c.id}`)}>Idea Register</Button>
          {canManage && <Button icon="Pencil" onClick={() => setEditOpen(true)}>Edit</Button>}
          {canManage && c.status === 'Live' && <Button icon="Lock" onClick={close}>Close campaign</Button>}
          {canManage && c.status === 'Closed' && <Button icon="RotateCcw" onClick={reopen}>Reopen</Button>}
          {canManage && c.status === 'Draft' && <Button variant="primary" icon="Send" onClick={() => launchWithToast(c.id)}>Launch &amp; send auto-invites</Button>}
          {c.status === 'Live' && <Button variant="primary" icon="CirclePlus" onClick={() => nav(`/submit?campaign=${c.id}`)}>Submit idea</Button>}
        </>} />

      {/* ─── Row 1: live yield · details · submission link ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-5 card p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                {c.status === 'Live' && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                Live yield
              </span>
              <InfoTip title="Idea yield per campaign / workshop" formula="Ideas, ₹ value and conversion per campaign">Ideas tagged to this campaign (drafts excluded). ₹ value is the annualised impact of ideas not dropped. Conversion = implemented ÷ submitted.</InfoTip>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-[11.5px] text-muted font-medium">Ideas</div>
                <div className="text-[30px] leading-none font-semibold text-ink tracking-tight"><Count value={stats.count} /></div>
                <div className="text-[11.5px] text-muted mt-1">{stats.supplierIdeas} from suppliers</div>
              </div>
              <div>
                <div className="text-[11.5px] text-muted font-medium">₹ value (annualised)</div>
                <div className="text-[30px] leading-none font-semibold tracking-tight text-ink"><Money value={stats.value} /></div>
                <div className="text-[11.5px] text-muted mt-1">excl. dropped ideas</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white border border-line text-[12px]">
                <Icon name="Percent" size={13} className="text-amber-600" />Conversion <b className="num">{stats.conversion.toFixed(1)}%</b>
                <InfoTip title="Conversion" formula="Implemented ÷ submitted">{stats.implemented} implemented of {stats.count} submitted.</InfoTip>
              </span>
              {(['Pipeline', 'In Execution', 'Implemented', 'Dropped'] as const).map((b) => (
                <Tooltip key={b} content={`${stats.buckets[b]} ${b} — open in Idea Register`}>
                  <button onClick={() => nav(`/ideas?campaign=${c.id}&bucket=${encodeURIComponent(b)}`)} className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border text-[12px] font-semibold hover:shadow-sm" style={{ color: BUCKET_STYLE[b].text, background: BUCKET_STYLE[b].soft, borderColor: `${BUCKET_STYLE[b].color}33` }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: BUCKET_STYLE[b].color }} />{b}<span className="num">{stats.buckets[b]}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>

        <Card className="lg:col-span-4" title="Details" icon="Info">
          <KV k="Type" v={<CampaignTypeBadge type={c.type} />} />
          <KV k="Commodity" v={`${cm?.name ?? c.commodity} (${c.commodity}) · ${cat?.name ?? ''}`} />
          <KV k="Dates" v={<>{dateRange(c.startDate, c.endDate)}{c.status === 'Live' && <span className={cn('ml-1.5 text-[11px]', daysLeft <= 7 ? 'text-amber-700' : 'text-muted')}>· {daysLeft >= 0 ? `${daysLeft}d left` : 'past end date'}</span>}</>} />
          {c.workshopDate && <KV k="Workshop date" v={<>{fmtDate(c.workshopDate)} <span className="text-[11px] text-muted">· reminder {fmtDate(addDays(c.workshopDate, -2))}</span></>} />}
          {c.venue && <KV k="Venue" v={c.venue} />}
          <KV k="Suppliers invited" v={`${c.suppliers.length} · ${c.internalInvitees.length} internal`} />
          <KV k="Created by" v={<UserChip userId={c.createdBy} size={20} />} />
          <KV k="Invites sent" v={c.invitesSentAt ? fmtDateTime(c.invitesSentAt) : <span className="text-muted">Not launched</span>} />
          {c.description && <p className="text-[12px] text-muted leading-relaxed mt-2">{c.description}</p>}
        </Card>

        <Card className="lg:col-span-3" title="Submission link" subtitle="Opens Submit Idea with this campaign pre-set" icon="Link2">
          <div className="rounded-xl border border-line bg-slate-50/70 px-3 py-2.5 font-mono text-[11.5px] text-ink-2 break-all">{link}</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button size="sm" variant="primary" icon="Copy" onClick={() => copyText(link, 'Submission link')}>Copy link</Button>
            <Button size="sm" icon="ExternalLink" disabled={c.status !== 'Live'} onClick={() => nav(`/submit?campaign=${c.id}`)}>Open form</Button>
          </div>
          {c.status !== 'Live' && <div className="text-[11.5px] text-muted mt-2">{c.status === 'Draft' ? 'The link accepts ideas once the campaign is launched.' : 'Campaign closed — new ideas are no longer tagged to it.'}</div>}
          <div className="label mt-3">Internal invitees</div>
          <div className="flex flex-wrap gap-1">
            {c.internalInvitees.map((uid) => { const u = users.find((x) => x.id === uid); return u ? <Tooltip key={uid} content={<>{u.name}<div className="text-slate-300">{u.designation}</div></>}><Avatar name={u.name} color={u.avatarColor} size={26} /></Tooltip> : null })}
            {!c.internalInvitees.length && <span className="text-[12px] text-muted">None</span>}
          </div>
        </Card>
      </div>

      {/* ─── Row 2: ideas · yield by lever ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <Card className="lg:col-span-8" title={`Ideas in this ${c.type.toLowerCase()}`} subtitle="Click a row to open the side panel" icon="Lightbulb">
          <DataTable rows={stats.list} columns={columns} rowKey={(i) => i.id} onRowClick={(i) => openIdea(i.id)} exportName={`COIN_${c.id}_ideas`} maxHeight={380}
            empty={<EmptyState icon="Lightbulb" title={`No ideas yet — submit the first idea for ${cm?.name ?? c.commodity}`} desc="Share the submission link with invited suppliers and internal teams."
              action={c.status === 'Live' ? <Button variant="primary" icon="CirclePlus" onClick={() => nav(`/submit?campaign=${c.id}`)}>Submit idea</Button> : undefined} />} />
        </Card>
        <Card className="lg:col-span-4" title="Yield by lever" subtitle="Annualised ₹ of ideas not dropped · click a bar to drill down" icon="ChartBar">
          {byLever.length ? (
            <>
              <div style={{ height: Math.max(140, byLever.length * 34 + 20) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byLever} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
                    <CartesianGrid horizontal={false} stroke="#eceef6" />
                    <XAxis type="number" tickFormatter={(v) => inrShort(v, 0)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={124} tick={<YTick max={19} />} axisLine={false} tickLine={false} />
                    <RTooltip cursor={{ fill: 'rgb(36 89 224 / .05)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as (typeof byLever)[number]
                      return (
                        <div className="rounded-xl bg-white border border-line shadow-xl px-3 py-2 text-[12px]">
                          <div className="font-semibold text-ink">{d.name}</div>
                          <div className="text-[11px] mb-1" style={{ color: LEVER_GROUP_STYLE[d.group].text }}>{d.group}</div>
                          <div className="flex justify-between gap-4"><span className="text-muted">Annualised</span><b className="num">{inrShort(d.value)}</b></div>
                          <div className="flex justify-between gap-4"><span className="text-muted">Ideas</span><b className="num">{d.count}</b></div>
                        </div>
                      )
                    }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} cursor="pointer" onClick={(d: any) => nav(`/ideas?campaign=${c.id}&lever=${d.leverId}`)}>
                      {byLever.map((d) => <Cell key={d.leverId} fill={LEVER_GROUP_STYLE[d.group].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                {groupsPresent.map((g) => <span key={g} className="inline-flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-sm" style={{ background: LEVER_GROUP_STYLE[g].color }} />{g}</span>)}
              </div>
            </>
          ) : <EmptyState icon="ChartBar" title="No yield yet" desc="Lever mix appears as ideas are submitted." />}
        </Card>
      </div>

      {/* ─── Row 3: attendance · invite email log ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <Card className="lg:col-span-7" title="Workshop attendance" subtitle={c.status === 'Draft' ? 'Suppliers are invited when the campaign is launched' : 'Invited / Accepted / Declined / Attended — click to update'} icon="UserCheck"
          actions={c.status !== 'Draft' && <span className="flex items-center gap-2 text-[11px] text-muted">{ATTENDANCE.map((a) => <span key={a} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: ATT_STYLE[a].color }} />{a} <b className="num text-ink">{stats.att[a]}</b></span>)}</span>} pad={false}>
          {c.status !== 'Draft' && <div className="px-4 pb-2"><AttendanceBar att={stats.att} total={c.suppliers.length} /></div>}
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Supplier</th><th className="!text-right">Ideas</th><th>Status</th></tr></thead>
              <tbody>
                {c.suppliers.map((code) => {
                  const s = suppliers.find((x) => x.code === code)
                  const st = c.attendance[code]
                  return (
                    <tr key={code}>
                      <td><Tooltip content={<>{s?.contactName}<div className="text-slate-300">{s?.contactEmail}</div></>}><div className="leading-tight"><div className="font-semibold text-ink text-[12.5px]">{s?.name ?? code}</div><div className="text-[11px] text-muted">{code} · {s?.city} · {s?.contactName}</div></div></Tooltip></td>
                      <td className="!text-right num font-semibold">{supIdeas(code)}</td>
                      <td>
                        {c.status === 'Draft' ? <span className="text-[12px] text-muted">Not invited yet</span> : (
                          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-line">
                            {ATTENDANCE.map((a) => (
                              <button key={a} disabled={!canManage} onClick={() => mark(code, a)}
                                className={cn('h-7 px-2 rounded-md text-[11.5px] font-semibold transition-colors inline-flex items-center gap-1', st === a ? 'bg-white shadow-sm border border-line' : 'text-muted hover:text-ink border border-transparent', !canManage && 'cursor-default')}
                                style={st === a ? { color: ATT_STYLE[a].color } : undefined}>
                                {st === a && <Icon name={ATT_STYLE[a].icon} size={12} />}{a}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!c.suppliers.length && <EmptyState icon="Factory" title="No suppliers on this campaign" desc="Edit the campaign to add suppliers from the vendor master." />}
        </Card>

        <Card className="lg:col-span-5" title="Invite email log" subtitle={`${mails.length} email${mails.length === 1 ? '' : 's'} for this campaign`} icon="Mails" pad={false}>
          <div>
            {mails.map((m) => (
              <div key={m.id} className="border-t border-line first:border-t-0">
                <button onClick={() => setOpenMail(openMail === m.id ? null : m.id)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Icon name="Mail" size={13} className="text-brand-600 shrink-0" />
                    <span className="text-[12.5px] font-semibold text-ink truncate flex-1">{m.subject}</span>
                    <span className="text-[10.5px] text-muted shrink-0">{fmtDateTime(m.at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 pl-5">
                    <Badge color={PRIMARY}>{m.template}</Badge>
                    <span className="text-[11px] text-muted truncate">To {m.to.length} · {m.to.join(', ')}</span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {openMail === m.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mx-4 mb-3 rounded-lg bg-slate-50 border border-line px-3 py-2 text-[12px] text-ink-2 whitespace-pre-wrap">
                        <div className="flex flex-wrap gap-1 mb-1.5">{m.to.map((t) => <span key={t} className="px-1.5 rounded bg-white border border-line text-[11px]">{t}</span>)}</div>
                        {m.body}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {!mails.length && <div className="px-4 pb-4 text-[12.5px] text-muted">{c.status === 'Draft' ? 'Launch the campaign to send auto-invite emails to its suppliers and internal invitees.' : 'No emails logged for this campaign.'}</div>}
          </div>
        </Card>
      </div>

      {/* ─── Row 4: post-workshop summary ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-8" title="Post-workshop summary" subtitle="What was agreed, which ideas move forward, and follow-ups" icon="NotebookPen"
          actions={<span className="text-[11px] text-muted">{summary.trim() === (c.summary ?? '').trim() ? (c.summary ? 'Saved' : 'Not written yet') : 'Unsaved changes'}</span>}>
          <div id="summary">
            <textarea className="input" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canManage}
              placeholder="e.g. 14 ideas captured; 5 approved in 3 weeks; motor-winding localisation and shell gauge VE taken to NPD." />
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Button size="sm" icon="Sparkles" onClick={snapshot}>Insert yield snapshot</Button>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" disabled={summary === (c.summary ?? '')} onClick={() => setSummary(c.summary ?? '')}>Discard</Button>
                <Button size="sm" variant="primary" icon="Save" disabled={summary.trim() === (c.summary ?? '').trim()} onClick={saveSummary}>Save summary</Button>
              </div>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-4" title="Submissions by source" subtitle="Supplier-led vs internal ideas" icon="Users">
          {(() => {
            const sup = stats.list.filter((i) => i.isSupplierSubmission)
            const int = stats.list.filter((i) => !i.isSupplierSubmission)
            const supV = sum(sup.filter((i) => i.bucket !== 'Dropped').map((i) => ideaAnnualised(i)))
            const intV = sum(int.filter((i) => i.bucket !== 'Dropped').map((i) => ideaAnnualised(i)))
            const depts = [...new Set(int.map((i) => i.department))]
            return (
              <div className="space-y-3">
                {[{ label: 'Suppliers', n: sup.length, v: supV, color: GOLD, icon: 'Factory' }, { label: 'Internal teams', n: int.length, v: intV, color: PRIMARY, icon: 'Building2' }].map((r) => (
                  <div key={r.label}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2"><Icon name={r.icon} size={13} style={{ color: r.color }} />{r.label}</span>
                      <span className="num"><b>{r.n}</b> <span className="text-muted">ideas · {inrShort(r.v)}</span></span>
                    </div>
                    <ProgressBar value={stats.count ? (r.n / stats.count) * 100 : 0} color={r.color} height={6} className="mt-1" />
                  </div>
                ))}
                <div className="text-[11.5px] text-muted">{depts.length ? `Internal departments: ${depts.join(', ')}` : 'No internal submissions yet.'}</div>
              </div>
            )
          })()}
        </Card>
      </div>

      <CampaignFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={c} />
    </div>
  )
}
