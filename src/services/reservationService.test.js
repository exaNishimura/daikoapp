import { describe, expect, it } from 'vitest'
import { missingReservationFields } from './reservationService.js'

describe('missingReservationFields', () => {
  it('returns empty when required fields are present', () => {
    expect(
      missingReservationFields({
        reserved_at: '2026-07-19T10:00:00.000Z',
        customer_name: '山田',
        phone: '090-1234-5678',
      })
    ).toEqual([])
  })

  it('lists missing required fields', () => {
    expect(missingReservationFields({ memo: 'x' })).toEqual([
      'reserved_at',
      'customer_name',
      'phone',
    ])
    expect(
      missingReservationFields({
        reserved_at: '  ',
        customer_name: 'a',
        phone: 'b',
      })
    ).toEqual(['reserved_at'])
  })
})
