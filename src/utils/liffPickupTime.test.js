import { describe, expect, it } from 'vitest'
import {
  LIFF_PICKUP_HOURS,
  LIFF_PICKUP_MINUTES,
  combineOvernightPickup,
  formatLiffHourLabel,
  formatLiffPickupConfirmMessage,
  formatLiffPickupPreview,
  getMinLiffPickupDate,
  isLiffNowAvailable,
  nextLiffPickupAt,
} from './liffPickupTime'

describe('combineOvernightPickup', () => {
  it('maps 20:00 on the selected night to that calendar evening', () => {
    const dt = combineOvernightPickup('2025-08-13', 20, 0)
    expect(dt.getFullYear()).toBe(2025)
    expect(dt.getMonth() + 1).toBe(8)
    expect(dt.getDate()).toBe(13)
    expect(dt.getHours()).toBe(20)
    expect(dt.getMinutes()).toBe(0)
  })

  it('maps 2:00 on the selected night to the next calendar morning', () => {
    const dt = combineOvernightPickup('2025-08-13', 2, 15)
    expect(dt.getDate()).toBe(14)
    expect(dt.getHours()).toBe(2)
    expect(dt.getMinutes()).toBe(15)
  })

  it('maps 0:00 to next calendar day (midnight)', () => {
    const dt = combineOvernightPickup('2025-08-13', 0, 0)
    expect(dt.getDate()).toBe(14)
    expect(dt.getHours()).toBe(0)
  })

  it('rolls month when overnight crosses', () => {
    const dt = combineOvernightPickup('2025-08-31', 3, 30)
    expect(dt.getFullYear()).toBe(2025)
    expect(dt.getMonth() + 1).toBe(9)
    expect(dt.getDate()).toBe(1)
    expect(dt.getHours()).toBe(3)
  })

  it('returns null when parts are missing (0 hour is valid)', () => {
    expect(combineOvernightPickup('', 20, 0)).toBe(null)
    expect(combineOvernightPickup('2025-08-13', '', 0)).toBe(null)
    expect(combineOvernightPickup('2025-08-13', 20, '')).toBe(null)
    expect(combineOvernightPickup('2025-08-13', 0, 0)).not.toBe(null)
  })
})

describe('formatLiffHourLabel', () => {
  it('labels overnight hours', () => {
    expect(formatLiffHourLabel(20)).toBe('20時')
    expect(formatLiffHourLabel(0)).toBe('0時（深夜）')
    expect(formatLiffHourLabel(2)).toBe('2時（翌朝）')
  })
})

describe('getMinLiffPickupDate', () => {
  it('uses the previous calendar date before 06:00', () => {
    expect(getMinLiffPickupDate(new Date(2025, 7, 14, 2, 0))).toBe('2025-08-13')
  })

  it('uses today during daytime', () => {
    expect(getMinLiffPickupDate(new Date(2025, 7, 13, 14, 0))).toBe('2025-08-13')
  })
})

describe('formatLiffPickupConfirmMessage', () => {
  const now = new Date(2025, 7, 13, 14, 0, 0, 0)

  it('uses hours-and-minutes copy on the same calendar day', () => {
    const pickup = new Date(2025, 7, 13, 20, 0)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '6時間後のご予約でよろしいでしょうか？'
    )
  })

  it('mixes hours and minutes when not on the hour', () => {
    const pickup = new Date(2025, 7, 13, 17, 45)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '3時間45分後のご予約でよろしいでしょうか？'
    )
  })

  it('keeps minutes-only copy under one hour', () => {
    const pickup = new Date(2025, 7, 13, 14, 45)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '45分後のご予約でよろしいでしょうか？'
    )
  })

  it('uses day-later copy when crossing midnight', () => {
    const pickup = new Date(2025, 7, 14, 2, 0)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '1日後（8月14日）2時のご予約でよろしいでしょうか？'
    )
  })

  it('includes minutes when not on the hour', () => {
    const pickup = new Date(2025, 7, 15, 20, 15)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '2日後（8月15日）20時15分のご予約でよろしいでしょうか？'
    )
  })

  it('uses day-later copy when 24 hours or more even without thinking about midnight', () => {
    const pickup = new Date(2025, 7, 14, 14, 0)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe(
      '1日後（8月14日）14時のご予約でよろしいでしょうか？'
    )
  })

  it('asks about NOW bookings', () => {
    expect(formatLiffPickupConfirmMessage(null, { now, orderType: 'NOW' })).toBe(
      '今すぐのご予約でよろしいでしょうか？'
    )
  })

  it('returns empty for past pickup', () => {
    const pickup = new Date(2025, 7, 13, 13, 0)
    expect(formatLiffPickupConfirmMessage(pickup, { now })).toBe('')
  })
})

describe('isLiffNowAvailable', () => {
  it('is false during daytime', () => {
    expect(isLiffNowAvailable(new Date(2025, 7, 13, 16, 33))).toBe(false)
    expect(isLiffNowAvailable(new Date(2025, 7, 13, 18, 59))).toBe(false)
  })

  it('is true from 19:00 through early morning', () => {
    expect(isLiffNowAvailable(new Date(2025, 7, 13, 19, 0))).toBe(true)
    expect(isLiffNowAvailable(new Date(2025, 7, 14, 2, 0))).toBe(true)
    expect(isLiffNowAvailable(new Date(2025, 7, 14, 5, 59))).toBe(true)
  })

  it('is false at 06:00', () => {
    expect(isLiffNowAvailable(new Date(2025, 7, 14, 6, 0))).toBe(false)
  })
})

describe('nextLiffPickupAt', () => {
  it('returns today 20:00 during daytime', () => {
    const next = nextLiffPickupAt(new Date(2025, 7, 13, 16, 30))
    expect(next.getFullYear()).toBe(2025)
    expect(next.getMonth() + 1).toBe(8)
    expect(next.getDate()).toBe(13)
    expect(next.getHours()).toBe(20)
    expect(next.getMinutes()).toBe(0)
  })

  it('rolls to tomorrow after 20:00', () => {
    const next = nextLiffPickupAt(new Date(2025, 7, 13, 21, 0))
    expect(next.getDate()).toBe(14)
    expect(next.getHours()).toBe(20)
  })
})

describe('formatLiffPickupPreview', () => {
  it('shows resolved calendar datetime', () => {
    const pickup = combineOvernightPickup('2025-08-13', 2, 0)
    expect(formatLiffPickupPreview(pickup)).toBe('お迎え: 8月14日 2時')
  })
})

describe('constants', () => {
  it('covers 20:00 through 05:00 in 15-minute steps', () => {
    expect(LIFF_PICKUP_HOURS[0]).toBe(20)
    expect(LIFF_PICKUP_HOURS.at(-1)).toBe(5)
    expect(LIFF_PICKUP_MINUTES).toEqual([0, 15, 30, 45])
  })
})
