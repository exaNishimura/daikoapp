import { describe, expect, it, vi } from 'vitest'
import { buildReservationPayloadFromOrderForm, submitFutureNightOrder } from './orderSubmission'

describe('buildReservationPayloadFromOrderForm', () => {
  it('maps order form fields onto the reservation ledger', () => {
    const payload = buildReservationPayloadFromOrderForm({
      scheduled_at: '2026-09-26T20:00',
      pickup_location: 'モンガータ',
      contact_phone: '090-1111-2222',
      pickup_address: '鈴鹿市A',
      dropoff_address: '鈴鹿市B',
      waypoints: ['経由1', ''],
      car_model: 'プリウス',
      car_color: '白',
      car_plate: '三重500あ1234',
      parking_note: '入口横',
    })

    expect(payload.customer_name).toBe('モンガータ')
    expect(payload.phone).toBe('090-1111-2222')
    expect(payload.memo).toContain('出発: 鈴鹿市A')
    expect(payload.memo).toContain('目的: 鈴鹿市B')
    expect(payload.memo).toContain('経由: 経由1')
    expect(payload.memo).toContain('車: プリウス 白 三重500あ1234')
    expect(payload.memo).toContain('駐車: 入口横')
    expect(new Date(payload.reserved_at).getTime()).toBe(new Date('2026-09-26T20:00').getTime())
  })

  it('falls back to 電話依頼 when pickup_location is empty', () => {
    const payload = buildReservationPayloadFromOrderForm({
      scheduled_at: '2026-09-26T20:00',
      pickup_location: '  ',
      contact_phone: '090-0000-0000',
      pickup_address: 'A',
      dropoff_address: 'B',
    })
    expect(payload.customer_name).toBe('電話依頼')
  })
})

describe('submitFutureNightOrder', () => {
  const formData = {
    order_type: 'SCHEDULED',
    scheduled_at: '2026-09-27T20:00',
    pickup_location: '電話依頼',
    pickup_address: 'A',
    dropoff_address: 'B',
    waypoints: [],
    contact_phone: '090-0000-0000',
    parking_note: '',
  }

  it('deletes the reservation when creating the order fails', async () => {
    const deleteReservation = vi.fn()
    await expect(
      submitFutureNightOrder({
        formData,
        createReservation: async () => ({ id: 'res-1' }),
        createOrder: async () => {
          throw new Error('order failed')
        },
        updateOrder: async () => {},
        fetchVehicles: async () => [],
        updateReservation: async () => {},
        deleteReservation,
      })
    ).rejects.toThrow('order failed')
    expect(deleteReservation).toHaveBeenCalledWith('res-1')
  })
})
