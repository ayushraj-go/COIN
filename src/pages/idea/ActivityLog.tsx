// Full activity log / audit trail — user, time, action, field, old → new, remarks (NFR: Audit trail).
import { useMemo, useState } from 'react'
import type { ActivityEntry, Idea } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { Avatar, Button, Card, Icon, Segmented, Tooltip, cn } from '../../components/ui'
import { fmtDate, fmtDateTime, inrPrice, inrShort, num, timeAgo } from '../../lib/format'
import { exportExcel } from '../../lib/export'

type Kind = 'all' | 'stage' | 'values' | 'decisions'
const kindOf = (a: ActivityEntry): Kind[] => {
  const k: Kind[] = []
  if (a.field === 'stage') k.push('stage')
  if (/override|baseline|volume|phasing|target|progress|owner|price|edited/i.test(`${a.action} ${a.field ?? ''}`)) k.push('values')
  if (/approv|reject|validat|technical|feasib|drop|done|sent back|more info/i.test(a.action)) k.push('decisions')
  return k
}
function iconFor(a: ActivityEntry): [string, string] {
  const s = a.action.toLowerCase()
  if (s.includes('reject') || s.includes('dropped') || s.includes('no-go') || s.includes('declined')) return ['CircleX', '#e0364f']
  if (s.includes('approved') || s.includes('implemented') || s.includes('done')) return ['CircleCheck', '#0f9f6e']
  if (s.includes('override')) return ['PencilLine', '#ec8a1c']
  if (s.includes('undone')) return ['Undo2', '#64748b']
  if (s.includes('sent back') || s.includes('info')) return ['Undo2', '#ec8a1c']
  if (s.includes('attachment')) return ['Paperclip', '#7c3aed']
  if (s.includes('reassign') || s.includes('owner')) return ['UserRoundCog', '#0284c7']
  if (s.includes('synced')) return ['RefreshCw', '#0d9488']
  if (a.field === 'stage') return ['ArrowRight', '#4470d6']
  return ['Dot', '#64748b']
}
/** Display labels: the execution "target date" is shown as the due date (stored action/field text is unchanged). */
const actionLabel = (s: string) => s.replace(/\bTarget date\b/g, 'Due date').replace(/\btarget date\b/g, 'due date')
const fieldLabel = (f: string) => (f === 'targetDate' ? 'Due date' : f === 'originalTargetDate' ? 'Original due date' : f)
function fmtVal(field: string | undefined, v: string | undefined) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (field?.startsWith('baselinePrice') && Number.isFinite(n)) return inrPrice(n)
  if (field?.startsWith('annualVolume') && Number.isFinite(n)) return num(n)
  if (field === 'targetDate' || /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v.slice(0, 10))
  if (field === 'phasing' && v.startsWith('{')) {
    try { const p = JSON.parse(v); return (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => `${q} ${inrShort(p[q] || 0, 1)}`).join(' · ') } catch { return v }
  }
  return v
}

export function ActivityLog({ idea, limit, compact, onShowAll }: { idea: Idea; limit?: number; compact?: boolean; onShowAll?: () => void }) {
  const users = useStore((s) => s.users)
  const [kind, setKind] = useState<Kind>('all')
  const [q, setQ] = useState('')
  const all = useMemo(() => [...idea.activity].sort((a, b) => b.at.localeCompare(a.at)), [idea.activity])
  const color = (id: string) => users.find((u) => u.id === id)?.avatarColor

  if (compact) {
    const items = all.slice(0, limit ?? 6)
    return (
      <Card title="Latest activity" icon="History" subtitle={`${all.length} entries in the audit trail`} actions={onShowAll ? <Button size="xs" variant="ghost" iconRight="ArrowRight" onClick={onShowAll}>Full log</Button> : undefined}>
        <ol className="relative">
          {items.map((a, k) => {
            const [ic, c] = iconFor(a)
            return (
              <li key={a.id} className="flex gap-2.5 pb-2.5 relative">
                {k < items.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />}
                <span className="h-6 w-6 rounded-full grid place-items-center shrink-0 relative" style={{ background: `${c}14`, color: c }}><Icon name={ic} size={12} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-ink leading-snug"><span className="font-semibold">{a.userName}</span> · {actionLabel(a.action)}</div>
                  {a.field && (a.oldValue || a.newValue) && <div className="text-[11px] text-muted truncate">{fieldLabel(a.field)}: {fmtVal(a.field, a.oldValue)} → {fmtVal(a.field, a.newValue)}</div>}
                  {a.remarks && <div className="text-[11px] text-muted italic truncate">“{a.remarks}”</div>}
                  <div className="text-[10.5px] text-slate-400">{fmtDateTime(a.at)}</div>
                </div>
              </li>
            )
          })}
          {!items.length && <li className="text-[12px] text-muted">No activity recorded yet.</li>}
        </ol>
      </Card>
    )
  }

  const k = q.trim().toLowerCase()
  const rows = all.filter((a) => (kind === 'all' || kindOf(a).includes(kind)) && (!k || `${a.userName} ${actionLabel(a.action)} ${a.field ? fieldLabel(a.field) : ''} ${a.oldValue ?? ''} ${a.newValue ?? ''} ${a.remarks ?? ''}`.toLowerCase().includes(k)))
  const doExport = () => exportExcel(`COIN_${idea.id}_audit_trail`, [{
    name: 'Audit trail',
    rows: all.map((a) => ({ When: fmtDateTime(a.at), User: a.userName, Action: actionLabel(a.action), Field: a.field ? fieldLabel(a.field) : '', 'Old value': a.oldValue ?? '', 'New value': a.newValue ?? '', Remarks: a.remarks ?? '' })),
  }])
  return (
    <Card title="Activity log · audit trail" icon="ScrollText" subtitle="Every create, stage change, value edit, override, date change and approval — with user, time, old and new value" pad={false}
      actions={<Button size="sm" icon="FileSpreadsheet" onClick={doExport}>Excel</Button>}>
      <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={kind} onChange={(v) => setKind(v as Kind)} options={[
          { key: 'all', label: `All ${all.length}` }, { key: 'stage', label: 'Stage changes' }, { key: 'values', label: 'Values & overrides' }, { key: 'decisions', label: 'Decisions' },
        ]} />
        <label className="relative flex-1 min-w-[160px] max-w-xs">
          <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !h-8 !pl-8 text-[12.5px]" placeholder="Search the log…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="tbl">
          <thead><tr><th style={{ width: 150 }}>When</th><th>User</th><th>Action</th><th>Field</th><th>Old → new</th><th>Remarks</th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const [ic, c] = iconFor(a)
              return (
                <tr key={a.id}>
                  <td className="text-[12px] num"><Tooltip content={timeAgo(a.at)}><span>{fmtDateTime(a.at)}</span></Tooltip></td>
                  <td><span className="inline-flex items-center gap-1.5"><Avatar name={a.userName} color={color(a.userId)} size={20} /><span className="text-[12.5px]">{a.userName}</span></span></td>
                  <td><span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"><Icon name={ic} size={13} style={{ color: c }} />{actionLabel(a.action)}</span></td>
                  <td className="text-[12px] text-muted">{a.field ? fieldLabel(a.field) : '—'}</td>
                  <td className="text-[12px]">
                    {a.oldValue || a.newValue ? (
                      <span className="inline-flex items-center gap-1.5 max-w-[340px]">
                        <span className="text-muted line-through decoration-slate-300 truncate">{fmtVal(a.field, a.oldValue)}</span>
                        <Icon name="ArrowRight" size={11} className="text-muted shrink-0" />
                        <span className="font-semibold text-ink truncate">{fmtVal(a.field, a.newValue)}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-[12px] text-muted"><div className={cn('max-w-[320px] truncate', a.remarks && 'italic')} title={a.remarks}>{a.remarks || '—'}</div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && <div className="p-6 text-center text-[12.5px] text-muted">No entries match.</div>}
      </div>
    </Card>
  )
}
