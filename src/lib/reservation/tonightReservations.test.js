import { afterEach, describe, expect, it } from 'vitest'
import {
  addJstCalendarDays,
  filterReservationsInReceptionNight,
  getTonightListFilters,
  markTonightDialogDismissed,
  tonightDismissStorageKey,
  wasTonightDialogDismissed,
} from './tonightReservations.js'

describe('addJstCalendarDays / getTonightListFilters', () => {
  it('adds days across month boundary', () => {
    expect(addJstCalendarDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('covers work date and next calendar day', () => {
    expect(getTonightListFilters('2026-08-12')).toEqual({
      dateFrom: '2026-08-12',
      dateTo: '2026-08-13',
    })
  })
})

describe('filterReservationsInReceptionNight', () => {
  const rows = [
    { id: 'a', reserved_at: '2026-08-12T09:59:00.000Z' }, // 18:59 JST
    { id: 'b', reserved_at: '2026-08-12T10:00:00.000Z' }, // 19:00 JST
    { id: 'c', reserved_at: '2026-08-12T20:00:00.000Z' }, // 05:00 JST 13
    { id: 'd', reserved_at: '2026-08-12T20:59:59.999Z' }, // 05:59 JST 13
    { id: 'e', reserved_at: '2026-08-12T21:00:00.000Z' }, // 06:00 JST 13
  ]

  it('keeps [19:00, 翌06:00) only, sorted', () => {
    expect(filterReservationsInReceptionNight(rows, '2026-08-12').map((r) => r.id)).toEqual([
      'b',
      'c',
      'd',
    ])
  })

  it('includes next-month early morning on month boundary', () => {
    const sepEarly = { id: 'sep', reserved_at: '2026-08-31T18:30:00.000Z' } // 9/1 03:30 JST
    expect(filterReservationsInReceptionNight([sepEarly], '2026-08-31').map((r) => r.id)).toEqual([
      'sep',
    ])
  })

  it('returns empty when none in window', () => {
    expect(filterReservationsInReceptionNight(rows, '2026-08-11')).toEqual([])
  })
})

describe('tonight dismiss storage', () => {
  afterEach(() => {
    localStorage.removeItem(tonightDismissStorageKey('2026-08-12'))
  })

  it('uses versioned key and round-trips dismiss', () => {
    expect(tonightDismissStorageKey('2026-08-12')).toBe(
      'reservationTonightDismissed:v1:2026-08-12'
    )
    expect(wasTonightDialogDismissed('2026-08-12')).toBe(false)
    markTonightDialogDismissed('2026-08-12')
    expect(wasTonightDialogDismissed('2026-08-12')).toBe(true)
  })
})
