import { describe, expect, it } from 'vitest'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_REVERT_MAP,
  STATUS_ADVANCE_MAP,
  getStatusLabel,
  getStatusColor,
  getRevertStatus,
  getAdvanceStatus,
} from './orderStatusUtils'

describe('STATUS_LABELS / STATUS_COLORS', () => {
  it('covers all known statuses', () => {
    const expected = [
      'UNASSIGNED',
      'TENTATIVE',
      'CONFIRMED',
      'ARRIVED',
      'PICKING_UP',
      'IN_TRANSIT',
      'COMPLETED',
      'CANCELLED',
    ]
    expected.forEach((s) => {
      expect(STATUS_LABELS[s]).toBeDefined()
      expect(STATUS_COLORS[s]).toBeDefined()
    })
  })
})

describe('getStatusLabel / getStatusColor', () => {
  it('returns the mapped label/color', () => {
    expect(getStatusLabel('CONFIRMED')).toBe('確定')
    expect(getStatusColor('CONFIRMED')).toBe('success')
  })
  it('falls back gracefully for unknown', () => {
    expect(getStatusLabel('FOO')).toBe('不明')
    expect(getStatusColor('FOO')).toBe('default')
  })
})

describe('STATUS_REVERT_MAP', () => {
  it('walks COMPLETED -> IN_TRANSIT -> PICKING_UP -> ARRIVED -> CONFIRMED -> TENTATIVE', () => {
    let current = 'COMPLETED'
    const path = [current]
    while (STATUS_REVERT_MAP[current]) {
      current = STATUS_REVERT_MAP[current]
      path.push(current)
    }
    expect(path).toEqual([
      'COMPLETED',
      'IN_TRANSIT',
      'PICKING_UP',
      'ARRIVED',
      'CONFIRMED',
      'TENTATIVE',
    ])
  })
})

describe('STATUS_ADVANCE_MAP', () => {
  it('advances CONFIRMED -> ARRIVED -> PICKING_UP -> IN_TRANSIT -> COMPLETED', () => {
    let current = 'CONFIRMED'
    const path = [current]
    while (STATUS_ADVANCE_MAP[current]) {
      current = STATUS_ADVANCE_MAP[current]
      path.push(current)
    }
    expect(path).toEqual(['CONFIRMED', 'ARRIVED', 'PICKING_UP', 'IN_TRANSIT', 'COMPLETED'])
  })

  it('returns null for terminal states', () => {
    expect(getAdvanceStatus('COMPLETED')).toBeNull()
    expect(getAdvanceStatus('CANCELLED')).toBeNull()
    expect(getRevertStatus('UNASSIGNED')).toBeNull()
  })
})
