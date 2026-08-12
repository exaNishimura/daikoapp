import { describe, expect, it } from 'vitest'
import { computeHoldUntil, isWithinPhoneIntakeHours } from './holdDeadline.js'

describe('isWithinPhoneIntakeHours', () => {
  it('true at 19:00 JST and overnight before 06:00', () => {
    expect(isWithinPhoneIntakeHours(new Date('2026-08-11T10:00:00.000Z'))).toBe(true) // 19:00 JST
    expect(isWithinPhoneIntakeHours(new Date('2026-08-11T20:30:00.000Z'))).toBe(true) // 05:30 JST
  })

  it('false during daytime before 19:00', () => {
    expect(isWithinPhoneIntakeHours(new Date('2026-08-11T05:00:00.000Z'))).toBe(false) // 14:00 JST
    expect(isWithinPhoneIntakeHours(new Date('2026-08-11T09:59:00.000Z'))).toBe(false) // 18:59 JST
  })
})

describe('computeHoldUntil', () => {
  it('adds 15 minutes when created in intake hours', () => {
    const created = new Date('2026-08-11T10:05:00.000Z') // 19:05 JST
    expect(computeHoldUntil(created).toISOString()).toBe('2026-08-11T10:20:00.000Z')
  })

  it('uses next 19:00 when created outside intake hours', () => {
    const created = new Date('2026-08-11T05:00:00.000Z') // 14:00 JST
    expect(computeHoldUntil(created).toISOString()).toBe('2026-08-11T10:00:00.000Z') // 19:00 JST
  })
})
