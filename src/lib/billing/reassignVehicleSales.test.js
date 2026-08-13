import { describe, expect, it } from 'vitest'
import {
  buildReceivableVehicleNumUpdates,
  buildShiftCarUpdates,
  decideReassignMode,
  getReassignableCarNums,
  hasVehicleData,
  isVehicleSalesFormDirty,
  swapVehicleFields,
} from './reassignVehicleSales'

describe('getReassignableCarNums', () => {
  it('除外号車以外を返す', () => {
    expect(getReassignableCarNums('1')).toEqual(['2'])
    expect(getReassignableCarNums(null)).toEqual(['1', '2'])
  })
})

describe('hasVehicleData', () => {
  it('シフトがあれば true', () => {
    expect(
      hasVehicleData({
        carNum: 1,
        dailyRow: null,
        dayShifts: [{ id: 'a', car: '1' }],
        receivableRows: [],
      })
    ).toBe(true)
  })

  it('売上入力があれば true', () => {
    expect(
      hasVehicleData({
        carNum: 2,
        dailyRow: { vehicle2_sales: 1000 },
        dayShifts: [],
        receivableRows: [],
      })
    ).toBe(true)
  })

  it('未請求売掛があれば true', () => {
    expect(
      hasVehicleData({
        carNum: 1,
        dailyRow: null,
        dayShifts: [],
        receivableRows: [{ id: 1, vehicle_num: 1, invoice_id: null }],
      })
    ).toBe(true)
  })

  it('請求済み売掛だけでは false', () => {
    expect(
      hasVehicleData({
        carNum: 1,
        dailyRow: null,
        dayShifts: [],
        receivableRows: [{ id: 1, vehicle_num: 1, invoice_id: 9 }],
      })
    ).toBe(false)
  })
})

describe('decideReassignMode', () => {
  it('空なら reassign、ありなら swap', () => {
    expect(decideReassignMode({ fromCar: 1, toCar: 2, hasToData: false })).toBe('reassign')
    expect(decideReassignMode({ fromCar: 1, toCar: 2, hasToData: true })).toBe('swap')
  })

  it('同じ号車はエラー', () => {
    expect(() => decideReassignMode({ fromCar: 1, toCar: 1, hasToData: false })).toThrow(/同じ号車/)
  })
})

describe('swapVehicleFields', () => {
  const row = {
    vehicle1_distance_km: 10,
    vehicle1_fuel_yen: 100,
    vehicle1_sales: 1000,
    vehicle1_expense_note: '油',
    vehicle1_expense_amount: 50,
    vehicle2_distance_km: 20,
    vehicle2_fuel_yen: 200,
    vehicle2_sales: 2000,
    vehicle2_expense_note: null,
    vehicle2_expense_amount: 0,
  }

  it('swap で相互交換', () => {
    const next = swapVehicleFields(row, 1, 2, 'swap')
    expect(next.vehicle1_sales).toBe(2000)
    expect(next.vehicle2_sales).toBe(1000)
    expect(next.vehicle1_distance_km).toBe(20)
    expect(next.vehicle2_distance_km).toBe(10)
  })

  it('reassign で移動して元を空に', () => {
    const next = swapVehicleFields(row, 1, 2, 'reassign')
    expect(next.vehicle2_sales).toBe(1000)
    expect(next.vehicle2_distance_km).toBe(10)
    expect(next.vehicle1_sales).toBe(0)
    expect(next.vehicle1_fuel_yen).toBe(0)
    expect(next.vehicle1_distance_km).toBeNull()
    expect(next.vehicle1_expense_note).toBeNull()
  })
})

describe('buildShiftCarUpdates', () => {
  const shifts = [
    { id: 'a', car: '1' },
    { id: 'b', car: '2' },
    { id: 'c', car: '1' },
  ]

  it('reassign', () => {
    expect(buildShiftCarUpdates(shifts, 1, 2, 'reassign')).toEqual([
      { id: 'a', car: '2' },
      { id: 'c', car: '2' },
    ])
  })

  it('swap', () => {
    expect(buildShiftCarUpdates(shifts, 1, 2, 'swap')).toEqual([
      { id: 'a', car: '2' },
      { id: 'b', car: '1' },
      { id: 'c', car: '2' },
    ])
  })
})

describe('buildReceivableVehicleNumUpdates', () => {
  const rows = [
    { id: 1, vehicle_num: 1, invoice_id: null },
    { id: 2, vehicle_num: 2, invoice_id: null },
    { id: 3, vehicle_num: 1, invoice_id: 99 },
  ]

  it('未請求のみ更新（swap）', () => {
    expect(buildReceivableVehicleNumUpdates(rows, 1, 2, 'swap')).toEqual([
      { id: 1, vehicle_num: 2 },
      { id: 2, vehicle_num: 1 },
    ])
  })

  it('未請求のみ更新（reassign）', () => {
    expect(buildReceivableVehicleNumUpdates(rows, 1, 2, 'reassign')).toEqual([
      { id: 1, vehicle_num: 2 },
    ])
  })
})

describe('isVehicleSalesFormDirty', () => {
  const base = {
    distance_km: '1',
    fuel_yen: '0',
    sales: '100',
    expense_note: '',
    expense_amount: '',
    shiftTimes: [{ shiftId: 'a', start: '19:00', end: '02:00' }],
    receivables: [{ company_id: null, amount: '', note: '' }],
  }

  it('同一なら false', () => {
    expect(
      isVehicleSalesFormDirty(base, {
        ...base,
        shiftTimes: [...base.shiftTimes],
        receivables: [...base.receivables],
      })
    ).toBe(false)
  })

  it('売上変更で true', () => {
    expect(isVehicleSalesFormDirty({ ...base, sales: '200' }, base)).toBe(true)
  })
})
