// Section 11 — Monthly management mailer: "COIN — Cost Optimisation Report, <Month YYYY>"
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Avatar, Icon, InfoTip, Modal, DataTable, Tooltip, KV, cn } from '../../components/ui'
import { useStore, useMe, hasRole } from '../../store/useStore'
import { ideaAnnualised } from '../../lib/calc'
import { MAILER, REALISATION_CYCLE } from '../../lib/scope'
import { inrShort, monthLong, monthLabel, fyOf, fmtDate, fmtDateTime, thirdWorkingDay, addMonthsYm, fyMonths, inr } from '../../lib/format'
import { exportExcel, exportPdf } from '../../lib/export'
import type { EmailLog } from '../../lib/types'
import { type Ctx, deriveCtx, mailerNumbers, commodityRows, dropData, realisedOf, nameOf, commodityName } from './model'
import { toPdf, toSheet, ideaDetail, type Table } from './specs'
import { SectionNote, pdfText } from './chartkit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ORG_WIDE = ['head', 'finance', 'mgmt', 'admin'] as const

export default function Mailer({ ctx }: { ctx: Ctx }) {
  const me = useMe()
  const nav = useNavigate()
  const ideasAll = useStore((s) => s.ideas)
  const ledger = useStore((s) => s.ledger)
  const emails = useStore((s) => s.emails)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setFilters = useStore((s) => s.setFilters)
  const toast = useStore((s) => s.toast)
  const canSend = hasRole(me, 'head', 'admin')
  const orgWide = hasRole(me, ...ORG_WIDE)
  const myCut = orgWide ? undefined : me?.commodities ?? []

  const months = useMemo(() => {
    const fy = fyOf(settings.lastRealisationMonth + '-01')
    return [...fyMonths(fy), ...fyMonths(`FY${String(Number(fy.slice(2)) - 1).padStart(2, '0')}`)].filter((m) => m <= settings.lastRealisationMonth).sort().reverse()
  }, [settings.lastRealisationMonth])
  const [month, setMonth] = useState(settings.lastRealisationMonth)
  useEffect(() => setMonth(settings.lastRealisationMonth), [settings.lastRealisationMonth])
  const fy = fyOf(month + '-01')
  const subject = `COIN — Cost Optimisation Report, ${monthLong(month)}${myCut ? ' (commodity cut)' : ''}`
  const n = useMemo(() => mailerNumbers(ideasAll, ledger, ctx.commodities, settings, month, fy, myCut), [ideasAll, ledger, ctx.commodities, settings, month, fy, myCut])
  const comms = useMemo(() => (myCut ? ctx.commodities.filter((c) => myCut.includes(c.code)) : ctx.commodities), [ctx.commodities, myCut])
  const mctx = useMemo(() => deriveCtx(ctx, n.ideas, comms, fy), [ctx, n.ideas, comms, fy])

  const headline: [string, number, string, string][] = [
    ['Realised to date', n.realised, 'BadgeIndianRupee', '#0f9f6e'],
    ['Committed (remaining)', n.committed, 'Rocket', '#ec8a1c'],
    ['Pipeline', n.pipeline, 'Filter', '#3b74f2'],
    ["Month's realised saving", n.monthRealised, 'CalendarCheck', '#2459e0'],
  ]

  // ─── attachments ────────────────────────────────────────────────────────
  const tables = (): Table[] => {
    const s = mctx.sum
    const bridge = [
      { step: settings.financeValidation ? 'Realised (validated)' : 'Realised', v: s.realisedCounting },
      { step: 'Committed (remaining)', v: s.remainingCommitted }, { step: 'Pipeline', v: s.pipeline },
      { step: 'Total tracked', v: s.realisedCounting + s.remainingCommitted + s.pipeline },
    ]
    const total = s.realisedCounting + s.remainingCommitted + s.pipeline
    const top = [...mctx.ideas].filter((i) => i.bucket !== 'Dropped').sort((a, b) => ideaAnnualised(b) - ideaAnnualised(a)).slice(0, 10)
    const drops = dropData(mctx).dropped.sort((a, b) => (b.droppedAt ?? '').localeCompare(a.droppedAt ?? ''))
    return [
      { title: 'Savings bridge', rows: bridge, cols: [{ h: 'Step', v: (r: any) => r.step }, { h: 'Value', v: (r: any) => r.v, f: 'inr' }, { h: '% of total tracked', v: (r: any) => (r.v / (total || 1)) * 100, f: 'pct' }] },
      { title: 'Commodity table', rows: commodityRows(mctx), cols: [{ h: 'Commodity', v: (r: any) => r.name }, { h: 'Realised', v: (r: any) => r.realised, f: 'inr' }, { h: 'Committed (remaining)', v: (r: any) => r.remaining, f: 'inr' }, { h: 'Pipeline', v: (r: any) => r.pipeline, f: 'inr' }, { h: 'Ideas', v: (r: any) => r.submitted, f: 'int' }, { h: 'Implemented', v: (r: any) => r.implemented, f: 'int' }] },
      { title: 'Top 10 ideas', rows: top, cols: [{ h: 'Idea ID', v: (i: any) => i.id }, { h: 'Title', v: (i: any) => i.title }, { h: 'Commodity', v: (i: any) => commodityName(mctx, i.commodity) }, { h: 'Stage', v: (i: any) => i.stage }, { h: 'Annualised', v: (i: any) => ideaAnnualised(i), f: 'inr' }, { h: 'Realised', v: (i: any) => realisedOf(mctx, [i]), f: 'inr' }] },
      { title: 'Drops with reasons', rows: drops, cols: [{ h: 'Idea ID', v: (i: any) => i.id }, { h: 'Title', v: (i: any) => i.title }, { h: 'Month', v: (i: any) => (i.droppedAt ? monthLabel(i.droppedAt.slice(0, 7)) : '—') }, { h: 'Reason', v: (i: any) => i.dropReason }, { h: 'Stage', v: (i: any) => i.dropStage }, { h: 'Remarks', v: (i: any) => i.dropRemarks }] },
    ] as Table[]
  }
  const pdfName = `COIN_Report_${month}`, xlsName = `COIN_Detail_${month}`
  const downloadPdf = () => {
    exportPdf({ filename: pdfName, title: pdfText(subject), subtitle: 'PFA, Cost Optimisation Report', filters: pdfText(`${fy} | report month ${monthLong(month)}${myCut ? ` | commodities ${myCut.join(', ')}` : ' | all commodities'}`), kpis: headline.map(([k, v]) => [pdfText(k), pdfText(inrShort(v))] as [string, string]), sections: tables().map(toPdf) })
    toast(`${pdfName}.pdf downloaded`, 'success')
  }
  const downloadXls = () => {
    const ms = mctx.months.filter((m) => m <= month)
    const led = mctx.led.filter((l) => ms.includes(l.month))
    exportExcel(xlsName, [
      { name: 'Headline', rows: headline.map(([k, v]) => ({ Item: k, 'Value (₹)': Math.round(v), Display: inrShort(v) })) },
      ...tables().map(toSheet),
      toSheet(ideaDetail(mctx, mctx.ideas, 'Idea detail')),
      { name: 'Realisation ledger', rows: led.map((l) => ({ Month: monthLabel(l.month), 'Idea ID': l.ideaId, Part: l.partCode, Supplier: l.supplierCode, 'MRN qty': l.mrnQty, 'Planned qty': l.plannedQty, 'Baseline (₹)': l.baseline, 'Approved (₹)': l.approvedPrice, 'MRN price (₹)': l.mrnPrice, 'Realised (₹)': Math.round(l.realised), 'Leakage (₹)': Math.round(l.leakage), Exceptions: l.exceptions.join(', '), 'Finance status': l.financeStatus })) },
    ])
    toast(`${xlsName}.xlsx downloaded`, 'success')
  }
  const openLink = () => { setFilters({ fy }); nav(`/reports/home?view=CO&month=${month}`) }

  // ─── recipients editor ──────────────────────────────────────────────────
  const [draft, setDraft] = useState<string[]>(settings.mailerRecipients)
  const [add, setAdd] = useState('')
  useEffect(() => setDraft(settings.mailerRecipients), [settings.mailerRecipients])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.mailerRecipients)
  const addErr = add && !EMAIL_RE.test(add.trim()) ? 'Enter a valid email address' : draft.includes(add.trim().toLowerCase()) ? 'Already on the list' : ''
  const doAdd = () => { const v = add.trim().toLowerCase(); if (!v || addErr) return; setDraft((d) => [...d, v]); setAdd('') }
  const saveList = () => {
    const prev = settings.mailerRecipients
    updateSettings({ mailerRecipients: draft })
    toast(`Distribution list saved · ${draft.length} recipients`, 'success', () => updateSettings({ mailerRecipients: prev }))
  }
  const leads = useMemo(() => [...new Set(ctx.commodities.map((c) => c.leadId))].map((id) => ({ id, user: ctx.users.find((u) => u.id === id), codes: ctx.commodities.filter((c) => c.leadId === id).map((c) => c.code) })), [ctx.commodities, ctx.users])
  const cutOf = (codes: string[]) => mailerNumbers(ideasAll, ledger, ctx.commodities, settings, month, fy, codes)

  // ─── send ───────────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState(false)
  const send = () => {
    useStore.getState().sendMonthlyReport(month, true)
    setConfirm(false)
    toast(`Monthly report for ${monthLong(month)} sent to ${settings.mailerRecipients.length} recipients + ${leads.length} Commodity Leads (commodity cut)`, 'success')
  }
  const sent = emails.filter((e) => e.template === 'Monthly Cost Optimisation Report')
  const nextAutoMonth = addMonthsYm(settings.lastRealisationMonth, 1)
  const nextAuto = thirdWorkingDay(addMonthsYm(nextAutoMonth, 1))
  const autoFor = thirdWorkingDay(addMonthsYm(month, 1))

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Email preview */}
        <section className="xl:col-span-8 card overflow-hidden rounded-2xl shadow-[0_18px_40px_-28px_rgb(15_23_42/.35)]">
          <div className="flex items-center gap-2 px-4 h-11 border-b border-line bg-slate-50/70">
            <Icon name="Mail" size={16} className="text-ink-2" />
            <span className="text-[12.5px] font-semibold text-ink">Email preview</span>
            <Badge color="#2459e0">{myCut ? 'Commodity cut' : 'Management list'}</Badge>
            <span className="ml-auto flex items-center gap-2">
              <select className="input !h-8 !w-auto text-[12.5px] font-semibold" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month">
                {months.map((m) => <option key={m} value={m}>{monthLong(m)}</option>)}
              </select>
            </span>
          </div>
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 space-y-1.5 text-[12.5px]">
            <div className="flex gap-3"><span className="w-16 text-muted shrink-0">From</span><span className="font-medium text-ink">COIN · Cost Innovation Hub &lt;coin-noreply@ambergroupindia.com&gt;</span></div>
            <div className="flex gap-3"><span className="w-16 text-muted shrink-0">To</span>
              <span className="flex flex-wrap gap-1 min-w-0">{(myCut ? [me?.email ?? ''] : settings.mailerRecipients).map((r) => <span key={r} className="inline-flex items-center h-6 px-2 rounded-full bg-slate-100 text-[11.5px] font-medium text-ink-2">{r}</span>)}</span>
            </div>
            <div className="flex gap-3"><span className="w-16 text-muted shrink-0">Subject</span><span className="font-bold text-ink">{subject}</span></div>
            <div className="flex gap-3"><span className="w-16 text-muted shrink-0">Sent</span><span className="text-ink-2">{fmtDate(autoFor)} · automatically after the {monthLong(month)} realisation run (3rd working day)</span></div>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13.5px] text-ink">PFA, Cost Optimisation Report</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              {headline.map(([k, v, icon, c]) => (
                <div key={k} className="rounded-xl border border-line bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/.04)]">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted"><Icon name={icon} size={12} style={{ color: c }} />{k}</div>
                  <div className="text-[18px] font-bold num mt-1" style={{ color: c }}>{inrShort(v)}</div>
                  <div className="text-[10.5px] text-muted num">{inr(v)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">Attachments</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={downloadPdf} className="group flex items-center gap-2.5 rounded-xl border border-line bg-white pl-2 pr-3 py-2 hover:border-brand-200 hover:bg-brand-50/40 transition">
                  <span className="h-9 w-9 rounded-lg bg-red-50 text-red-600 grid place-items-center"><Icon name="FileText" size={18} /></span>
                  <span className="text-left"><span className="block text-[12.5px] font-semibold text-ink">{pdfName}.pdf</span><span className="block text-[11px] text-muted">PDF summary · savings bridge, commodity table, top 10 ideas, drops with reasons</span></span>
                  <Icon name="Download" size={15} className="text-muted group-hover:text-brand-600" />
                </button>
                <button onClick={downloadXls} className="group flex items-center gap-2.5 rounded-xl border border-line bg-white pl-2 pr-3 py-2 hover:border-brand-200 hover:bg-brand-50/40 transition">
                  <span className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center"><Icon name="FileSpreadsheet" size={18} /></span>
                  <span className="text-left"><span className="block text-[12.5px] font-semibold text-ink">{xlsName}.xlsx</span><span className="block text-[11px] text-muted">Excel detail · ideas, ledger, commodities, drops</span></span>
                  <Icon name="Download" size={15} className="text-muted group-hover:text-brand-600" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-line px-3 py-2.5">
              <Icon name="Link" size={15} className="text-ink-2" />
              <span className="text-[12.5px] text-ink-2">Link — opens the live dashboard with the same month's filter</span>
              <Button size="sm" variant="primary" iconRight="ArrowUpRight" className="ml-auto" onClick={openLink}>Open live dashboard · {monthLabel(month)}</Button>
            </div>
            <div className="mt-3 text-[11.5px] text-muted">— COIN · Cost Innovation Hub · Amber Enterprises India Ltd.</div>
          </div>
        </section>

        {/* Trigger, recipients, commodity cuts */}
        <div className="xl:col-span-4 grid gap-3 content-start">
          <Card title="Trigger" icon="Zap" actions={<InfoTip title="Monthly realisation cycle">{REALISATION_CYCLE[0]}</InfoTip>}>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex gap-2.5 items-start"><span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0"><Icon name="CalendarClock" size={14} /></span><div><div className="font-semibold text-ink">Automatic</div><div className="text-muted leading-snug">After the monthly realisation run (3rd working day). Next: <b className="text-ink">{fmtDate(nextAuto)}</b> for {monthLong(nextAutoMonth)}.</div></div></div>
              <div className="flex gap-2.5 items-start"><span className="h-7 w-7 rounded-lg bg-gold-50 text-gold-600 grid place-items-center shrink-0"><Icon name="Send" size={14} /></span><div><div className="font-semibold text-ink">Manual</div><div className="text-muted leading-snug">Sent by the Sourcing Head at any time for the selected month.</div></div></div>
            </div>
            <div className="mt-3">
              {canSend
                ? <Button variant="primary" icon="Send" className="w-full" onClick={() => setConfirm(true)}>Send now · {monthLong(month)}</Button>
                : <Tooltip content="Only the Sourcing Head (or Admin) can send the monthly report manually" className="w-full"><Button icon="Lock" className="w-full" disabled>Send now · Sourcing Head only</Button></Tooltip>}
            </div>
          </Card>
          <Card title="Recipients" icon="Users" subtitle="Configurable management distribution list" actions={<Badge color="#1e3a5f">{draft.length}</Badge>}>
            <div className="flex flex-wrap gap-1.5">
              {draft.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-slate-100 text-[12px] font-medium text-ink-2">
                  {r}
                  {canSend && <button onClick={() => setDraft((d) => d.filter((x) => x !== r))} className="h-5 w-5 rounded-full grid place-items-center hover:bg-white text-muted hover:text-red-600" aria-label={`Remove ${r}`}><Icon name="X" size={12} /></button>}
                </span>
              ))}
              {!draft.length && <span className="text-[12px] text-red-600">No recipients — add at least one address.</span>}
            </div>
            {canSend && (
              <>
                <div className="flex gap-2 mt-2.5">
                  <input className="input" placeholder="name@ambergroupindia.com" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doAdd()} />
                  <Button icon="Plus" onClick={doAdd} disabled={!add || !!addErr}>Add</Button>
                </div>
                {addErr && <div className="text-[11.5px] text-red-600 mt-1">{addErr}</div>}
                <div className="flex justify-end gap-2 mt-2.5">
                  <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(settings.mailerRecipients)}>Discard</Button>
                  <Button size="sm" variant="primary" icon="Save" disabled={!dirty || !draft.length} onClick={saveList}>Save list</Button>
                </div>
              </>
            )}
          </Card>
          <Card title="Commodity cuts" icon="Split" subtitle="Each Commodity Lead also receives a commodity cut">
            <div className="space-y-1.5">
              {leads.map((l) => {
                const c = cutOf(l.codes)
                return (
                  <div key={l.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-2.5 py-2">
                    <Avatar name={l.user?.name ?? '—'} color={l.user?.avatarColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink truncate">{l.user?.name}</div>
                      <div className="text-[11px] text-muted truncate">{l.codes.join(' · ')} · {l.user?.email}</div>
                    </div>
                    <div className="text-right text-[11px] leading-4">
                      <div className="num font-semibold text-emerald-700">{inrShort(c.realised)} <span className="text-muted font-normal">realised</span></div>
                      <div className="num text-muted">{inrShort(c.committed)} committed</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <Card className="xl:col-span-8" title="Sent history" icon="History" subtitle="Monthly Cost Optimisation Report emails">
          <DataTable<EmailLog> rows={sent} rowKey={(e) => e.id} exportName="COIN_Mailer_history"
            columns={[
              { key: 'at', label: 'Sent', value: (e) => e.at, render: (e) => <span className="num">{fmtDateTime(e.at)}</span> },
              { key: 'subject', label: 'Subject', render: (e) => <span className="font-medium text-ink">{e.subject}</span> },
              { key: 'to', label: 'Recipients', value: (e) => e.to.join(', '), render: (e) => <Tooltip content={e.to.join(', ')}><span className="text-ink-2">{e.to[0]}{e.to.length > 1 ? ` +${e.to.length - 1}` : ''}</span></Tooltip> },
              { key: 'kind', label: 'Type', value: (e) => (e.subject.includes('commodity cut') ? 'Commodity cut' : 'Management list'), render: (e) => (e.subject.includes('commodity cut') ? <Badge color="#bf8f3f">Commodity cut</Badge> : <Badge color="#2459e0">Management list</Badge>) },
              { key: 'att', label: 'Attachments', value: (e) => (e.attachments ?? []).join(', '), render: (e) => <span className="text-muted">{(e.attachments ?? []).join(' · ') || '—'}</span> },
            ]}
            empty={<div className="p-6 text-center text-[12.5px] text-muted">No monthly report has been sent yet — use Send now or run the monthly realisation.</div>} />
        </Card>
        <Card className="xl:col-span-4" title="Mailer specification" icon="ClipboardList" subtitle="Section 11 — Monthly management mailer">
          {MAILER.map(([k, v]) => <KV key={k} k={k} v={<span className="text-[12px] font-normal text-ink-2">{v}</span>} />)}
        </Card>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} icon="Send" title="Send the monthly report now?" subtitle={subject} size="sm"
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" icon="Send" onClick={send} disabled={!settings.mailerRecipients.length}>Send now</Button></>}>
        <div className="space-y-2 text-[12.5px]">
          <SectionNote icon="Users">Goes to <b>{settings.mailerRecipients.length}</b> recipients on the management list, plus a commodity cut to <b>{leads.length}</b> Commodity Leads ({leads.map((l) => nameOf(ctx, l.id)).join(', ')}).</SectionNote>
          <div className="grid grid-cols-2 gap-2">{headline.map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="text-[10.5px] text-muted uppercase font-bold">{k}</div><div className="font-bold num">{inrShort(v)}</div></div>)}</div>
          <div className={cn('text-[11.5px] text-muted')}>Attachments: {pdfName}.pdf, {xlsName}.xlsx</div>
        </div>
      </Modal>
    </div>
  )
}
