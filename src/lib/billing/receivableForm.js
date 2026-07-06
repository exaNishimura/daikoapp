/**
 * 売掛行のフォーム用ヘルパ (純関数)。
 * - フォーム雛形
 * - work_date → billing_month の自動算出
 * - バリデーション (当月内チェック、amount 整数チェック等)
 */

export const EMPTY_RECEIVABLE_FORM = Object.freeze({
  company_id: null,
  work_date: '',
  vehicle_num: '',
  departure: '',
  destination: '',
  amount: null,
  note: '',
})

/** 売掛フォーム用の号車選択肢 */
export const RECEIVABLE_VEHICLE_OPTIONS = Object.freeze([
  { value: '', label: '未指定' },
  { value: '1', label: '1号車' },
  { value: '2', label: '2号車' },
])

export function vehicleNumToFormValue(vehicleNum) {
  if (vehicleNum == null || vehicleNum === '') return ''
  return String(vehicleNum)
}

export function parseVehicleNumForSave(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null
}

export function formatVehicleNumLabel(vehicleNum) {
  if (vehicleNum == null || vehicleNum === '') return '—'
  return `${vehicleNum}号車`
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 'YYYY-MM-DD' な work_date から billing_month ('YYYY-MM-01') を作る。
 * 不正な日付は null。
 */
export function toBillingMonthFromWorkDate(workDate) {
  if (typeof workDate !== 'string') return null
  const m = workDate.match(ISO_DATE_RE)
  if (!m) return null
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return null
  if (d < 1 || d > 31) return null
  return `${m[1]}-${m[2]}-01`
}

function isInTargetMonth(workDate, year, month) {
  const m = workDate.match(ISO_DATE_RE)
  if (!m) return false
  return Number(m[1]) === year && Number(m[2]) === month
}

/**
 * 売掛行のバリデーション。
 *
 * @param {Object} form
 * @param {number|null} form.company_id
 * @param {string} form.work_date          'YYYY-MM-DD'
 * @param {number|null} form.amount
 * @param {Object} [options]
 * @param {number} [options.year]          指定時、work_date がこの年月内であることを要求
 * @param {number} [options.month]
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateReceivableForm(form, options = {}) {
  const errors = {}
  const allowUnsetCompany = options.allowUnsetCompany === true

  if (form?.company_id == null && !allowUnsetCompany) {
    errors.company_id = '取引先は必須です'
  }

  const workDate = form?.work_date
  if (typeof workDate !== 'string' || workDate === '') {
    errors.work_date = '日付は必須です'
  } else if (!ISO_DATE_RE.test(workDate)) {
    errors.work_date = '日付の形式が不正です'
  } else if (
    options.year != null &&
    options.month != null &&
    !isInTargetMonth(workDate, options.year, options.month)
  ) {
    errors.work_date = `日付は当月 (${options.year}年${options.month}月) の範囲で入力してください`
  }

  const amount = form?.amount
  if (amount == null) {
    errors.amount = '金額は必須です'
  } else if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    errors.amount = '金額は数値で入力してください'
  } else if (amount < 0) {
    errors.amount = '金額は 0 円以上で入力してください'
  } else if (!Number.isInteger(amount)) {
    errors.amount = '金額は整数で入力してください'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
