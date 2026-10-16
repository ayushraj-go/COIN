// The Supplier Portal link in outreach emails opens a page of this app; what the supplier sends lands in Supplier responses.
import { describe, it, expect, beforeEach } from 'vitest'
import { supplierPortalLink, useStore } from './useStore'

const st = () => useStore.getState()
beforeEach(() => { st().resetDemo() })

describe('Supplier Portal', () => {
  it('the emailed link points at the app, never at a dead external domain', () => {
    const link = supplierPortalLink('V10021', ['FAS', 'CUT'], 'OB-001')
    expect(link).toMatch(/\/supplier-portal\?s=V10021&c=FAS,CUT&b=OB-001$/)
    expect(link).not.toContain('coin.amber')
  })
  it('a supplier submission becomes a New supplier response linked to its campaign, and the sender is told', () => {
    const batch = st().outreachBatches[0]
    const before = st().supplierResponses.length
    const id = st().submitPortalResponse({ supplierCode: batch.recipients[0], commodity: batch.commodities[0], type: 'Idea', scope: 'Open idea', subject: 'Returnable crates', body: 'Crates instead of boxes on the Rajpura lane', estSavingLakh: 12, contactName: 'Jaspreet Gill', batchId: batch.id })
    expect(id).toMatch(/^SR-\d+$/)
    const r = st().supplierResponses.find((x) => x.id === id)!
    expect(st().supplierResponses.length).toBe(before + 1)
    expect(r).toMatchObject({ status: 'New', source: 'Supplier Portal', batchId: batch.id, estSavingLakh: 12, type: 'Idea' })
    expect(r.body).toContain('Jaspreet Gill')
    expect(st().notifications.some((n) => n.userId === batch.sentBy && n.body.includes(id!))).toBe(true)
  })
  it('refuses an unknown vendor or an empty submission', () => {
    expect(st().submitPortalResponse({ supplierCode: 'V99999', commodity: 'FAS', type: 'Idea', scope: 'Open idea', subject: 'x', body: 'y', contactName: 'z' })).toBeNull()
    expect(st().submitPortalResponse({ supplierCode: 'V10021', commodity: 'FAS', type: 'Idea', scope: 'Open idea', subject: ' ', body: 'y', contactName: 'z' })).toBeNull()
  })
})
