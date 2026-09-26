import { describe, expect, it, vi } from 'vitest'
import { buildOrderPayloadFromReservation, placeReservationOnTimeline } from './placeReservation'

vi.mock('@/services/routeService', () => ({
  calculateBuffer: vi.fn(() => 5),
}))

describe('buildOrderPayloadFromReservation', () => {
  it('maps memo fields onto a SCHEDULED order', () => {
    const payload = buildOrderPayloadFromReservation({
      id: '11111111-1111-1111-1111-111111111111',
      reserved_at: '2026-09-26T11:00:00.000Z',
      customer_name: 'モンガータ',
      phone: '090-1111-2222',
      memo: '出発: 鈴鹿市平田町\n目的: 白子駅\n経由: 経由A\n車: プリウス\n駐車: 入口',
    })
    expect(payload.order_type).toBe('SCHEDULED')
    expect(payload.pickup_location).toBe('モンガータ')
    expect(payload.pickup_address).toBe('鈴鹿市平田町')
    expect(payload.dropoff_address).toBe('白子駅')
    expect(payload.waypoints).toEqual(['経由A'])
    expect(payload.contact_phone).toBe('090-1111-2222')
    expect(payload.car_model).toBe('プリウス')
    expect(payload.parking_note).toContain('[RESERVATION:11111111-1111-1111-1111-111111111111]')
    expect(payload.parking_note).toContain('入口')
    expect(payload.status).toBe('UNASSIGNED')
  })

  it('drops placeholder phone', () => {
    const payload = buildOrderPayloadFromReservation({
      reserved_at: '2026-09-26T11:00:00.000Z',
      customer_name: '電話依頼',
      phone: '未入力',
      memo: '',
    })
    expect(payload.contact_phone).toBeNull()
    expect(payload.pickup_address).toBe('')
  })
})

describe('placeReservationOnTimeline', () => {
  const reservationId = '11111111-1111-1111-1111-111111111111'
  const reservation = {
    id: reservationId,
    reserved_at: '2026-09-26T11:00:00.000Z',
    customer_name: '電話依頼',
    phone: '未入力',
    memo: '出発: 鈴鹿市平田町\n目的: 白子駅',
  }
  const startAt = new Date('2026-09-26T11:00:00.000Z')
  const existing = {
    id: 'order-1',
    parking_note: `[RESERVATION:${reservationId}]`,
    scheduled_at: '2026-09-26T11:00:00.000Z',
    base_duration_min: 30,
    buffer_min: 5,
  }

  it('reuses a marked order instead of creating another', async () => {
    const createOrder = vi.fn()
    const createSlot = vi.fn(async (payload) => ({ id: 'slot-1', ...payload }))
    const updateReservation = vi.fn()
    const findLinkedOrder = vi.fn()

    const result = await placeReservationOnTimeline({
      reservation,
      vehicles: [{ id: 'v1' }],
      slots: [],
      operationStatuses: {},
      startAt,
      vehicleId: 'v1',
      existingOrders: [existing],
      createOrder,
      createSlot,
      updateReservation,
      findLinkedOrder,
    })

    expect(createOrder).not.toHaveBeenCalled()
    expect(findLinkedOrder).not.toHaveBeenCalled()
    expect(createSlot).toHaveBeenCalledOnce()
    expect(result.order.id).toBe('order-1')
    expect(result.slot.id).toBe('slot-1')
  })

  it('skips when the linked order already has a slot', async () => {
    const createOrder = vi.fn()
    const createSlot = vi.fn()
    const updateReservation = vi.fn()
    const findLinkedOrder = vi.fn()

    const result = await placeReservationOnTimeline({
      reservation,
      vehicles: [{ id: 'v1' }],
      slots: [{ id: 'slot-1', order_id: 'order-1' }],
      existingOrders: [existing],
      createOrder,
      createSlot,
      updateReservation,
      findLinkedOrder,
    })

    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('already-slotted')
    expect(createOrder).not.toHaveBeenCalled()
    expect(createSlot).not.toHaveBeenCalled()
  })
})
