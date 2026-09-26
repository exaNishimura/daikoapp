import { describe, expect, it } from 'vitest'
import { filterOrdersForDispatchNight } from './filterOrdersForDispatchNight'

describe('filterOrdersForDispatchNight', () => {
  const orders = [
    { id: 'now', order_type: 'NOW', status: 'UNASSIGNED' },
    { id: 'today', scheduled_at: new Date(2026, 8, 25, 21, 0, 0, 0).toISOString() },
    { id: 'tomorrow', scheduled_at: new Date(2026, 8, 26, 20, 0, 0, 0).toISOString() },
  ]

  it('keeps every order on the current night', () => {
    expect(filterOrdersForDispatchNight(orders, '2026-09-25', { isCurrentNight: true })).toHaveLength(
      3
    )
  })

  it('keeps only scheduled jobs for a future night', () => {
    const next = filterOrdersForDispatchNight(orders, '2026-09-26', { isCurrentNight: false })
    expect(next.map((row) => row.id)).toEqual(['tomorrow'])
  })
})
