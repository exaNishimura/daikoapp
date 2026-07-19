import { describe, expect, it } from 'vitest'
import {
  MAX_LINE_MESSAGE_CHARS,
  MAX_MEMO_CHARS,
  MAX_RESERVATIONS_IN_MESSAGE,
  buildReservationLineMessage,
} from './buildLineMessage.js'

function res(overrides) {
  return {
    reservedAt: '2026-07-19T10:30:00.000Z', // 19:30 JST
    customerName: '山田太郎',
    phone: '090-1234-5678',
    memo: '',
    ...overrides,
  }
}

describe('buildReservationLineMessage', () => {
  it('builds header and one reservation line with JST time', () => {
    const text = buildReservationLineMessage({
      notifyDate: '2026-07-19',
      reservations: [res()],
    })

    expect(text).toContain('【予約】7/19（日）受付分')
    expect(text).toContain('19:30 山田太郎 090-1234-5678')
    expect(text).not.toContain('メモ:')
  })

  it('appends truncated memo when present', () => {
    const longMemo = 'あ'.repeat(MAX_MEMO_CHARS + 10)
    const text = buildReservationLineMessage({
      notifyDate: '2026-07-19',
      reservations: [res({ memo: longMemo })],
    })

    expect(text).toContain(`メモ: ${'あ'.repeat(MAX_MEMO_CHARS)}…`)
  })

  it('sorts by reservedAt ascending', () => {
    const text = buildReservationLineMessage({
      notifyDate: '2026-07-19',
      reservations: [
        res({
          reservedAt: '2026-07-19T12:00:00.000Z', // 21:00 JST
          customerName: '後',
        }),
        res({
          reservedAt: '2026-07-19T10:00:00.000Z', // 19:00 JST
          customerName: '先',
        }),
      ],
    })

    const first = text.indexOf('先')
    const second = text.indexOf('後')
    expect(first).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(first)
  })

  it('caps listed reservations and adds remainder footer', () => {
    const many = Array.from({ length: MAX_RESERVATIONS_IN_MESSAGE + 3 }, (_, i) =>
      res({
        reservedAt: new Date(Date.UTC(2026, 6, 19, 10, i)).toISOString(),
        customerName: `客${i}`,
        phone: `090-${String(i).padStart(4, '0')}-0000`,
      })
    )

    const text = buildReservationLineMessage({
      notifyDate: '2026-07-19',
      reservations: many,
    })

    expect(text).toContain(`他 ${3} 件は台帳で確認`)
    expect(text.length).toBeLessThanOrEqual(MAX_LINE_MESSAGE_CHARS)
  })

  it('throws when reservations is empty', () => {
    expect(() =>
      buildReservationLineMessage({ notifyDate: '2026-07-19', reservations: [] })
    ).toThrow()
  })
})
