// The MRN behind the savings: the receipts of one idea-month (what was counted, what was not and why, Finance's check),
// the MRN feed with its read log, and the upload of an MRN extract in the ERP layout.
import { useMemo, useState, type ReactNode } from 'react'
import type { Idea, MrnLine, MrnReason } from '../../lib/types'
import { useMe, useStore } from '../../store/useStore'
import { ideaPlan, MRN_CSV_HEADER, parseMrnCsv } from '../../lib/mrn'
import { addDays, addMonthsYm, fmtDate, fmtDateTime, inrPrice, inrShort, monthLong, num, sum } from '../../lib/format'
import { Badge, Button, EmptyState, Icon, Modal, cn } from '../../components/ui'

const REASON_HINT: Record<MrnReason, string> = {
  'Other supplier': 'Received from a vendor other than the approved supplier',
  'Old price billed': 'Billed at or above the baseline — the new price was not applied',
  'Before the savings start': 'Received before the savings start signed in the lock',
  'No live idea for this part': 'No approved idea tracks this part',
}
const FIN_COLOR = { Validated: 'var(--color-emerald-600)', Pending: 'var(--color-orange-400)', Queried: 'var(--color-rose-600)' } as const
export const canPostMrn = (roles: string[]) => roles.some((r) => r === 'finance' || r === 'head' || r === 'admin')

/** Forecast vs MRN actual for one idea-month, split into volume / timing and price (billed above the approved price) */
export function monthVariance(idea: Idea, month: string, ledger = useStore.getState().ledger, last = useStore.getState().settings.lastRealisationMonth) {
  const row = ideaPlan(idea, ledger, last).rows.find((r) => r.month === month)
  const entries = ledger.filter((l) => l.ideaId === idea.id && l.month === month)
  const actual = sum(entries.map((e) => e.realised)), leakage = sum(entries.map((e) => e.leakage))
  const plan = row?.plan ?? 0
  return { plan, actual, variance: actual - plan, price: -leakage, volume: actual - plan + leakage, qty: sum(entries.map((e) => e.mrnQty)), plannedQty: sum(entries.map((e) => e.plannedQty)), entries }
}

export function MrnReceiptsModal({ idea, month, open, onClose }: { idea: Idea; month: string | null; open: boolean; onClose: () => void }) {
  const me = useMe()
  const mrn = useStore((s) => s.mrn)
  const ledger = useStore((s) => s.ledger)
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const toast = useStore((s) => s.toast)
  const [query, setQuery] = useState('')
  const parts = useMemo(() => new Set(idea.parts.map((p) => p.partCode)), [idea.parts])
  if (!month) return null
  const lines = mrn.filter((l) => l.month === month && parts.has(l.partCode)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const mine = lines.filter((l) => l.ideaId === idea.id)
  const others = lines.filter((l) => l.status === 'Claimed' && l.ideaId !== idea.id)
  const notCounted = lines.filter((l) => l.status === 'Not claimed')
  const v = monthVariance(idea, month, ledger, last)
  const posted = month <= last
  const fin = v.entries.map((e) => e.financeStatus)
  const finStatus = !v.entries.length ? null : fin.every((x) => x === 'Validated') ? 'Validated' : fin.some((x) => x === 'Queried') ? 'Queried' : 'Pending'
  const canFinance = !!me && canPostMrn(me.roles)
  const part = (code: string) => idea.parts.find((p) => p.partCode === code)
  const validate = () => { useStore.getState().financeValidate(v.entries.map((e) => e.id)); toast(`${monthLong(month)} MRN validated for ${idea.id}`, 'success') }
  const ask = () => { useStore.getState().financeQuery(v.entries.map((e) => e.id), query.trim()); setQuery(''); toast(`Query sent to the buyer for ${monthLong(month)}`, 'info') }
  const tile = (label: string, value: ReactNode, sub?: ReactNode, tone?: 'good' | 'bad') => (
    <div className="rounded-xl border border-line bg-white px-3 py-2 min-w-0"><div className="text-[11px] font-medium text-muted truncate">{label}</div><div className={cn('text-[16px] font-bold num truncate', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-ink')}>{value}</div>{sub && <div className="text-[11px] text-muted truncate">{sub}</div>}</div>
  )
  return (
    <Modal open={open} onClose={onClose} size="2xl" icon="ReceiptText" title={`MRN receipts — ${monthLong(month)}`} subtitle={`${idea.id} · ${idea.title}`}
      footer={<>
        {canFinance && v.entries.length > 0 && <>
          <input className="input !h-9 max-w-[320px] mr-auto" aria-label="Finance query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Query to the buyer (e.g. MRN qty differs from GRN register)" />
          <Button icon="MessageCircleQuestion" disabled={!query.trim()} onClick={ask}>Query</Button>
          <Button variant="success" icon="BadgeCheck" disabled={finStatus === 'Validated'} onClick={validate}>{finStatus === 'Validated' ? 'Validated' : 'Validate month'}</Button>
        </>}
        <Button onClick={onClose}>Close</Button>
      </>}>
      <div className="grid gap-3" data-testid="mrn-receipts">
        {!posted ? <EmptyState icon="CalendarClock" title={`${monthLong(month)} is not read yet`} desc={`The ERP feed reads a month on the 5th of the next month — ${fmtDate(addDays(`${addMonthsYm(month, 1)}-01`, 4))}.`} /> : <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {tile('Forecast for the month', inrShort(v.plan), 'signed with the lock')}
            {tile('MRN actual', inrShort(v.actual), `${num(v.qty)} received of ${num(v.plannedQty)} planned`, v.actual >= v.plan ? 'good' : 'bad')}
            {tile('Variance', `${v.variance >= 0 ? '+' : ''}${inrShort(v.variance)}`, <>volume / timing <b className="num">{v.volume >= 0 ? '+' : ''}{inrShort(v.volume)}</b> · price <b className="num">{inrShort(v.price)}</b></>, v.variance >= 0 ? 'good' : 'bad')}
            {tile('Receipts', `${mine.length} counted`, `${notCounted.length} not counted${others.length ? ` · ${others.length} for another idea` : ''}`)}
            {tile('Finance', finStatus ?? '—', v.entries.find((e) => e.financeRemarks)?.financeRemarks ?? (finStatus === 'Validated' ? `by ${v.entries[0]?.financeBy ?? 'Finance'}` : 'awaiting validation'))}
          </div>
          <div className="rounded-xl border border-line overflow-auto max-h-[52vh]">
            <table className="tbl">
              <thead><tr><th>MRN no.</th><th>Receipt date</th><th>Part</th><th>Vendor</th><th>PO</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price billed</th><th style={{ textAlign: 'right' }}>Approved</th><th style={{ textAlign: 'right' }}>Saving</th><th>Counted?</th></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const p = part(l.partCode)
                  const approved = p ? p.approvedPrice ?? p.newPrice : 0
                  const counted = l.ideaId === idea.id
                  const saving = counted && p ? (p.baselinePrice - l.price) * l.qty : 0
                  return (
                    <tr key={l.id} className={cn(!counted && 'text-muted')}>
                      <td className="font-mono text-[12px]">{l.id}</td>
                      <td className="num text-[12.5px]">{fmtDate(l.date)}</td>
                      <td className="font-mono text-[12px]">{l.partCode}</td>
                      <td className="text-[12.5px]">{l.supplierCode}</td>
                      <td className="font-mono text-[11.5px]">{l.poNo || '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{num(l.qty)}</td>
                      <td className={cn('num', counted && l.price > approved && 'text-red-600 font-semibold')} style={{ textAlign: 'right' }}>{inrPrice(l.price)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{inrPrice(approved)}</td>
                      <td className="num font-semibold" style={{ textAlign: 'right' }}>{counted ? inrShort(saving) : '—'}</td>
                      <td>{counted ? <Badge color="var(--color-emerald-600)" icon="Check">{l.price > approved ? 'Counted · billed above approved' : 'Counted'}</Badge>
                        : l.status === 'Claimed' ? <Badge color="var(--color-slate-500)">For {l.ideaId}</Badge>
                          : <span title={l.reason ? REASON_HINT[l.reason] : undefined}><Badge color="var(--color-rose-600)" icon="X">Not counted · {l.reason}</Badge></span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!lines.length && <EmptyState icon="PackageX" title="No MRN receipt for these parts this month" desc="Nothing is claimed — the month counts as zero against its forecast." className="py-8" />}
          </div>
          <div className="text-[11.5px] text-muted flex items-start gap-1.5"><Icon name="Info" size={13} className="shrink-0 mt-px" />Saving = (baseline − price billed) × quantity received. A receipt counts only from the approved supplier, on or after the savings start, below the baseline — and once: the PO it was received against decides between two ideas on the same part.</div>
        </>}
      </div>
    </Modal>
  )
}

/** MRN feed status, the read log and the upload of an MRN extract */
export function MrnFeedPanel({ className }: { className?: string }) {
  const me = useMe()
  const last = useStore((s) => s.settings.lastRealisationMonth)
  const reads = useStore((s) => s.mrnReads)
  const [log, setLog] = useState(false)
  const [upload, setUpload] = useState(false)
  const next = addDays(`${addMonthsYm(last, 2)}-01`, 4)
  const lastRead = reads[0]
  return (
    <div className={cn('rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white', className)} data-testid="mrn-feed">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="h-10 w-10 rounded-xl grid place-items-center bg-co-grad text-white shrink-0"><Icon name="DatabaseZap" size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink">MRN feed from the ERP · read up to {monthLong(last)}</div>
          <div className="text-[12px] text-muted">Each completed month's receipts are read on the 5th (next: {monthLong(addMonthsYm(last, 1))}, on {fmtDate(next)}). Saving = (baseline − price billed) × quantity, only for receipts that pass the claim rules{lastRead ? ` · last read: ${lastRead.lines} receipts, ${lastRead.claimed} counted` : ''}.</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" icon={log ? 'ChevronUp' : 'History'} onClick={() => setLog((x) => !x)}>Read log</Button>
          {me && canPostMrn(me.roles) && <Button size="sm" variant="primary" icon="Upload" onClick={() => setUpload(true)}>Upload MRN extract</Button>}
        </div>
      </div>
      {log && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-line bg-white overflow-auto max-h-[260px]">
            <table className="tbl">
              <thead><tr><th>Month</th><th>Source</th><th>Read</th><th style={{ textAlign: 'right' }}>Receipts</th><th style={{ textAlign: 'right' }}>Counted</th><th style={{ textAlign: 'right' }}>Saving</th><th>Not counted</th></tr></thead>
              <tbody>
                {reads.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{monthLong(r.month)}</td>
                    <td><Badge color={r.source === 'Upload' ? 'var(--color-brand-600)' : 'var(--color-teal-700)'}>{r.source}</Badge></td>
                    <td className="text-[12px] text-muted whitespace-nowrap">{fmtDateTime(r.at)} · {r.by}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{num(r.lines)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{num(r.claimed)}</td>
                    <td className="num font-semibold" style={{ textAlign: 'right' }}>{inrShort(r.saving)}</td>
                    <td><div className="flex flex-wrap gap-1">{Object.entries(r.notClaimed).map(([k, n]) => <span key={k} title={REASON_HINT[k as MrnReason]}><Badge color="var(--color-rose-600)">{k} · {n}</Badge></span>)}{!Object.keys(r.notClaimed).length && <span className="text-[12px] text-muted">—</span>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <UploadMrnModal open={upload} onClose={() => setUpload(false)} />
    </div>
  )
}

function UploadMrnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<{ posted: number; claimed: number; errors: string[]; notClaimed: Record<string, number> } | null>(null)
  const parsed = useMemo(() => (text.trim() ? parseMrnCsv(text) : null), [text])
  const months = parsed ? [...new Set(parsed.lines.map((l) => l.month))].sort() : []
  const reset = () => { setText(''); setName(''); setResult(null) }
  const close = () => { reset(); onClose() }
  const post = () => {
    if (!parsed?.lines.length) return
    const before = new Set(useStore.getState().mrn.map((l) => l.id))
    const r = useStore.getState().uploadMrnLines(parsed.lines)
    const mine = useStore.getState().mrn.filter((l) => parsed.lines.some((x) => x.id === l.id))
    const notClaimed: Record<string, number> = {}
    mine.filter((l) => l.status === 'Not claimed' && l.reason).forEach((l) => { notClaimed[l.reason!] = (notClaimed[l.reason!] ?? 0) + 1 })
    setResult({ ...r, notClaimed })
    toast(`${r.posted} receipts posted — ${r.claimed} counted${mine.some((l) => before.has(l.id)) ? ' (earlier copies replaced)' : ''}`, r.claimed ? 'success' : 'info')
  }
  const template = () => {
    const blob = new Blob([`${MRN_CSV_HEADER}\n5000123456,05-09-2026,RJP,3100045612,V10021,120000,3.85,4500012345\n`], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'COIN_MRN_extract_template.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <Modal open={open} onClose={close} size="xl" icon="Upload" title="Upload MRN extract" subtitle="When the ERP interface is not available — one receipt a row, in the ERP layout; the same claim rules apply"
      footer={<><Button variant="ghost" icon="Download" onClick={template} className="mr-auto">Download template</Button><Button onClick={close}>Close</Button>{!result && <Button variant="primary" icon="Upload" disabled={!parsed?.lines.length} onClick={post}>Post {parsed?.lines.length ?? 0} receipts</Button>}</>}>
      {result ? (
        <div className="grid gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900"><b>{result.posted}</b> receipts posted · <b>{result.claimed}</b> counted as saving</div>
          {Object.keys(result.notClaimed).length > 0 && <div className="flex flex-wrap gap-1.5">{Object.entries(result.notClaimed).map(([k, n]) => <Badge key={k} color="var(--color-rose-600)">Not counted · {k} · {n}</Badge>)}</div>}
          {result.errors.map((e) => <div key={e} className="text-[12.5px] text-red-700 flex items-center gap-1.5"><Icon name="TriangleAlert" size={13} />{e}</div>)}
          <Button icon="RotateCcw" onClick={reset} className="justify-self-start">Upload another file</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="rounded-xl border-2 border-dashed border-line bg-slate-50 px-4 py-5 text-center cursor-pointer hover:border-brand-300">
            <input type="file" accept=".csv,text/csv" className="hidden" aria-label="MRN extract file" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setName(f.name); f.text().then(setText) }} />
            <Icon name="FileSpreadsheet" size={22} className="mx-auto text-brand-600" />
            <div className="text-[13px] font-semibold text-ink mt-1">{name || 'Choose a CSV file'}</div>
            <div className="text-[11.5px] text-muted">Columns: <span className="font-mono">{MRN_CSV_HEADER}</span> · dates as YYYY-MM-DD or DD-MM-YYYY</div>
          </label>
          <textarea className="input font-mono text-[12px]" rows={5} aria-label="MRN extract text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`…or paste the rows here\n${MRN_CSV_HEADER}`} />
          {parsed && (
            <div className="grid gap-1.5 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2"><Badge color="var(--color-emerald-600)" icon="Check">{parsed.lines.length} receipts read</Badge>{months.length > 0 && <span className="text-muted">{months.map(monthLong).join(', ')}</span>}{parsed.errors.length > 0 && <Badge color="var(--color-rose-600)">{parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} with errors</Badge>}</div>
              {parsed.errors.slice(0, 6).map((e) => <div key={e} className="text-red-700">{e}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Count of receipts for one idea-month: counted / not counted */
export function receiptCounts(idea: Idea, month: string, mrn: MrnLine[]) {
  const parts = new Set(idea.parts.map((p) => p.partCode))
  const lines = mrn.filter((l) => l.month === month && parts.has(l.partCode))
  return { counted: lines.filter((l) => l.ideaId === idea.id).length, notCounted: lines.filter((l) => l.status === 'Not claimed').length }
}
export const finStatusOf = (statuses: string[]) => (!statuses.length ? null : statuses.every((x) => x === 'Validated') ? 'Validated' : statuses.some((x) => x === 'Queried') ? 'Queried' : 'Pending')
export { FIN_COLOR }
