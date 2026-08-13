/**
 * 未入金請求書の集計 (純関数)。
 *
 * 滞留日数 = floor((today - issue_date) / 1day)
 */

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(input) {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(`${input}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 請求日から today までの経過日数。
 * 未来日付や不正入力は 0 / null。
 *
 * @param {string|Date|null} issueDate
 * @param {Date} [today=new Date()]
 * @returns {number|null}
 */
export function daysOverdue(issueDate, today = new Date()) {
  const issued = parseDate(issueDate)
  if (!issued) return null
  // 月文字列 '2026-13-01' のような壊れた値も検知
  if (typeof issueDate === 'string') {
    const m = issueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const mm = Number(m[2])
      const dd = Number(m[3])
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    }
  }
  const diff = today.getTime() - issued.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / DAY_MS)
}

/**
 * 滞留日数 > 60 日か。
 */
export function isOverdue60(issueDate, today = new Date()) {
  const d = daysOverdue(issueDate, today)
  return typeof d === 'number' && d > 60
}

/**
 * 未入金請求書のサマリ。
 *
 * @param {Array} invoices  invoices 行 (companies 関連付き)。paid_at が null のもののみ集計対象。
 * @param {Date} [today=new Date()]
 */
export function summarizeUnpaidInvoices(invoices, today = new Date()) {
  const empty = {
    total_unpaid: 0,
    invoice_count: 0,
    average_days_overdue: 0,
    over_60_count: 0,
    by_company: [],
  }
  if (!Array.isArray(invoices) || invoices.length === 0) return empty

  const unpaid = invoices.filter((inv) => !inv.paid_at)
  if (unpaid.length === 0) return empty

  const byCompany = new Map()
  let totalUnpaid = 0
  let daysSum = 0
  let over60 = 0

  for (const inv of unpaid) {
    const amount = Number(inv.total_amount) || 0
    totalUnpaid += amount
    const days = daysOverdue(inv.issue_date, today) ?? 0
    daysSum += days
    if (days > 60) over60 += 1

    const key = inv.company_id
    const existing = byCompany.get(key) ?? {
      company_id: key,
      company_name: inv.companies?.name ?? '',
      invoice_display_name: inv.companies?.invoice_display_name ?? null,
      invoice_count: 0,
      total_unpaid: 0,
      max_days_overdue: 0,
    }
    existing.invoice_count += 1
    existing.total_unpaid += amount
    existing.max_days_overdue = Math.max(existing.max_days_overdue, days)
    byCompany.set(key, existing)
  }

  return {
    total_unpaid: totalUnpaid,
    invoice_count: unpaid.length,
    average_days_overdue: Math.round(daysSum / unpaid.length),
    over_60_count: over60,
    by_company: Array.from(byCompany.values()).sort((a, b) => b.total_unpaid - a.total_unpaid),
  }
}
