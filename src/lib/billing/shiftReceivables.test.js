import { describe, expect, it } from 'vitest'
import {
  buildShiftReceivableInsertPayloads,
  filterReceivablesByVehicle,
  isShiftDraftReceivable,
  isShiftEditableReceivable,
  summarizeReceivablesByDate,
  toShiftReceivableFormLines,
} from './shiftReceivables'

describe('isShiftEditableReceivable', () => {
  it('シフト由来・未請求・号車一致の行のみ true', () => {
    expect(
      isShiftEditableReceivable(
        { source_file: 'shift-calendar', company_id: 1, vehicle_num: 1, invoice_id: null },
        '1'
      )
    ).toBe(true)
    expect(
      isShiftEditableReceivable(
        { source_file: 'shift-calendar', company_id: null, vehicle_num: 1, invoice_id: null },
        '1'
      )
    ).toBe(true)
    expect(
      isShiftEditableReceivable(
        { source_file: 'shift-calendar', company_id: 1, vehicle_num: 1, invoice_id: 99 },
        '1'
      )
    ).toBe(false)
    expect(
      isShiftEditableReceivable({ source_file: 'manual', company_id: 1, vehicle_num: 1 }, '1')
    ).toBe(false)
  })

  it('号車不一致は false', () => {
    expect(
      isShiftEditableReceivable(
        { source_file: 'shift-calendar', company_id: null, vehicle_num: 2, invoice_id: null },
        '1'
      )
    ).toBe(false)
  })
})

describe('isShiftDraftReceivable', () => {
  it('isShiftEditableReceivable のエイリアス', () => {
    const row = { source_file: 'shift-calendar', company_id: 1, vehicle_num: 1, invoice_id: null }
    expect(isShiftDraftReceivable(row, '1')).toBe(isShiftEditableReceivable(row, '1'))
  })
})

describe('toShiftReceivableFormLines', () => {
  it('ドラフト行をフォーム用に変換する', () => {
    const lines = toShiftReceivableFormLines(
      [
        {
          id: 1,
          source_file: 'shift-calendar',
          company_id: 3,
          vehicle_num: 1,
          amount: 5000,
          note: 'A社',
          invoice_id: null,
        },
        { id: 2, source_file: 'manual', company_id: 3, amount: 1000, note: '' },
        {
          id: 3,
          source_file: 'shift-calendar',
          company_id: null,
          vehicle_num: 2,
          amount: 3000,
          note: '',
          invoice_id: null,
        },
      ],
      '1'
    )
    expect(lines).toEqual([{ id: 1, company_id: 3, amount: '5000', note: 'A社' }])
  })

  it('ドラフトが無いときは空行1件', () => {
    expect(toShiftReceivableFormLines([])).toEqual([{ company_id: null, amount: '', note: '' }])
  })
})

describe('buildShiftReceivableInsertPayloads', () => {
  it('金額0の行は除外する', () => {
    const rows = buildShiftReceivableInsertPayloads(
      '2026-07-01',
      [
        { company_id: 3, amount: '5000', note: ' テスト ' },
        { amount: '', note: '' },
      ],
      '1'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      work_date: '2026-07-01',
      billing_month: '2026-07-01',
      company_id: 3,
      amount: 5000,
      note: 'テスト',
      source_file: 'shift-calendar',
      vehicle_num: 1,
    })
  })

  it('同請求先・同金額の複数行を許可する', () => {
    const rows = buildShiftReceivableInsertPayloads(
      '2026-07-01',
      [
        { company_id: 3, amount: '5000', note: '' },
        { company_id: 3, amount: '5000', note: '' },
      ],
      '1'
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.amount)).toEqual([5000, 5000])
  })
})

describe('filterReceivablesByVehicle', () => {
  it('号車別に売掛を絞り込む', () => {
    const rows = [
      { id: 1, source_file: 'shift-calendar', vehicle_num: 1, amount: 5000 },
      { id: 2, source_file: 'shift-calendar', vehicle_num: 2, amount: 3000 },
      { id: 3, source_file: null, vehicle_num: 1, amount: 1000 },
      { id: 4, source_file: 'manual', vehicle_num: null, amount: 2000 },
    ]
    expect(filterReceivablesByVehicle(rows, '1')).toEqual([rows[0], rows[2]])
  })
})

describe('summarizeReceivablesByDate', () => {
  it('日付別に件数と合計を集計する', () => {
    const map = summarizeReceivablesByDate([
      { work_date: '2026-07-01', amount: 3000 },
      { work_date: '2026-07-01', amount: 2000 },
      { work_date: '2026-07-02', amount: 1000 },
    ])
    expect(map.get('2026-07-01')).toEqual({ total: 5000, count: 2 })
    expect(map.get('2026-07-02')).toEqual({ total: 1000, count: 1 })
  })
})
