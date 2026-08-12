import { describe, expect, it } from 'vitest'
import { calculateLineBuffer, totalDurationWithBuffer } from './buffer.js'

describe('calculateLineBuffer', () => {
  it('uses pickupWait 5 + max(5, ceil(15%))', () => {
    // 20 → ceil(3)=3 → max(5,3)=5 → 5+5=10
    expect(calculateLineBuffer(20)).toBe(10)
    // 40 → ceil(6)=6 → 6+5=11
    expect(calculateLineBuffer(40)).toBe(11)
  })

  it('falls back to base 20 when null/invalid', () => {
    expect(calculateLineBuffer(null)).toBe(10)
    expect(calculateLineBuffer(0)).toBe(10)
    expect(calculateLineBuffer(undefined)).toBe(10)
  })
})

describe('totalDurationWithBuffer', () => {
  it('sums base and buffer', () => {
    expect(totalDurationWithBuffer(20)).toBe(30)
  })
})
