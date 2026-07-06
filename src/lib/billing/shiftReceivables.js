import { toBillingMonthFromWorkDate } from '@/lib/billing/receivableForm'

export const SHIFT_RECEIVABLE_SOURCE = 'shift-calendar'

export const EMPTY_RECEIVABLE_LINE = Object.freeze({ amount: '', note: '' })

function parseAmount(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

/** シフト表モーダルで編集対象の売掛行（請求先未選択・シフト由来） */
export function isShiftDraftReceivable(row) {
  return row?.source_file === SHIFT_RECEIVABLE_SOURCE && row?.company_id == null
}

/**
 * DB行 → モーダル用フォーム行
 */
export function toShiftReceivableFormLines(rows = []) {
  const drafts = rows.filter(isShiftDraftReceivable)
  if (drafts.length === 0) {
    return [{ ...EMPTY_RECEIVABLE_LINE }]
  }
  return drafts.map((row) => ({
    id: row.id,
    amount: row.amount != null ? String(row.amount) : '',
    note: row.note ?? '',
  }))
}

/**
 * フォーム行 → INSERT 用ペイロード
 */
export function buildShiftReceivableInsertPayloads(workDate, lines = []) {
  const billingMonth = toBillingMonthFromWorkDate(workDate)
  if (!billingMonth) return []

  return lines
    .map((line) => ({
      work_date: workDate,
      billing_month: billingMonth,
      company_id: null,
      departure: null,
      destination: null,
      amount: parseAmount(line.amount),
      note: line.note?.trim() || null,
      source_file: SHIFT_RECEIVABLE_SOURCE,
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
