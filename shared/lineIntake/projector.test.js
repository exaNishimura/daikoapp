import { describe, expect, it } from 'vitest'
import { buildLineChannelMarkers, resolveProjectionTarget, toBoardRouteFields } from './projector.js'

describe('resolveProjectionTarget', () => {
  it('same business day → BOARD', () => {
    const now = new Date('2026-08-11T10:00:00.000Z')
    const pickup = new Date('2026-08-11T12:00:00.000Z')
    expect(resolveProjectionTarget(pickup, now)).toBe('BOARD')
  })

  it('other business day → LEDGER', () => {
    const now = new Date('2026-08-11T10:00:00.000Z')
    const pickup = new Date('2026-08-14T10:00:00.000Z')
    expect(resolveProjectionTarget(pickup, now)).toBe('LEDGER')
  })
})

describe('toBoardRouteFields', () => {
  it('keeps Maps minutes and zeros dispatch buffer', () => {
    expect(toBoardRouteFields({ base_duration_min: 48, buffer_min: 12 })).toEqual({
      base_duration_min: 48,
      buffer_min: 0,
    })
  })

  it('falls back to 30 when Maps is missing', () => {
    expect(toBoardRouteFields({ base_duration_min: null })).toEqual({
      base_duration_min: 30,
      buffer_min: 0,
    })
  })
})

describe('buildLineChannelMarkers', () => {
  it('marks LINE channel', () => {
    const m = buildLineChannelMarkers({
      lineUserId: 'U1',
      unitId: 'unit-1',
      discountLabel: '500円引き',
    })
    expect(m.channel).toBe('LINE')
    expect(m.memo_prefix).toContain('[LINE]')
    expect(m.memo_prefix).toContain('500円引き')
  })
})
