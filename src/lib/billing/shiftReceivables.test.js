import { describe, expect, it } from 'vitest'
import {
  buildShiftReceivableInsertPayloads,
  isShiftDraftReceivable,
  summarizeReceivablesByDate,
  toShiftReceivableFormLines,
} from './shiftReceivables'

describe('isShiftDraftReceivable', () => {
  it('シフト由来かつ請求先未選択のみ true', () => {
    expect(
      isShiftDraftReceivable({ source_file: 'shift-calendar', company_id: null })
    ).toBe(true)
    expect(
      isShiftDraftReceivable({ source_file: 'shift-calendar', company_id: 1 })
    ).toBe(false)
  })
})

describe('toShiftReceivableFormLines', () => {
  it('ドラフト行をフォーム用に変換する', () => {
    const lines = toShiftReceivableFormLines([
      { id: 1, source_file: 'shift-calendar', company_id: null, amount: 5000, note: 'A社' },
      { id: 2, source_file: 'manual', company_id: 3, amount: 1000, note: '' },
    ])
    expect(lines).toEqual([{ id: 1, amount: '5000', note: 'A社' }])
  })

  it('ドラフトが無いときは空行1件', () => {
    expect(toShiftReceivableFormLines([])).toEqual([{ amount: '', note: '' }])
  })
})

describe('buildShiftReceivableInsertPayloads', () => {
  it('金額0の行は除外する', () => {
    const rows = buildShiftReceivableInsertPayloads('2026-07-01', [
      { amount: '5000', note: ' テスト ' },
      { amount: '', note: '' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      work_date: '2026-07-01',
      billing_month: '2026-07-01',
      company_id: null,
      amount: 5000,
      note: 'テスト',
      source_file: 'shift-calendar',
    })
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
