import { describe, expect, it, vi, beforeEach } from 'vitest'
import { hasRouteChanged, normalizeWaypoints, saveOrderEdit } from './orderActions'

function createSupabaseMock(slots = []) {
  const eqSelect = vi.fn().mockResolvedValue({ data: slots, error: null })
  const eqUpdate = vi.fn().mockResolvedValue({ data: null, error: null })
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: eqSelect })),
      update: vi.fn(() => ({ eq: eqUpdate })),
    })),
    _eqUpdate: eqUpdate,
  }
}

const BASE_ORDER = {
  id: 'order-1',
  pickup_address: '三重県鈴鹿市A',
  dropoff_address: '三重県鈴鹿市B',
  waypoints: null,
  base_duration_min: 30,
  buffer_min: 0,
}

const BASE_FORM = {
  pickup_location: '',
  pickup_address: '三重県鈴鹿市A',
  dropoff_address: '三重県鈴鹿市B',
  waypoints: [],
  contact_phone: '',
  car_model: '',
  car_plate: '',
  car_color: '',
  parking_note: '',
  base_duration_min: 30,
  buffer_min: 0,
}

describe('normalizeWaypoints', () => {
  it('trims and drops empty entries', () => {
    expect(normalizeWaypoints(['  津市  ', '', '  '])).toEqual(['津市'])
  })

  it('returns [] for null/undefined', () => {
    expect(normalizeWaypoints(null)).toEqual([])
    expect(normalizeWaypoints(undefined)).toEqual([])
  })
})

describe('hasRouteChanged', () => {
  it('false when addresses and waypoints are unchanged', () => {
    expect(hasRouteChanged(BASE_ORDER, BASE_FORM)).toBe(false)
  })

  it('true when pickup changes', () => {
    expect(hasRouteChanged(BASE_ORDER, { ...BASE_FORM, pickup_address: '三重県四日市市C' })).toBe(
      true
    )
  })

  it('true when dropoff changes', () => {
    expect(hasRouteChanged(BASE_ORDER, { ...BASE_FORM, dropoff_address: '三重県四日市市C' })).toBe(
      true
    )
  })

  it('true when a waypoint is added', () => {
    expect(hasRouteChanged(BASE_ORDER, { ...BASE_FORM, waypoints: ['三重県津市D'] })).toBe(true)
  })

  it('true when a waypoint is removed', () => {
    expect(
      hasRouteChanged(
        { ...BASE_ORDER, waypoints: ['三重県津市D'] },
        { ...BASE_FORM, waypoints: [] }
      )
    ).toBe(true)
  })

  it('ignores empty waypoint slots', () => {
    expect(hasRouteChanged(BASE_ORDER, { ...BASE_FORM, waypoints: ['', '  '] })).toBe(false)
  })
})

describe('saveOrderEdit', () => {
  let estimateDuration
  let calculateBuffer
  let updateOrder
  let getVehicles

  beforeEach(() => {
    estimateDuration = vi.fn()
    calculateBuffer = vi.fn(() => 0)
    updateOrder = vi.fn(async (_id, updates) => ({
      data: { ...BASE_ORDER, ...updates },
      error: null,
    }))
    getVehicles = vi.fn().mockResolvedValue({ data: [] })
  })

  function deps(supabase = createSupabaseMock()) {
    return {
      supabase,
      updateOrder,
      estimateDuration,
      calculateBuffer,
      getVehicles,
    }
  }

  it('does not recalculate when route is unchanged', async () => {
    const result = await saveOrderEdit({
      order: BASE_ORDER,
      formData: { ...BASE_FORM, contact_phone: '090-0000-0000' },
      deps: deps(),
    })

    expect(estimateDuration).not.toHaveBeenCalled()
    expect(result.routeRecalculated).toBe(false)
    expect(updateOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        contact_phone: '090-0000-0000',
        base_duration_min: 30,
        buffer_manual: true,
      })
    )
  })

  it('recalculates duration when pickup changes', async () => {
    estimateDuration.mockResolvedValue({ duration: 48, error: null })

    const result = await saveOrderEdit({
      order: BASE_ORDER,
      formData: { ...BASE_FORM, pickup_address: '三重県四日市市C' },
      deps: deps(),
    })

    expect(estimateDuration).toHaveBeenCalledWith('三重県四日市市C', '三重県鈴鹿市B', null, null)
    expect(result.routeRecalculated).toBe(true)
    expect(result.order.base_duration_min).toBe(48)
    expect(result.order.buffer_manual).toBe(false)
  })

  it('recalculates duration when a waypoint is added', async () => {
    estimateDuration.mockResolvedValue({ duration: 62, error: null })

    const result = await saveOrderEdit({
      order: BASE_ORDER,
      formData: { ...BASE_FORM, waypoints: ['三重県津市D'] },
      deps: deps(),
    })

    expect(estimateDuration).toHaveBeenCalledWith(
      '三重県鈴鹿市A',
      '三重県鈴鹿市B',
      ['三重県津市D'],
      null
    )
    expect(result.routeRecalculated).toBe(true)
    expect(result.order.base_duration_min).toBe(62)
    expect(result.order.waypoints).toEqual(['三重県津市D'])
  })

  it('recalculates duration when a waypoint is removed', async () => {
    estimateDuration.mockResolvedValue({ duration: 40, error: null })

    const result = await saveOrderEdit({
      order: { ...BASE_ORDER, waypoints: ['三重県津市D'], base_duration_min: 62 },
      formData: { ...BASE_FORM, waypoints: [], base_duration_min: 62 },
      deps: deps(),
    })

    expect(estimateDuration).toHaveBeenCalledWith('三重県鈴鹿市A', '三重県鈴鹿市B', null, null)
    expect(result.routeRecalculated).toBe(true)
    expect(result.order.base_duration_min).toBe(40)
    expect(result.order.waypoints).toBeNull()
  })

  it('keeps previous duration and reports error when recalc fails', async () => {
    estimateDuration.mockResolvedValue({ duration: null, error: 'ZERO_RESULTS' })

    const result = await saveOrderEdit({
      order: BASE_ORDER,
      formData: { ...BASE_FORM, dropoff_address: '存在しない住所' },
      deps: deps(),
    })

    expect(result.routeRecalculated).toBe(false)
    expect(result.routeRecalcError).toBe('ZERO_RESULTS')
    expect(updateOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        dropoff_address: '存在しない住所',
        base_duration_min: 30,
        buffer_manual: true,
      })
    )
  })

  it('updates TENTATIVE slot end_at with recalculated duration', async () => {
    estimateDuration.mockResolvedValue({ duration: 50, error: null })
    const supabase = createSupabaseMock([
      {
        id: 'slot-1',
        status: 'TENTATIVE',
        start_at: '2026-08-13T10:00:00.000Z',
      },
    ])

    await saveOrderEdit({
      order: BASE_ORDER,
      formData: { ...BASE_FORM, pickup_address: '三重県四日市市C' },
      deps: deps(supabase),
    })

    expect(supabase._eqUpdate).toHaveBeenCalled()
    const updateCall = supabase.from.mock.results[1]?.value?.update
    expect(updateCall).toHaveBeenCalledWith({
      end_at: new Date('2026-08-13T10:50:00.000Z').toISOString(),
    })
  })
})
