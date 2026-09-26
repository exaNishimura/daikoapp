import { describe, expect, it } from 'vitest'
import { parseReservationMemo, waypointListFromMemo } from './reservationMemo'

describe('parseReservationMemo', () => {
  it('splits order-form memo lines', () => {
    const parsed = parseReservationMemo(
      ['出発: 鈴鹿市A', '目的: 鈴鹿市B', '経由: 経由1 → 経由2', '車: プリウス 白', '駐車: 入口'].join(
        '\n'
      )
    )
    expect(parsed.pickup).toBe('鈴鹿市A')
    expect(parsed.dropoff).toBe('鈴鹿市B')
    expect(parsed.via).toBe('経由1 → 経由2')
    expect(parsed.car).toBe('プリウス 白')
    expect(parsed.parking).toBe('入口')
    expect(waypointListFromMemo(parsed)).toEqual(['経由1', '経由2'])
  })

  it('keeps free-text lines in rest', () => {
    const parsed = parseReservationMemo('電話で確認済み')
    expect(parsed.rest).toEqual(['電話で確認済み'])
    expect(parsed.pickup).toBe('')
  })
})
