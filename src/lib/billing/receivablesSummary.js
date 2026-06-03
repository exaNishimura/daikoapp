/**
 * 売掛行の集計ヘルパ (純関数)。
 * UI のサマリ表示用。total / count / 企業別集計を返す。
 */

/**
 * @typedef CompanySummary
 * @property {number|string} companyId
 * @property {string} companyName
 * @property {number} count
 * @property {number} total
 */

/**
 * @param {Array} rows  accounts_receivable の行（companies が join 済みの想定）
 * @returns {{ count: number, totalAmount: number, byCompany: CompanySummary[] }}
 */
export function summarizeReceivables(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0, totalAmount: 0, byCompany: [] }
  }

  let total = 0
  const map = new Map()
  for (const row of rows) {
    const amt = Number(row?.amount) || 0
    total += amt
    const key = row?.company_id ?? '__none__'
    const existing = map.get(key) ?? {
      companyId: key,
      companyName: row?.companies?.name ?? '(取引先未設定)',
      count: 0,
      total: 0,
    }
    existing.count += 1
    existing.total += amt
    map.set(key, existing)
  }

  return {
    count: rows.length,
    totalAmount: total,
    byCompany: Array.from(map.values()).sort((a, b) => b.total - a.total),
  }
}
