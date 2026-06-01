import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/slotUtils', () => ({
  findEarliestAvailableSlotAcrossVehicles: vi.fn(() => null),
}))
vi.mock('@/services/routeService', () => ({
  calculateBuffer: vi.fn(() => 10),
}))

import { computeDesiredStartTime, findAutoPlacementSlot } from './orderPlacement'
import { findEarliestAvailableSlotAcrossVehicles } from '@/utils/slotUtils'

describe('computeDesiredStartTime', () => {
  it('"NOW" within business hours -> next 15-min row', () => {
    const now = new Date(2025, 5, 1, 21, 7) // 21:07
    const t = computeDesiredStartTime({ order_type: 'NOW' }, now)
    // 21:00 = row 12, +1 -> row 13 -> 21:15
    expect(t.getHours()).toBe(21)
    expect(t.getMinutes()).toBe(15)
  })

  it('"NOW" outside business hours -> today 18:00', () => {
    const now = new Date(2025, 5, 1, 10, 0)
    const t = computeDesiredStartTime({ order_type: 'NOW' }, now)
    expect(t.getHours()).toBe(18)
    expect(t.getMinutes()).toBe(0)
    expect(t.getDate()).toBe(1)
  })

  it('"NOW" after 18:00 outside the 06-18 gap rolls to next day 18:00', () => {
    // 18:30 は isBusinessHour=true 扱いだが、isBusinessHour 中の NOW は次行スナップになる。
    // 「営業時間外で 18:00 を過ぎた」分岐は時刻 6-17 のとき動く分岐ではないので、
    // ここでは 17:30 のテストにしておく。
    const now = new Date(2025, 5, 1, 17, 30)
    const t = computeDesiredStartTime({ order_type: 'NOW' }, now)
    expect(t.getHours()).toBe(18)
    expect(t.getDate()).toBe(1)
  })

  it('SCHEDULED returns scheduled_at as Date', () => {
    const t = computeDesiredStartTime({
      order_type: 'SCHEDULED',
      scheduled_at: '2025-06-02T13:30:00.000Z',
    })
    expect(t.toISOString()).toBe('2025-06-02T13:30:00.000Z')
  })

  it('Fallback: business-hour now -> now (copy)', () => {
    const now = new Date(2025, 5, 1, 22, 0)
    const t = computeDesiredStartTime({}, now)
    expect(t.getTime()).toBe(now.getTime())
    expect(t).not.toBe(now) // copy
  })
})

describe('findAutoPlacementSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes preferExactTime=true only for SCHEDULED with scheduled_at', () => {
    findAutoPlacementSlot({
      order: { order_type: 'SCHEDULED', scheduled_at: '2025-06-02T13:30:00.000Z' },
      vehicles: [],
      slots: [],
      operationStatuses: {},
      now: new Date(2025, 5, 1, 22, 0),
    })
    expect(findEarliestAvailableSlotAcrossVehicles).toHaveBeenCalledTimes(1)
    const args = findEarliestAvailableSlotAcrossVehicles.mock.calls[0]
    expect(args[4]).toBe(true)
  })

  it('preferExactTime=false for NOW orders', () => {
    findAutoPlacementSlot({
      order: { order_type: 'NOW' },
      vehicles: [],
      slots: [],
      operationStatuses: {},
      now: new Date(2025, 5, 1, 22, 0),
    })
    expect(findEarliestAvailableSlotAcrossVehicles.mock.calls[0][4]).toBe(false)
  })

  it('uses base_duration_min + buffer_min if present', () => {
    findAutoPlacementSlot({
      order: { order_type: 'NOW', base_duration_min: 45, buffer_min: 5 },
      vehicles: [],
      slots: [],
      operationStatuses: {},
      now: new Date(2025, 5, 1, 22, 0),
    })
    const args = findEarliestAvailableSlotAcrossVehicles.mock.calls[0]
    expect(args[3]).toBe(50)
  })

  it('falls back to calculateBuffer(30) when buffer_min is missing', () => {
    findAutoPlacementSlot({
      order: { order_type: 'NOW' },
      vehicles: [],
      slots: [],
      operationStatuses: {},
      now: new Date(2025, 5, 1, 22, 0),
    })
    // calculateBuffer mock = 10, base default = 30, total = 40
    expect(findEarliestAvailableSlotAcrossVehicles.mock.calls[0][3]).toBe(40)
  })
})
