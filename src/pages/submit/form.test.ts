import { describe, expect, it } from 'vitest'
import type { Part } from '../../lib/types'
import { nextFreePart, searchParts } from './form'

const part = (code: string, description: string, commodity: string) => ({ code, description, commodity }) as Part
const parts = [part('AC03045612', 'Hex flange bolt M6', 'BN'), part('AC03121101', 'Brass flare nut', 'AX'), part('SP13000901', 'Compressor oil', 'CM')]
const commodities = [{ code: 'BN', name: 'Bolt' }, { code: 'AX', name: 'Brass Parts' }, { code: 'CM', name: 'Oil & Lubricants' }]
const codes = (commodity: string, q: string) => searchParts(parts, commodity, q, commodities).map((p) => p.code)

describe('ERP part search', () => {
  it('lists every part of the commodity before anything is typed', () => {
    expect(codes('AX', '')).toEqual(['AC03121101'])
  })
  it('finds a letter code however it is typed', () => {
    expect(codes('', 'sp13')).toEqual(['SP13000901'])
    expect(codes('', 'SP13')).toEqual(['SP13000901'])
    expect(codes('', 'ac03121')).toEqual(['AC03121101'])
  })
  it('finds a part by description or commodity name', () => {
    expect(codes('', 'flare')).toEqual(['AC03121101'])
    expect(codes('', 'lubricants')).toEqual(['SP13000901'])
  })
  it('stays inside the chosen commodity', () => {
    expect(codes('BN', 'ac03')).toEqual(['AC03045612'])
  })
})

describe('moving through the part list', () => {
  const rows = ['A', 'B', 'C', 'D'].map((code) => ({ code }))
  it('starts on the first part not on the idea yet', () => {
    expect(nextFreePart(rows, [], -1, 1)).toBe(0)
    expect(nextFreePart(rows, ['A', 'B'], -1, 1)).toBe(2)
  })
  it('steps over parts already on the idea, both ways', () => {
    expect(nextFreePart(rows, ['B', 'C'], 0, 1)).toBe(3)
    expect(nextFreePart(rows, ['B', 'C'], 3, -1)).toBe(0)
  })
  it('stays put at either end of the list', () => {
    expect(nextFreePart(rows, [], 3, 1)).toBe(3)
    expect(nextFreePart(rows, ['A'], 1, -1)).toBe(1)
  })
  it('has nowhere to go when every part is taken', () => {
    expect(nextFreePart(rows, ['A', 'B', 'C', 'D'], -1, 1)).toBe(-1)
  })
})
