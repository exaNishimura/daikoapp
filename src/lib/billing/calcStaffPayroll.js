/**
 * スタッフ別月次人件費の計算 (純関数)。
 *
 * - 時間制 (hourly):   hourly_rate × total_hours
 * - 歩合制 (commission): commission_rate × total_sales
 *
 * @typedef StaffPayroll
 * @property {string} staff_name
 * @property {'hourly'|'commission'|'unknown'} rate_type
 * @property {number|null} hourly_rate
 * @property {number|null} commission_rate
 * @property {number} total_sales
 * @property {number} total_hours
 * @property {number} payroll
 * @property {number} display_order
 */

/**
 * @param {Array} staffSales   daily_staff_sales の行 [{ work_date, staff_name, sales, hours }]
 * @param {Array} staffRates   staff_rates の行 [{ staff_name, rate_type, hourly_rate, commission_rate, display_order }]
 * @returns {StaffPayroll[]}
 */
export function calcStaffPayroll(staffSales, staffRates = []) {
  if (!Array.isArray(staffSales) || staffSales.length === 0) return []

  const ratesByName = new Map()
  for (const r of Array.isArray(staffRates) ? staffRates : []) {
    if (r?.staff_name) ratesByName.set(r.staff_name, r)
  }

  const aggregateByName = new Map()
  for (const row of staffSales) {
    const name = row?.staff_name
    if (!name) continue
    const existing = aggregateByName.get(name) ?? { total_sales: 0, total_hours: 0 }
    existing.total_sales += Number(row.sales) || 0
    existing.total_hours += Number(row.hours) || 0
    aggregateByName.set(name, existing)
  }

  const result = []
  for (const [name, agg] of aggregateByName) {
    const rate = ratesByName.get(name)
    const rate_type = rate?.rate_type ?? 'unknown'
    let payroll = 0
    if (rate_type === 'hourly' && rate.hourly_rate != null) {
      payroll = Math.round(agg.total_hours * Number(rate.hourly_rate))
    } else if (rate_type === 'commission' && rate.commission_rate != null) {
      payroll = Math.round(agg.total_sales * Number(rate.commission_rate))
    }
    result.push({
      staff_name: name,
      rate_type,
      hourly_rate: rate?.hourly_rate ?? null,
      commission_rate: rate?.commission_rate ?? null,
      total_sales: agg.total_sales,
      total_hours: agg.total_hours,
      payroll,
      display_order: rate?.display_order ?? Number.POSITIVE_INFINITY,
    })
  }

  return result.sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order
    return a.staff_name.localeCompare(b.staff_name, 'ja')
  })
}
