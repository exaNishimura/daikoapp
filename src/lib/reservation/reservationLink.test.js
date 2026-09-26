import { describe, expect, it } from 'vitest'
import {
  isReservationLinked,
  reservationIdFromOrder,
  withReservationMark,
} from './reservationLink'

describe('reservationLink', () => {
  it('stamps and reads a reservation mark', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const note = withReservationMark('入口横', id)
    expect(note.startsWith(`[RESERVATION:${id}]`)).toBe(true)
    expect(reservationIdFromOrder({ parking_note: note })).toBe(id)
  })

  it('treats order_id as linked', () => {
    expect(isReservationLinked({ id: 'r1', order_id: 'o1' }, [])).toBe(true)
    expect(isReservationLinked({ id: 'r1' }, [])).toBe(false)
    expect(
      isReservationLinked(
        { id: '11111111-1111-1111-1111-111111111111' },
        [{ parking_note: '[RESERVATION:11111111-1111-1111-1111-111111111111]' }]
      )
    ).toBe(true)
  })
})
