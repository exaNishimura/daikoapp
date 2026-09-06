import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import dayjs from 'dayjs'
import { DateInput } from '@astryxdesign/core/DateInput'
import { MonthPicker } from './MonthPicker'
import {
  toMonthString,
  fromMonthString,
  monthRange,
  dateInputMonthBounds,
  dayjsToMonthString,
} from './monthUtils'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('MonthPicker (smoke)', () => {
  it('renders the given value formatted as YYYY年MM月', () => {
    renderWithTheme(<MonthPicker value="2026-05" onChange={() => {}} label="対象月" />)
    expect(screen.getByText('対象月')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026年05月')).toBeInTheDocument()
  })

  it('renders an empty picker when value is null', () => {
    renderWithTheme(<MonthPicker value={null} onChange={() => {}} label="対象月" />)
    expect(screen.queryByDisplayValue(/2026/)).not.toBeInTheDocument()
  })
})

describe('toMonthString', () => {
  it('converts {year, month} to YYYY-MM', () => {
    expect(toMonthString({ year: 2026, month: 5 })).toBe('2026-05')
    expect(toMonthString({ year: 2026, month: 12 })).toBe('2026-12')
  })

  it('zero-pads single digit month', () => {
    expect(toMonthString({ year: 2026, month: 1 })).toBe('2026-01')
  })

  it('returns null for null/invalid input', () => {
    expect(toMonthString(null)).toBeNull()
    expect(toMonthString({ year: 2026 })).toBeNull()
    expect(toMonthString({ year: 2026, month: 0 })).toBeNull()
    expect(toMonthString({ year: 2026, month: 13 })).toBeNull()
  })

  it('accepts Date object', () => {
    expect(toMonthString(new Date(2026, 4, 15))).toBe('2026-05')
  })
})

describe('fromMonthString', () => {
  it('parses YYYY-MM into {year, month}', () => {
    expect(fromMonthString('2026-05')).toEqual({ year: 2026, month: 5 })
    expect(fromMonthString('2026-12')).toEqual({ year: 2026, month: 12 })
  })

  it('returns null for invalid input', () => {
    expect(fromMonthString(null)).toBeNull()
    expect(fromMonthString('')).toBeNull()
    expect(fromMonthString('2026')).toBeNull()
    expect(fromMonthString('2026-13')).toBeNull()
    expect(fromMonthString('not-a-date')).toBeNull()
  })
})

describe('monthRange', () => {
  it('returns first and last day of the month (YYYY-MM-DD strings)', () => {
    expect(monthRange('2026-05')).toEqual({
      firstDay: '2026-05-01',
      lastDay: '2026-05-31',
    })
  })

  it('handles february leap year correctly', () => {
    expect(monthRange('2024-02')).toEqual({
      firstDay: '2024-02-01',
      lastDay: '2024-02-29',
    })
    expect(monthRange('2025-02')).toEqual({
      firstDay: '2025-02-01',
      lastDay: '2025-02-28',
    })
  })

  it('returns null for invalid month', () => {
    expect(monthRange(null)).toBeNull()
    expect(monthRange('bogus')).toBeNull()
  })
})

describe('dateInputMonthBounds', () => {
  it('uses the real last day so DateInput does not receive 9/31', () => {
    expect(dateInputMonthBounds(2026, 9)).toEqual({
      min: '2026-09-01',
      max: '2026-09-30',
    })
  })

  it('keeps 31-day months as-is', () => {
    expect(dateInputMonthBounds(2026, 5)).toEqual({
      min: '2026-05-01',
      max: '2026-05-31',
    })
  })

  it('avoids DateInput throwing on 9/31', () => {
    expect(() =>
      renderWithTheme(
        <DateInput label="日付" value="2026-09-06" min="2026-09-01" max="2026-09-31" />
      )
    ).toThrow(/day must be/)

    expect(() =>
      renderWithTheme(
        <DateInput
          label="日付"
          value="2026-09-06"
          min={dateInputMonthBounds(2026, 9).min}
          max={dateInputMonthBounds(2026, 9).max}
        />
      )
    ).not.toThrow()
  })
})

describe('dayjsToMonthString', () => {
  it('formats a valid dayjs to YYYY-MM', () => {
    expect(dayjsToMonthString(dayjs('2026-05-15'))).toBe('2026-05')
    expect(dayjsToMonthString(dayjs('2026-12-01'))).toBe('2026-12')
  })

  it('returns null for null/undefined', () => {
    expect(dayjsToMonthString(null)).toBeNull()
    expect(dayjsToMonthString(undefined)).toBeNull()
  })

  it('returns null for invalid dayjs', () => {
    expect(dayjsToMonthString(dayjs('not-a-date'))).toBeNull()
  })

  it('returns null for non-dayjs-like input', () => {
    expect(dayjsToMonthString({})).toBeNull()
    expect(dayjsToMonthString('2026-05')).toBeNull()
  })
})
