import { describe, expect, it } from 'vitest'
import { filterOrdersForDispatchNight } from './filterOrdersForDispatchNight'

describe('filterOrdersForDispatchNight', () => {
  const orders = [
    { id: 'now', order_type: 'NOW', status: 'UNASSIGNED' },
    { id: 'today', scheduled_at: new Date(2026, 8, 25, 21, 0, 0, 0).toISOString() },
    { id: 'tomorrow', scheduled_at: new Date(2026, 8, 26, 20, 0, 0, 0).toISOString() },
  ]

  it('keeps immediate jobs and same-night schedules on the current night', () => {
    const current = filterOrdersForDispatchNight(orders, '2026-09-25', { isCurrentNight: true })
    expect(current.map((row) => row.id)).toEqual(['now', 'today'])
  })

  it('keeps only scheduled jobs for a future night', () => {
    const next = filterOrdersForDispatchNight(orders, '2026-09-26', { isCurrentNight: false })
    expect(next.map((row) => row.id)).toEqual(['tomorrow'])
  })
})
