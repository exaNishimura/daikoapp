import { describe, expect, it } from 'vitest'
import { DEFAULT_DISCOUNT_CONFIG, normalizeDiscountConfig, snapshotDiscount } from './discount.js'

describe('normalizeDiscountConfig', () => {
  it('defaults to FIXED_YEN 500', () => {
    expect(normalizeDiscountConfig(null)).toEqual(DEFAULT_DISCOUNT_CONFIG)
  })

  it('preserves unknown types for future extension', () => {
    const cfg = normalizeDiscountConfig({ type: 'PERCENT', amount: 10 })
    expect(cfg.type).toBe('PERCENT')
    expect(cfg.amount).toBe(10)
  })
})

describe('snapshotDiscount', () => {
  it('applies FIXED_YEN', () => {
    const snap = snapshotDiscount({ type: 'FIXED_YEN', amount: 500 })
    expect(snap.applied).toBe(true)
    expect(snap.amount).toBe(500)
    expect(snap.label).toBe('500円引き')
  })

  it('does not apply PERCENT in MVP', () => {
    const snap = snapshotDiscount({ type: 'PERCENT', amount: 10 })
    expect(snap.applied).toBe(false)
    expect(snap.amount).toBe(0)
  })
})
