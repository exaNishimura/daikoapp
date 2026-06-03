/**
 * 売掛行 (`accounts_receivable`) のステータスを算出する。
 * - paid_at あり → 'paid'
 * - invoice_id あり、paid_at なし → 'billed'
 * - どちらもなし → 'unbilled'
 */
export function receivableStatus({ invoice_id, paid_at } = {}) {
  if (paid_at) return 'paid'
  if (invoice_id != null) return 'billed'
  return 'unbilled'
}

/**
 * 請求書 (`invoices`) のステータスを算出する。
 * - paid_at あり → 'paid'
 * - それ以外 → 'billed'
 */
export function invoiceStatus({ paid_at } = {}) {
  return paid_at ? 'paid' : 'billed'
}
