// Campaign workspace — pure helpers: campaign naming, reply linking and the sent → replied funnel per outreach batch.
import type { Commodity, Idea, OutreachBatch, OutreachKind, SupplierEmailTemplate, SupplierResponse } from '../../lib/types'
import { commodityShort } from '../../store/useStore'
import { OUTREACH_KINDS, ROUTE_STAGES, STAGE } from '../../lib/masters'
import { addDays } from '../../lib/format'

/** Theme colours for charts (match Tailwind brand / accent tokens) */
export const C_SENT = '#2459e0' // brand-600
export const C_DELIVERED = '#5e93fb' // brand-400
export const C_OPENED = '#93b8ff' // brand-300
export const C_REPLY = '#14ab92' // accent-500
export const C_CONVERTED = '#0d6e61' // accent-700

export const commodityLabel = (commodities: Commodity[], code: string) => commodityShort(commodities.find((c) => c.code === code)?.name ?? code)

/** Campaign type — explicit on wizard batches, inferred from the template on older ones */
export function kindOf(b: OutreachBatch): OutreachKind {
  if (b.kind) return b.kind
  const k = OUTREACH_KINDS.find((x) => x.templateId === b.templateId)
  return k?.key ?? 'Supplier idea drive'
}
export const kindMeta = (k: OutreachKind) => OUTREACH_KINDS.find((x) => x.key === k) ?? OUTREACH_KINDS[0]

/** Display name — the wizard name, else "<type> · <commodities>" */
export function batchName(b: OutreachBatch, commodities: Commodity[]) {
  if (b.name) return b.name
  const names = b.commodities.map((c) => commodityLabel(commodities, c))
  return `${kindOf(b) === 'Improvement workshop' ? 'Workshop' : kindOf(b) === 'Reminder' ? 'Reminder' : 'Idea drive'} · ${names.join(', ')}`
}

/**
 * Link every Supplier Portal response to the outreach batch that prompted it.
 * Uses the explicit `batchId` when present; otherwise the latest batch sent to that supplier for that commodity
 * before the response arrived (falls back to any earlier batch sent to the supplier).
 */
export function linkResponses(responses: SupplierResponse[], batches: OutreachBatch[]) {
  const ids = new Set(batches.map((b) => b.id))
  const desc = [...batches].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  const map = new Map<string, SupplierResponse[]>()
  const byResponse = new Map<string, string>()
  for (const r of responses) {
    let id = r.batchId && ids.has(r.batchId) ? r.batchId : undefined
    if (!id) {
      const before = desc.filter((b) => b.sentAt <= r.receivedAt && b.recipients.includes(r.supplierCode))
      id = (before.find((b) => b.commodities.includes(r.commodity)) ?? before[0])?.id
    }
    if (!id) continue
    byResponse.set(r.id, id)
    map.set(id, [...(map.get(id) ?? []), r])
  }
  return { byBatch: map, byResponse }
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }

export type RecipientState = 'Replied' | 'Opened' | 'Delivered'

/**
 * Sent → delivered → opened → replied → converted for one batch.
 * Delivery and opens are read receipts from the mail gateway (modelled deterministically per supplier);
 * a supplier who replied has always opened the email.
 */
export function batchFunnel(b: OutreachBatch, replies: SupplierResponse[]) {
  const ageH = (Date.now() - new Date(b.sentAt).getTime()) / 36e5
  const openPct = ageH < 1 ? 0 : ageH < 24 ? 38 : 64
  const repliedBy = new Set(replies.map((r) => r.supplierCode))
  const perSupplier: Record<string, RecipientState> = {}
  for (const code of b.recipients) {
    perSupplier[code] = repliedBy.has(code) ? 'Replied' : hash(b.id + code) % 100 < openPct ? 'Opened' : 'Delivered'
  }
  const states = Object.values(perSupplier)
  const sent = b.recipientCount || b.recipients.length
  const replied = states.filter((s) => s === 'Replied').length
  const opened = replied + states.filter((s) => s === 'Opened').length
  const converted = replies.filter((r) => r.status === 'Converted to idea').length
  return { sent, delivered: sent, opened, replied, replies: replies.length, converted, rate: sent ? (replied / sent) * 100 : 0, perSupplier }
}

/** Reply window of a campaign: reply-by date, else workshop date, else 21 days after sending */
export const batchDeadline = (b: OutreachBatch) => b.replyBy ?? b.workshopDate ?? addDays(b.sentAt.slice(0, 10), 21)
export const isBatchLive = (b: OutreachBatch, today: string) => batchDeadline(b) >= today

/** Campaign type implied by a template (wizard): workshop if it carries {{workshopDate}}, reminder by name, else idea drive */
export function kindForTemplate(t: Pick<SupplierEmailTemplate, 'id' | 'name' | 'subject' | 'body'> | undefined): OutreachKind {
  if (!t) return 'Supplier idea drive'
  const k = OUTREACH_KINDS.find((x) => x.templateId === t.id)
  if (k) return k.key
  if ((t.subject + t.body).includes('{{workshopDate}}')) return 'Improvement workshop'
  if (/remind/i.test(t.name)) return 'Reminder'
  return 'Supplier idea drive'
}

/** Where a supplier idea sits in Approval → NPD (till sample) */
export function npdProgress(i: Idea) {
  if (i.stage === 'Draft' || i.bucket === 'Dropped') return { approved: false, inNpd: false, pastSample: false }
  const stages = ROUTE_STAGES[i.route] ?? []
  const si = i.stage === 'Implemented' ? stages.length - 1 : stages.indexOf(i.stage)
  const ai = stages.indexOf(STAGE.approval)
  const approved = !!i.approvedAt || (ai >= 0 && si > ai)
  // NPD sample is a milestone inside Execution started
  const npdMs = i.execution?.milestones.find((m) => m.name.includes('NPD sample'))
  const inNpd = approved && i.stage === STAGE.execution && !!npdMs && !npdMs.doneDate
  const pastSample = approved && !!npdMs && (!!npdMs.doneDate || i.stage === 'Implemented')
  return { approved, inNpd, pastSample }
}
