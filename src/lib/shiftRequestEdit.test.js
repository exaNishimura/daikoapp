import { describe, expect, it } from 'vitest'
import {
  LICENSE_TYPE1,
  LICENSE_TYPE2,
  alignEndToShorter,
  alignStartToLater,
  buildRequestsByDate,
  buildStaffAdoptionSummary,
  computeShiftsLaborCost,
  countAvailableByLicense,
  earlierEndTime,
  evaluateDayStaffing,
  findAdoptedShiftsForEmployee,
  formatTimeRange,
  formatYen,
  isEmployeeAdoptedOnDate,
  laterStartTime,
  partnersNeedingEndTrim,
  partnersNeedingStartPush,
  requestedEndForEmployee,
  requestedStartForEmployee,
  suggestCarAndRole,
} from './shiftRequestEdit'

const employees = [
  { id: 'e1', name: '西村', license_type: LICENSE_TYPE2, hourly_wage: 1500 },
  { id: 'e2', name: 'たかし', license_type: LICENSE_TYPE1, hourly_wage: 1200 },
  { id: 'e3', name: 'なみ', license_type: LICENSE_TYPE1, hourly_wage: 1100 },
  { id: 'e4', name: '鈴木', license_type: LICENSE_TYPE2, hourly_wage: 1400 },
]

describe('formatTimeRange / formatYen', () => {
  it('時刻と円を整形する', () => {
    expect(formatTimeRange('23:00', '06:00')).toBe('23:00〜06:00')
    expect(formatTimeRange('9:05:00', '2:00')).toBe('09:05〜02:00')
    expect(formatYen(123456)).toBe('¥123,456')
    expect(formatYen(null)).toBe('¥0')
  })
})

describe('buildRequestsByDate', () => {
  it('出勤可の日だけ日付キーに並べ、二種を先にする', () => {
    const map = buildRequestsByDate([
      {
        employee_id: 'e2',
        employee_name: 'たかし',
        license_type: LICENSE_TYPE1,
        payload: {
          days: {
            '2026-10-02': { available: true, start: '20:00', end: '06:00' },
            '2026-10-03': { available: false, start: '20:00', end: '06:00' },
          },
        },
      },
      {
        employee_id: 'e1',
        employee_name: '西村',
        license_type: LICENSE_TYPE2,
        payload: {
          days: {
            '2026-10-02': { available: true, start: '23:00', end: '06:00' },
          },
        },
      },
    ])

    expect(map['2026-10-03']).toBeUndefined()
    expect(map['2026-10-02'].map((r) => r.name)).toEqual(['西村', 'たかし'])
    expect(map['2026-10-02'][0]).toMatchObject({
      employeeId: 'e1',
      start: '23:00',
      end: '06:00',
    })
  })
})

describe('countAvailableByLicense', () => {
  it('一種と二種の希望人数を数える', () => {
    expect(
      countAvailableByLicense([
        { licenseType: LICENSE_TYPE2 },
        { licenseType: LICENSE_TYPE2 },
        { licenseType: LICENSE_TYPE1 },
      ])
    ).toEqual({ type1: 1, type2: 2 })
  })
})

describe('findAdoptedShiftsForEmployee', () => {
  const dateShifts = [
    { id: 's1', employee_id: 'e1', staff: '西村', car: '1', role: '代行' },
    { id: 's2', employee_id: 'e2', staff: 'たかし', car: '1', role: '随伴' },
    { id: 'st', status: '定休日', employee_id: 'e1' },
  ]

  it('ステータス行を除いて該当シフトを返す', () => {
    expect(findAdoptedShiftsForEmployee(dateShifts, 'e1', employees).map((s) => s.id)).toEqual([
      's1',
    ])
    expect(isEmployeeAdoptedOnDate(dateShifts, 'e3', employees)).toBe(false)
    expect(isEmployeeAdoptedOnDate(dateShifts, 'e2', employees)).toBe(true)
  })
})

describe('earlierEndTime / laterStartTime / align', () => {
  it('翌日跨ぎでは 02:00 の方が 06:00 より短い', () => {
    expect(earlierEndTime('06:00', '02:00')).toBe('02:00')
    expect(earlierEndTime('02:00', '06:00')).toBe('02:00')
    expect(earlierEndTime('01:00', '23:00')).toBe('23:00')
  })

  it('開始は 23:00 の方が 20:00 より遅い', () => {
    expect(laterStartTime('20:00', '23:00')).toBe('23:00')
    expect(laterStartTime('23:00', '20:00')).toBe('23:00')
    expect(laterStartTime('00:30', '23:00')).toBe('00:30')
  })

  it('ペア相手の終了が早いならそちらに揃える', () => {
    const partners = [{ planned_end: '02:00', planned_start: '20:00', end: '02:00' }]
    expect(alignEndToShorter('06:00', partners)).toBe('02:00')
    expect(alignEndToShorter('01:00', partners)).toBe('01:00')
  })

  it('ペア相手の開始が遅いならそちらに揃える', () => {
    const partners = [{ planned_start: '23:00', planned_end: '06:00', start: '23:00' }]
    expect(alignStartToLater('20:00', partners)).toBe('23:00')
    expect(alignStartToLater('00:00', partners)).toBe('00:00')
  })

  it('相手の方が遅いときだけ終了を切り詰める', () => {
    const partners = [
      { id: 's1', planned_end: '06:00', end: '06:00' },
      { id: 's2', planned_end: '02:00', end: '02:00' },
    ]
    expect(partnersNeedingEndTrim(partners, '02:00').map((s) => s.id)).toEqual(['s1'])
    expect(partnersNeedingEndTrim(partners, '06:00')).toEqual([])
  })

  it('相手の開始が早いときだけ遅らせる', () => {
    const partners = [
      { id: 's1', planned_start: '20:00', start: '20:00' },
      { id: 's2', planned_start: '23:00', start: '23:00' },
    ]
    expect(partnersNeedingStartPush(partners, '23:00').map((s) => s.id)).toEqual(['s1'])
    expect(partnersNeedingStartPush(partners, '20:00')).toEqual([])
  })

  it('希望の開始・終了時刻を取り出す', () => {
    const rows = [
      {
        employee_id: 'e1',
        payload: {
          days: { '2026-10-02': { available: true, start: '23:00', end: '2:00' } },
        },
      },
    ]
    expect(requestedStartForEmployee(rows, 'e1', '2026-10-02')).toBe('23:00')
    expect(requestedEndForEmployee(rows, 'e1', '2026-10-02')).toBe('02:00')
  })
})

describe('suggestCarAndRole', () => {
  it('空きなら二種は1号車の代行、一種は随伴', () => {
    expect(suggestCarAndRole([], LICENSE_TYPE2, employees)).toEqual({ car: '1', role: '代行' })
    expect(suggestCarAndRole([], LICENSE_TYPE1, employees)).toEqual({ car: '1', role: '随伴' })
  })

  it('1号車に二種がいる一種は1号車の随伴に入れる', () => {
    const dateShifts = [{ employee_id: 'e1', staff: '西村', car: '1', role: '代行' }]
    expect(suggestCarAndRole(dateShifts, LICENSE_TYPE1, employees)).toEqual({
      car: '1',
      role: '随伴',
    })
  })

  it('1号車が一種のみなら二種は1号車の代行、次の一種は2号車へ', () => {
    const withType1 = [{ employee_id: 'e2', staff: 'たかし', car: '1', role: '随伴' }]
    expect(suggestCarAndRole(withType1, LICENSE_TYPE2, employees)).toEqual({
      car: '1',
      role: '代行',
    })

    const fullCar1 = [
      { employee_id: 'e1', staff: '西村', car: '1', role: '代行' },
      { employee_id: 'e2', staff: 'たかし', car: '1', role: '随伴' },
    ]
    expect(suggestCarAndRole(fullCar1, LICENSE_TYPE1, employees)).toEqual({
      car: '2',
      role: '随伴',
    })
  })
})

describe('evaluateDayStaffing', () => {
  it('一種のみ2名ならペア不可の警告を出す', () => {
    const result = evaluateDayStaffing(
      [
        { employee_id: 'e2', staff: 'たかし', car: '1', role: '随伴' },
        { employee_id: 'e3', staff: 'なみ', car: '1', role: '代行' },
      ],
      employees
    )
    expect(result).toMatchObject({ type1: 2, type2: 0 })
    expect(result.warnings.some((w) => w.includes('一種のみ'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('二種がいない'))).toBe(true)
  })

  it('二種+一種なら警告なし', () => {
    const result = evaluateDayStaffing(
      [
        { employee_id: 'e1', staff: '西村', car: '1', role: '代行' },
        { employee_id: 'e2', staff: 'たかし', car: '1', role: '随伴' },
      ],
      employees
    )
    expect(result).toEqual({ type1: 1, type2: 1, warnings: [] })
  })

  it('1名だけの号車はペア不足', () => {
    const result = evaluateDayStaffing(
      [{ employee_id: 'e1', staff: '西村', car: '1', role: '代行' }],
      employees
    )
    expect(result.warnings).toContain('1号車が1名（ペア不足）')
  })
})

describe('computeShiftsLaborCost / buildStaffAdoptionSummary', () => {
  const shifts = [
    {
      id: 's1',
      date: '2026-10-02',
      employee_id: 'e1',
      staff: '西村',
      planned_start: '23:00',
      planned_end: '06:00',
      start: '23:00',
      end: '06:00',
    },
    {
      id: 's2',
      date: '2026-10-02',
      employee_id: 'e2',
      staff: 'たかし',
      planned_start: '20:00',
      planned_end: '06:00',
      start: '20:00',
      end: '06:00',
    },
    {
      id: 's3',
      date: '2026-10-03',
      employee_id: 'e1',
      staff: '西村',
      planned_start: '23:00',
      planned_end: '06:00',
      start: '23:00',
      end: '06:00',
    },
    { date: '2026-10-01', status: '定休日' },
  ]

  const requestRows = [
    {
      employee_id: 'e1',
      employee_name: '西村',
      license_type: LICENSE_TYPE2,
      payload: {
        days: {
          '2026-10-02': { available: true },
          '2026-10-03': { available: true },
          '2026-10-04': { available: true },
        },
      },
    },
    {
      employee_id: 'e2',
      employee_name: 'たかし',
      license_type: LICENSE_TYPE1,
      payload: {
        days: {
          '2026-10-02': { available: true },
          '2026-10-05': { available: true },
        },
      },
    },
  ]

  it('予定時間×時給で人件費を出す（定休日は除外）', () => {
    // 西村 7h * 2日 * 1500 + たかし 10h * 1200
    expect(computeShiftsLaborCost(shifts, employees)).toBe(7 * 2 * 1500 + 10 * 1200)
  })

  it('希望日数と採用日数をスタッフ別に返す', () => {
    const rows = buildStaffAdoptionSummary({ requestRows, shifts, employees })
    expect(rows).toEqual([
      {
        employeeId: 'e1',
        name: '西村',
        licenseType: LICENSE_TYPE2,
        requestedDays: 3,
        adoptedDays: 2,
        hours: 14,
        laborCost: 21000,
      },
      {
        employeeId: 'e2',
        name: 'たかし',
        licenseType: LICENSE_TYPE1,
        requestedDays: 2,
        adoptedDays: 1,
        hours: 10,
        laborCost: 12000,
      },
    ])
  })
})
