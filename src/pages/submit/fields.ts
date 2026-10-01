// Submit Idea — the fields shown on the form, numbered sequentially (Section 7 list minus Category,
// Savings type, One-time investment and Payback; the lever is now labelled "Category").
export type SectionKey = 'A' | 'B' | 'C' | 'D' | 'E'

export interface FormField { n: number; section: SectionKey; card: string; field: string; req: string; source: string }

const A = 'A. Classification', B = 'B. Idea details', C = 'C. Parts', D = 'D. Expected impact', E = 'E. Supplier only'

export const FIELDS: FormField[] = [
  { n: 1, section: 'A', card: A, field: 'Submitter name, employee ID', req: 'Yes', source: 'From login' },
  { n: 2, section: 'A', card: A, field: 'Department', req: 'Yes', source: 'From login' },
  { n: 3, section: 'A', card: A, field: 'Plant / BU', req: 'Yes', source: "Defaults to user's plant" },
  { n: 4, section: 'A', card: A, field: 'Buying type', req: 'Yes', source: 'Direct / Indirect' },
  { n: 5, section: 'A', card: A, field: 'Commodity', req: 'Yes', source: 'Commodity master; sets the commodity category' },
  { n: 6, section: 'A', card: A, field: 'Category', req: 'Yes', source: 'Idea category master; shows the route the idea will take' },
  { n: 7, section: 'A', card: A, field: 'Idea scope', req: 'Yes', source: 'Open idea / Part-specific / Supplier' },
  { n: 8, section: 'A', card: A, field: 'Campaign / workshop', req: 'No', source: 'Auto-set when opened from a campaign link' },
  { n: 9, section: 'B', card: B, field: 'Idea name', req: 'Yes', source: 'Duplicate check runs on idea name + commodity' },
  { n: 10, section: 'B', card: B, field: 'Current state', req: 'Yes', source: 'How it is done / bought today' },
  { n: 11, section: 'B', card: B, field: 'Proposed change', req: 'Yes', source: 'What changes' },
  { n: 12, section: 'B', card: B, field: 'Evidence', req: 'No', source: 'Trial, quote, benchmark, drawing' },
  { n: 13, section: 'B', card: B, field: 'Attachments', req: 'No', source: 'Images, PDF, drawings, quotes; up to 10 files' },
  { n: 14, section: 'C', card: C, field: 'Part code(s)', req: 'If part-specific', source: 'ERP part master; searchable by code, description, commodity' },
  { n: 15, section: 'C', card: C, field: 'Part description, UoM', req: '—', source: 'From part master' },
  { n: 16, section: 'C', card: C, field: 'Current supplier(s)', req: '—', source: 'From last PO / MRN, vendor code + name' },
  { n: 17, section: 'C', card: C, field: 'Proposed supplier', req: 'If supplier lever', source: 'Vendor master, or "new supplier" with name' },
  { n: 18, section: 'D', card: D, field: 'Baseline price / unit (₹)', req: 'Yes', source: 'LBP rule (Section 4); override needs reason' },
  { n: 19, section: 'D', card: D, field: 'Expected new price / unit (₹)', req: 'Yes', source: 'Per part code' },
  { n: 20, section: 'D', card: D, field: 'Annual volume', req: 'Yes', source: 'Last FY MRN; override needs reason' },
  { n: 21, section: 'D', card: D, field: 'Saving / unit and %', req: '—', source: 'Live' },
  { n: 22, section: 'D', card: D, field: 'Annualised impact (₹)', req: '—', source: 'Live, per part + total' },
  { n: 23, section: 'D', card: D, field: 'Expected implementation quarter', req: 'Yes', source: 'Q1–Q4 of current or next FY' },
  { n: 24, section: 'D', card: D, field: 'Estimate (₹ lakh)', req: 'If no part codes', source: 'Rough annual impact in ₹ lakh, marked "Estimate"' },
  { n: 25, section: 'E', card: E, field: 'Gain-share % offered to Amber', req: 'No', source: 'Shown only for supplier submissions' },
  { n: 26, section: 'E', card: E, field: 'Validity of offer', req: 'No', source: 'Shown only for supplier submissions' },
]

/** Which accordion section a validation-error key belongs to */
export function sectionOfError(key: string): SectionKey {
  if (['plant', 'commodity', 'lever', 'scopeSupplier'].includes(key)) return 'A'
  if (['title', 'currentState', 'proposedChange'].includes(key)) return 'B'
  if (['parts', 'proposedSupplier'].includes(key)) return 'C'
  if (['gainShare', 'offerValidity'].includes(key)) return 'E'
  return 'D' // per-part price / volume / override reasons, estimate, quarter
}
