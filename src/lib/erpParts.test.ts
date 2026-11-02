// The demo ERP: whichever commodity or supplier is chosen on Capture My Idea, there are part codes to pick.
import { describe, expect, it } from 'vitest'
import { CATEGORIES_DEFAULT, COMMODITIES_DEFAULT, PARTS_DEFAULT, SUPPLIERS_DEFAULT } from './masters'

const commodities = COMMODITIES_DEFAULT.map((c) => [c.code, c.name])
const partsOf = (commodity: string) => PARTS_DEFAULT.filter((p) => p.commodity === commodity)
const GROUP: Record<string, string> = { MET: '03', ELE: '05', PLA: '07', PKG: '09', CHE: '11', MRO: '13', SRV: '15', LOG: '17', CAP: '19' }

describe('ERP part master', () => {
  it.each(commodities)('%s · %s has part codes to pick', (code) => {
    expect(partsOf(code).length).toBeGreaterThanOrEqual(3)
  })

  it.each(commodities)('%s · %s has a supplier', (code) => {
    expect(SUPPLIERS_DEFAULT.some((s) => s.commodities.includes(code))).toBe(true)
  })

  it('offers parts for every supplier of every commodity', () => {
    const empty = SUPPLIERS_DEFAULT.flatMap((s) => s.commodities.filter((c) => !PARTS_DEFAULT.some((p) => p.commodity === c && p.supplierCode === s.code)).map((c) => `${s.code} ${c}`))
    expect(empty).toEqual([])
  })

  it('codes read AC (direct material) or SP (indirect), then the category number', () => {
    for (const p of PARTS_DEFAULT) {
      const cat = CATEGORIES_DEFAULT.find((c) => c.id === COMMODITIES_DEFAULT.find((x) => x.code === p.commodity)?.categoryId)!
      expect(p.code).toMatch(new RegExp(`^${cat.buyingType === 'Direct' ? 'AC' : 'SP'}${GROUP[cat.id]}\\d{6}$`))
    }
  })

  it('never repeats a part code', () => {
    expect(new Set(PARTS_DEFAULT.map((p) => p.code)).size).toBe(PARTS_DEFAULT.length)
  })

  it('names, prices and sources every part, so the form can fill itself in', () => {
    for (const p of PARTS_DEFAULT) {
      expect(p.description.trim().length).toBeGreaterThan(3)
      expect(p.poPrice).toBeGreaterThan(0)
      if (p.lbp != null) { expect(p.lbp).toBeGreaterThan(0); expect(p.poPrice).toBeGreaterThanOrEqual(p.lbp) }
      expect(p.lastFyMrnQty).toBeGreaterThan(0)
      expect(SUPPLIERS_DEFAULT.find((s) => s.code === p.supplierCode)?.commodities).toContain(p.commodity)
    }
  })

  it('uses only units the Admin part master offers', () => {
    for (const p of PARTS_DEFAULT) expect(['Nos', 'Kg', 'Set', 'Mtr', 'Ltr', 'Trip', 'Month', 'kWh']).toContain(p.uom)
  })

  it('numbers vendors without a gap, so Admin\'s next vendor code is free', () => {
    expect(SUPPLIERS_DEFAULT.map((s) => s.code)).toEqual(SUPPLIERS_DEFAULT.map((_, i) => `V${10001 + i}`))
  })
})
