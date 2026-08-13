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
  it('exposes INVOICE_MAX_LINES = 25', () => {
    expect(INVOICE_MAX_LINES).toBe(25)
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
  it('returns NORMAL for <= INVOICE_MAX_LINES', () => {
    expect(recommendedStrategy(0)).toBe('normal')
    expect(recommendedStrategy(INVOICE_MAX_LINES)).toBe('normal')
  })

  it('returns MERGE for > INVOICE_MAX_LINES', () => {
    expect(recommendedStrategy(INVOICE_MAX_LINES + 1)).toBe('merge')
    expect(recommendedStrategy(60)).toBe('merge')
  })
})

describe('applyMergeStrategy', () => {
  it('returns input unchanged when <= INVOICE_MAX_LINES', () => {
    const lines = makeLines(10)
    const result = applyMergeStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toEqual(lines)
  })

  it('merges overflow into a single "その他" line at last position', () => {
    const lines = makeLines(INVOICE_MAX_LINES + 7)
    const result = applyMergeStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toHaveLength(INVOICE_MAX_LINES)

    const keepCount = INVOICE_MAX_LINES - 1
    expect(result[0].lines.slice(0, keepCount)).toEqual(lines.slice(0, keepCount))

    const merged = result[0].lines[keepCount]
    expect(merged.departure).toBe('その他')
    expect(merged.destination).toBe('')
    expect(merged.amount).toBe(lines.slice(keepCount).reduce((s, l) => s + l.amount, 0))
    expect(merged.work_date).toBe(lines[keepCount].work_date)
  })

  it('preserves total amount after merge', () => {
    const lines = makeLines(INVOICE_MAX_LINES + 12)
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
  it('returns single invoice when <= INVOICE_MAX_LINES', () => {
    const lines = makeLines(15)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(1)
    expect(result[0].lines).toEqual(lines)
  })

  it('splits MAX+1 lines into 2 invoices (MAX + 1)', () => {
    const lines = makeLines(INVOICE_MAX_LINES + 1)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(2)
    expect(result[0].lines).toHaveLength(INVOICE_MAX_LINES)
    expect(result[1].lines).toHaveLength(1)
  })

  it('splits MAX*2 lines into 2 invoices (MAX + MAX)', () => {
    const lines = makeLines(INVOICE_MAX_LINES * 2)
    const result = applySplitStrategy(lines)
    expect(result).toHaveLength(2)
    expect(result[0].lines).toHaveLength(INVOICE_MAX_LINES)
    expect(result[1].lines).toHaveLength(INVOICE_MAX_LINES)
  })

  it('splits into 3 invoices when above MAX*2', () => {
    const lines = makeLines(INVOICE_MAX_LINES * 2 + 10)
    const result = applySplitStrategy(lines)
    expect(result.map((r) => r.lines.length)).toEqual([INVOICE_MAX_LINES, INVOICE_MAX_LINES, 10])
  })

  it('preserves total amount across split invoices', () => {
    const lines = makeLines(INVOICE_MAX_LINES * 2 + 5)
    const result = applySplitStrategy(lines)
    const total = result.flatMap((r) => r.lines).reduce((s, l) => s + l.amount, 0)
    const originalTotal = lines.reduce((s, l) => s + l.amount, 0)
    expect(total).toBe(originalTotal)
  })

  it('annotates each split invoice with sequence info', () => {
    const lines = makeLines(INVOICE_MAX_LINES * 2)
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
