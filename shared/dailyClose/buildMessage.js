/**
 * 日次締め LINE 通知文面生成（Edge Function / テスト共用・@/ 非依存）
 */

const VEHICLE_FIELD_KEYS = {
  1: {
    distance_km: 'vehicle1_distance_km',
    fuel_yen: 'vehicle1_fuel_yen',
    sales: 'vehicle1_sales',
    expense_note: 'vehicle1_expense_note',
    expense_amount: 'vehicle1_expense_amount',
  },
  2: {
    distance_km: 'vehicle2_distance_km',
    fuel_yen: 'vehicle2_fuel_yen',
    sales: 'vehicle2_sales',
    expense_note: 'vehicle2_expense_note',
    expense_amount: 'vehicle2_expense_amount',
  },
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function getVehicleFieldKeys(carNum) {
  return VEHICLE_FIELD_KEYS[String(carNum)] ?? null
}

function calcShiftWorkHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = String(start).split(':').map(Number)
  const [eh, em] = String(end).split(':').map(Number)
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) {
    return 0
  }
  const startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  return (endMinutes - startMinutes) / 60
}

function normalizeStaffName(name) {
  if (typeof name !== 'string') return ''
  return name.normalize('NFKC').trim()
}

function getStaffDisplayName(shift, employees) {
  if (shift?.staff) return normalizeStaffName(shift.staff)
  const emp = (employees ?? []).find((e) => e?.id === shift?.employee_id)
  return emp?.name ? normalizeStaffName(emp.name) : ''
}

function filterShiftsByCar(shifts, carNum) {
  const car = String(carNum)
  return (shifts ?? []).filter((s) => String(s.car) === car)
}

function computeStaffHoursByCar(shifts, employees, carNum) {
  const map = new Map()
  for (const shift of filterShiftsByCar(shifts, carNum)) {
    const name = getStaffDisplayName(shift, employees)
    if (!name) continue
    const hours = calcShiftWorkHours(shift.start, shift.end)
    map.set(name, (map.get(name) ?? 0) + hours)
  }
  return map
}

function formatStaffHoursLabels(shifts, employees, carNum) {
  const map = computeStaffHoursByCar(shifts, employees, carNum)
  return [...map.entries()]
    .filter(([, hours]) => hours > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([name, hours]) => {
      const rounded = Math.round(hours * 100) / 100
      const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
      return `${name}　${text}h`
    })
}

function filterReceivablesByVehicle(receivables, carNum) {
  const car = String(carNum)
  return (receivables ?? []).filter((r) => String(r.vehicle_num ?? '') === car)
}

function sumReceivableAmounts(rows) {
  return (rows ?? []).reduce((sum, row) => sum + n(row.amount), 0)
}

function computeCashForVehicle(row, carNum, receivableTotal = 0) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields || row == null) return 0
  const cash =
    n(row[fields.sales]) -
    n(row[fields.fuel_yen]) -
    n(row[fields.expense_amount]) -
    n(receivableTotal)
  return Math.max(0, Math.trunc(cash))
}

function formatYen(value) {
  if (value == null || value === '') return '—'
  return `¥${Number(value).toLocaleString('ja-JP')}`
}

function formatWorkDateLabel(workDate, dow) {
  if (!workDate) return ''
  const [y, m, d] = workDate.split('-').map(Number)
  const dowLabel = dow ? `(${dow})` : ''
  return `${m}/${d}${dowLabel}`
}

function getOperatingCars(shifts) {
  const cars = new Set()
  for (const shift of shifts ?? []) {
    if (shift?.car) cars.add(String(shift.car))
  }
  return [...cars].sort((a, b) => Number(a) - Number(b))
}

function hasVehicleSalesInput(salesRow, carNum) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields) return false
  const sales = salesRow?.[fields.sales]
  return sales != null && sales !== '' && n(sales) > 0
}

function getCompanyName(row, companyLookup) {
  if (row.company?.name) return row.company.name
  if (row.company_id && companyLookup?.[row.company_id]) {
    return companyLookup[row.company_id]
  }
  return row.note?.trim() || '（請求先未設定）'
}

function formatBreakdownLine(label, total, items) {
  const validItems = (items ?? []).filter((item) => item?.label || n(item?.amount) > 0)
  if (validItems.length === 0) {
    return `${label} ${formatYen(total)}`
  }
  const breakdown = validItems
    .map((item) => `${item.label} ${formatYen(item.amount)}`)
    .join('、')
  return `${label} ${formatYen(total)}（${breakdown}）`
}

function buildVehicleSection({ carNum, salesRow, shifts, employees, receivables, companyLookup }) {
  const carReceivables = filterReceivablesByVehicle(receivables, carNum)
  const fields = getVehicleFieldKeys(carNum)
  const hasInput = hasVehicleSalesInput(salesRow, carNum)
  const lines = [`■ ${carNum}号車`]

  if (!hasInput) {
    lines.push('⚠ 未入力')
    return lines.join('\n')
  }

  const fuel = fields ? salesRow?.[fields.fuel_yen] : null
  const sales = fields ? salesRow?.[fields.sales] : null
  const expenseAmount = fields ? n(salesRow?.[fields.expense_amount]) : 0
  const expenseNote = fields ? String(salesRow?.[fields.expense_note] ?? '').trim() : ''
  const receivableTotal = sumReceivableAmounts(carReceivables)
  const vehicleCash = computeCashForVehicle(salesRow, carNum, receivableTotal)
  const staffLabels = formatStaffHoursLabels(shifts, employees, carNum)
  const receivableItems = carReceivables.map((row) => ({
    label: getCompanyName(row, companyLookup),
    amount: n(row.amount),
  }))

  lines.push(`売上 ${formatYen(sales)} / 燃料 ${formatYen(fuel)}`)
  lines.push(formatBreakdownLine('売掛', receivableTotal, receivableItems))
  if (expenseAmount > 0 || expenseNote) {
    const expenseItems = [
      {
        label: expenseNote || '経費',
        amount: expenseAmount,
      },
    ]
    lines.push(formatBreakdownLine('経費', expenseAmount, expenseItems))
  }
  lines.push(`現金 ${formatYen(vehicleCash)}`)
  if (staffLabels.length > 0) {
    lines.push(`稼働: ${staffLabels.join(' / ')}`)
  } else {
    lines.push('稼働: なし')
  }

  return lines.join('\n')
}

/**
 * @param {object} params
 * @param {string} params.workDate YYYY-MM-DD
 * @param {string} [params.dow]
 * @param {string} [params.dayStatus] 休業|定休日
 * @param {object|null} params.salesRow
 * @param {Array} params.shifts
 * @param {Array} params.employees
 * @param {Array} params.receivables
 * @param {Record<string,string>} [params.companyLookup]
 * @param {string} [params.closedAtLabel] 締め時刻表示
 */
export function buildDailyCloseMessage({
  workDate,
  dow = '',
  dayStatus = '',
  salesRow = null,
  shifts = [],
  employees = [],
  receivables = [],
  companyLookup = {},
  closedAtLabel = '',
}) {
  const dateLabel = formatWorkDateLabel(workDate, dow)
  const lines = [`【${dateLabel} 日次締め報告】`, '']

  const operatingCars = getOperatingCars(shifts)
  if (operatingCars.length === 0) {
    lines.push('⚠ 稼働号車なし')
  } else {
    for (const carNum of operatingCars) {
      lines.push(buildVehicleSection({
        carNum,
        salesRow,
        shifts,
        employees,
        receivables,
        companyLookup,
      }))
      lines.push('')
    }
  }

  if (closedAtLabel) {
    lines.push(`締め時刻: ${closedAtLabel}`)
  }

  return lines.join('\n').trim()
}

export function shouldSkipDailyClose(dayStatus) {
  return dayStatus === '休業' || dayStatus === '定休日'
}

export function getCloseTargetWorkDate(referenceDate = new Date()) {
  const jst = new Date(referenceDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  jst.setDate(jst.getDate() - 1)
  const y = jst.getFullYear()
  const m = String(jst.getMonth() + 1).padStart(2, '0')
  const d = String(jst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatJstDateTime(referenceDate = new Date()) {
  return referenceDate.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
