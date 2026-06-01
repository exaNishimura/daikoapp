import { describe, it, expect } from 'vitest'
import {
  snapTo15Minutes,
  timeToMinutes,
  minutesToTime,
  minutesToPixels,
  pixelsToMinutes,
  exceedsBusinessHours,
  formatBusinessDay,
} from './timeUtils'

describe('snapTo15Minutes', () => {
  it('15分の倍数はそのまま返す', () => {
    expect(snapTo15Minutes(0)).toBe(0)
    expect(snapTo15Minutes(15)).toBe(15)
    expect(snapTo15Minutes(60)).toBe(60)
  })
  it('7分以下は0、8分以上は15に丸める', () => {
    expect(snapTo15Minutes(7)).toBe(0)
    expect(snapTo15Minutes(8)).toBe(15)
    expect(snapTo15Minutes(22)).toBe(15)
    expect(snapTo15Minutes(23)).toBe(30)
  })
})

describe('timeToMinutes / minutesToTime', () => {
  it('時間→分の変換が逆変換と一致', () => {
    expect(timeToMinutes(18, 30)).toBe(1110)
    expect(minutesToTime(1110)).toEqual({ hours: 18, minutes: 30 })
  })
  it('minutes省略時は0として計算', () => {
    expect(timeToMinutes(20)).toBe(1200)
  })
})

describe('minutesToPixels / pixelsToMinutes', () => {
  it('15分 = 20px の換算が成立', () => {
    expect(minutesToPixels(15)).toBe(20)
    expect(pixelsToMinutes(20)).toBe(15)
  })
  it('1時間 = 80px', () => {
    expect(minutesToPixels(60)).toBe(80)
    expect(pixelsToMinutes(80)).toBe(60)
  })
  it('逆変換で元に戻る', () => {
    expect(pixelsToMinutes(minutesToPixels(45))).toBe(45)
  })
})

describe('exceedsBusinessHours', () => {
  it('翌日06:00以前の終了時刻は営業時間内', () => {
    const endAt = new Date(2026, 5, 1, 5, 30) // 翌6/1 05:30
    expect(exceedsBusinessHours(endAt)).toBe(false)
  })
})

describe('formatBusinessDay', () => {
  it('06:00以降は同日扱い', () => {
    const d = new Date(2026, 5, 1, 18, 0) // 6/1 18:00
    expect(formatBusinessDay(d)).toMatch(/2026年06月01日/)
  })
  it('06:00未満は前日扱い', () => {
    const d = new Date(2026, 5, 2, 3, 0) // 6/2 03:00 → 6/1扱い
    expect(formatBusinessDay(d)).toMatch(/2026年06月01日/)
  })
})
