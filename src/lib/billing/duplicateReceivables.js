/**
 * 売掛重複検出 (純関数)。
 *
 * 一意性キーは Requirement 6.6 で定義された
 *   `(billing_month, company_id, work_date, departure, destination, amount)`
 * の組。これら 6 列が完全一致するインポート行は「既存と重複 (スキップ対象)」とマークする。
 */

function s(v) {
  if (v == null) return ''
  return String(v).trim()
}

function n(v) {
  if (v == null) return 0
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/**
 * 重複判定に使うキー文字列を返す。
 *
 * @param {Object} row
 * @returns {string}
 */
export function receivableKey(row) {
  return [
    s(row?.billing_month),
    n(row?.company_id),
    s(row?.work_date),
    s(row?.departure),
    s(row?.destination),
    n(row?.amount),
  ].join('|')
}

/**
 * 入力 incoming の各行に { ...row, duplicate: boolean } を付与する。
 * - 既存 (existing) と完全一致するもの → duplicate=true
 * - incoming 自身の中で先に出てきたものと完全一致 → 2 件目以降 duplicate=true
 *
 * @template T
 * @param {T[]} incoming
 * @param {Array} existing
 * @returns {Array<T & { duplicate: boolean }>}
 */
export function findDuplicates(incoming, existing = []) {
  if (!Array.isArray(incoming) || incoming.length === 0) return []
  const seen = new Set((Array.isArray(existing) ? existing : []).map(receivableKey))
  const result = []
  for (const row of incoming) {
    const key = receivableKey(row)
    const isDup = seen.has(key)
    if (!isDup) seen.add(key)
    result.push({ ...row, duplicate: isDup })
  }
  return result
}
