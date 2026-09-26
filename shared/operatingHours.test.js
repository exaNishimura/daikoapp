import { describe, expect, it } from 'vitest'
import {
  buildOvernightHours,
  resolveOperatingHours,
  timelineRowCount,
  timelineStartHour,
} from './operatingHours.js'

describe('resolveOperatingHours', () => {
  it('defaults to reservation 19 and business 20', () => {
    expect(resolveOperatingHours(null)).toEqual({
      reservationStartHour: 19,
      businessStartHour: 20,
      businessEndHour: 6,
    })
  })

  it('reads company_profile columns', () => {
    expect(
      resolveOperatingHours({ reservation_start_hour: 18, business_start_hour: 21 })
    ).toMatchObject({
      reservationStartHour: 18,
      businessStartHour: 21,
    })
  })

  it('rejects hours outside 7-23', () => {
    expect(resolveOperatingHours({ reservation_start_hour: 2, business_start_hour: 25 })).toEqual({
      reservationStartHour: 19,
      businessStartHour: 20,
      businessEndHour: 6,
    })
  })
})

describe('timelineStartHour', () => {
  it('uses the earlier of reservation and business start', () => {
    expect(timelineStartHour({ reservationStartHour: 19, businessStartHour: 20 })).toBe(19)
    expect(timelineStartHour({ reservationStartHour: 21, businessStartHour: 20 })).toBe(20)
  })
})

describe('buildOvernightHours', () => {
  it('starts at reservation hour and stops before 06:00', () => {
    expect(buildOvernightHours(19)).toEqual([19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5])
  })

  it('starts at business hour for pickup lists', () => {
    expect(buildOvernightHours(20)[0]).toBe(20)
    expect(buildOvernightHours(20).at(-1)).toBe(5)
  })
})

describe('timelineRowCount', () => {
  it('counts 15-minute rows from 19:00 to 06:00', () => {
    expect(timelineRowCount(19, 6)).toBe(44)
  })
})
