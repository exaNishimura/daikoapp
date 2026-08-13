import { toBillingMonthFromWorkDate } from '@/lib/billing/receivableForm'

export const SHIFT_RECEIVABLE_SOURCE = 'shift-calendar'

export const EMPTY_RECEIVABLE_LINE = Object.freeze({ company_id: null, amount: '', note: '' })

function parseAmount(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

/** シフト表モーダルで編集対象の売掛行（シフト由来・号車一致・未請求） */
export function isShiftEditableReceivable(row, carNum = null) {
  if (row?.source_file !== SHIFT_RECEIVABLE_SOURCE) return false
  if (row?.invoice_id != null) return false
  if (carNum == null) return true
  return row.vehicle_num != null && String(row.vehicle_num) === String(carNum)
}

/** @deprecated isShiftEditableReceivable を使用 */
export const isShiftDraftReceivable = isShiftEditableReceivable

/** 集計表示用: 号車別売掛（シフト表・売掛一覧のいずれも vehicle_num で紐付け） */
export function filterReceivablesByVehicle(rows = [], carNum) {
  if (carNum == null) return rows
  const car = String(carNum)
  return (rows ?? []).filter((row) => row.vehicle_num != null && String(row.vehicle_num) === car)
}

/**
 * DB行 → モーダル用フォーム行
 */
export function toShiftReceivableFormLines(rows = [], carNum = null) {
  const drafts = rows.filter((row) => isShiftEditableReceivable(row, carNum))
  if (drafts.length === 0) {
    return [{ ...EMPTY_RECEIVABLE_LINE }]
  }
  return drafts.map((row) => ({
    id: row.id,
    company_id: row.company_id ?? null,
    amount: row.amount != null ? String(row.amount) : '',
    note: row.note ?? '',
  }))
}

/**
 * フォーム行 → INSERT 用ペイロード
 */
export function buildShiftReceivableInsertPayloads(workDate, lines = [], carNum = null) {
  const billingMonth = toBillingMonthFromWorkDate(workDate)
  if (!billingMonth) return []

  const vehicleNum = carNum != null ? Number(carNum) : null

  return lines
    .map((line) => ({
      work_date: workDate,
      billing_month: billingMonth,
      company_id: line.company_id ?? null,
      departure: null,
      destination: null,
      amount: parseAmount(line.amount),
      note: line.note?.trim() || null,
      source_file: SHIFT_RECEIVABLE_SOURCE,
      vehicle_num: vehicleNum,
    }))
    .filter((row) => row.amount > 0)
}

export function sumReceivableAmounts(rows = []) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}

export function sumReceivableFormAmounts(lines = []) {
  return lines.reduce((sum, line) => sum + parseAmount(line.amount), 0)
}

/**
 * 日付別売掛サマリ { total, count }
 */
export function summarizeReceivablesByDate(rows = []) {
  const map = new Map()
  for (const row of rows) {
    const date = row.work_date
    if (!date) continue
    const prev = map.get(date) ?? { total: 0, count: 0 }
    map.set(date, {
      total: prev.total + (Number(row.amount) || 0),
      count: prev.count + 1,
    })
  }
  return map
}
