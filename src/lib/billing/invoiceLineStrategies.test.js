import { describe, expect, it } from 'vitest'
import {
  INVOICE_MAX_LINES,
  applyMergeStrategy,
  applySplitStrategy,
  recommendedStrategy,
  STRATEGIES,
} from './invoiceLineStrategies'

function makeLines(count) {
  return Array.from({ length: count }, (_, i) => ({
    work_date: `2026-05-${String(i + 1).padStart(2, '0')}`,
    departure: `出${i + 1}`,
    destination: `着${i + 1}`,
    amount: 1000 + i,
    note: null,
  }))
}

describe('constants', () => {
  it('exposes INVOICE_MAX_LINES = 18', () => {
    expect(INVOICE_MAX_LINES).toBe(18)
  })

  it('exposes STRATEGIES enum', () => {
    expect(STRATEGIES).toEqual({
      NORMAL: 'normal',
      MERGE: 'merge',
      SPLIT: 'split',
      SKIP: 'skip',
    })
  })
})

describe('recommendedStrategy', () => {
  it('returns NORMAL for <= 18 lines', () => {
    expect(recommendedStrategy(0)).toBe('normal')
    expect(recommendedStrategy(18)).toBe('normal')
  })

  it('returns MERGE for > 18 lines (recommended)', () => {
    expect(recommendedStrategy(19)).toBe('merge')
    expect(recommendedStrategy(50)).toBe('merge')
  })
})

describe('applyMergeStrategy', () => {
  it('returns input unchanged when <= 18 lines', () => {
    const lines = makeLines(10)
    const result = applyMergeStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toEqual(lines)
  })

  it('merges overflow into a single "その他" line at position 18', () => {
    const lines = makeLines(25)
    const result = applyMergeStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toHaveLength(18)

    const first17 = result[0].lines.slice(0, 17)
    expect(first17).toEqual(lines.slice(0, 17))

    const merged = result[0].lines[17]
    expect(merged.departure).toBe('その他')
    expect(merged.destination).toBe('')
    expect(merged.amount).toBe(lines.slice(17).reduce((s, l) => s + l.amount, 0))
    expect(merged.work_date).toBe(lines[17].work_date)
  })

  it('preserves total amount after merge', () => {
    const lines = makeLines(30)
    const result = applyMergeStrategy(lines)
    const merged = result[0].lines
    const total = merged.reduce((s, l) => s + l.amount, 0)
    const originalTotal = lines.reduce((s, l) => s + l.amount, 0)
    expect(total).toBe(originalTotal)
  })

  it('throws on empty input', () => {
    expect(() => applyMergeStrategy([])).toThrow(/empty/i)
  })
})

describe('applySplitStrategy', () => {
  it('returns single invoice when <= 18 lines', () => {
    const lines = makeLines(15)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toEqual(lines)
  })

  it('splits 19 lines into 2 invoices (18 + 1)', () => {
    const lines = makeLines(19)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(2)
    expect(result[0].lines).toHaveLength(18)
    expect(result[1].lines).toHaveLength(1)
  })

  it('splits 36 lines into 2 invoices (18 + 18)', () => {
    const lines = makeLines(36)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(2)
    expect(result[0].lines).toHaveLength(18)
    expect(result[1].lines).toHaveLength(18)
  })

  it('splits 50 lines into 3 invoices (18 + 18 + 14)', () => {
    const lines = makeLines(50)
    const result = applySplitStrategy(lines)
    expect(result.map((r) => r.lines.length)).toEqual([18, 18, 14])
  })

  it('preserves total amount across split invoices', () => {
    const lines = makeLines(45)
    const result = applySplitStrategy(lines)
    const total = result
      .flatMap((r) => r.lines)
      .reduce((s, l) => s + l.amount, 0)
    const originalTotal = lines.reduce((s, l) => s + l.amount, 0)
    expect(total).toBe(originalTotal)
  })

  it('annotates each split invoice with sequence info', () => {
    const lines = makeLines(36)
    const result = applySplitStrategy(lines)
    expect(result[0].sequence).toEqual({ index: 1, total: 2 })
    expect(result[1].sequence).toEqual({ index: 2, total: 2 })
  })

  it('does not annotate sequence when only 1 invoice', () => {
    const lines = makeLines(10)
    const result = applySplitStrategy(lines)
    expect(result[0].sequence).toBeUndefined()
  })

  it('throws on empty input', () => {
    expect(() => applySplitStrategy([])).toThrow(/empty/i)
  })
})
