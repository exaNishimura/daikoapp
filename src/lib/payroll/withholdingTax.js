/**
 * 給与所得の源泉徴収税額（令和6年以降・月額表の概算式）
 *
 * 基準額 = 総支給額 − 社会保険料控除額
 */

export const TAX_TABLE_KOU = 'KOU'
export const TAX_TABLE_OTSU = 'OTSU'

/** UI 表示用 */
export const TAX_TABLE_LABELS = {
  [TAX_TABLE_KOU]: '甲欄',
  [TAX_TABLE_OTSU]: '乙欄',
}

/**
 * @param {'KOU'|'OTSU'|'甲欄'|'乙欄'} value
 * @returns {'KOU'|'OTSU'}
 */
export function normalizeTaxTableType(value) {
  if (value === TAX_TABLE_KOU || value === '甲欄') return TAX_TABLE_KOU
  return TAX_TABLE_OTSU
}

/**
 * @param {unknown} n
 * @returns {number}
 */
function toNonNegInt(n) {
  const v = Math.floor(Number(n) || 0)
  return v > 0 ? v : 0
}

/**
 * 社会保険料控除後の給与等の金額（基準額）
 * @param {number} grossPay 総支給額
 * @param {number} socialInsurance 社会保険料控除額
 */
export function calcTaxableBase(grossPay, socialInsurance = 0) {
  return Math.max(0, toNonNegInt(grossPay) - toNonNegInt(socialInsurance))
}

/**
 * 甲欄（扶養0人基準）の税額
 * @param {number} taxableBase
 */
function calcKouTaxBeforeDependents(taxableBase) {
  if (taxableBase < 88000) return 0
  if (taxableBase < 130000) {
    return Math.floor((taxableBase - 88000) * 0.05105) + 2240
  }
  if (taxableBase < 250000) {
    return Math.floor((taxableBase - 130000) * 0.1021) + 4390
  }
  // 仕様外の高額帯は 250000 未満の式を延長（概算）
  return Math.floor((taxableBase - 130000) * 0.1021) + 4390
}

/**
 * 源泉徴収税額を算出
 * @param {object} params
 * @param {number} params.grossPay 総支給額
 * @param {number} [params.socialInsurance=0] 社会保険料控除額
 * @param {'KOU'|'OTSU'|'甲欄'|'乙欄'} [params.taxTableType='OTSU']
 * @param {number} [params.dependentsCount=0] 扶養親族等の数（甲欄のみ）
 * @returns {number} 円未満切り捨て後の税額
 */
export function calcWithholdingTax({
  grossPay,
  socialInsurance = 0,
  taxTableType = TAX_TABLE_OTSU,
  dependentsCount = 0,
} = {}) {
  const base = calcTaxableBase(grossPay, socialInsurance)
  const table = normalizeTaxTableType(taxTableType)

  if (table === TAX_TABLE_OTSU) {
    if (base < 88000) {
      return Math.floor(base * 0.03063)
    }
    return Math.floor(base * 0.18378)
  }

  // 甲欄
  let tax = calcKouTaxBeforeDependents(base)
  const deps = Math.min(5, Math.max(0, Math.floor(Number(dependentsCount) || 0)))
  if (deps > 0) {
    tax -= deps * 1610
  }
  return Math.max(0, tax)
}

/**
 * 差引支給額（手取り）= 基準額 − 源泉徴収税額 − その他控除
 * @param {object} params
 */
export function calcNetPay({
  grossPay,
  socialInsurance = 0,
  withholdingTax,
  otherDeduction = 0,
  taxTableType = TAX_TABLE_OTSU,
  dependentsCount = 0,
} = {}) {
  const taxableBase = calcTaxableBase(grossPay, socialInsurance)
  const tax =
    withholdingTax != null
      ? toNonNegInt(withholdingTax)
      : calcWithholdingTax({
          grossPay,
          socialInsurance,
          taxTableType,
          dependentsCount,
        })
  const other = toNonNegInt(otherDeduction)
  return Math.max(0, taxableBase - tax - other)
}

/**
 * 基準額・源泉・差引をまとめて返す
 */
export function summarizeWithholding(params = {}) {
  const grossPay = toNonNegInt(params.grossPay)
  const socialInsurance = toNonNegInt(params.socialInsurance)
  const otherDeduction = toNonNegInt(params.otherDeduction)
  const taxTableType = normalizeTaxTableType(params.taxTableType ?? TAX_TABLE_OTSU)
  const dependentsCount = Math.min(5, Math.max(0, Math.floor(Number(params.dependentsCount) || 0)))

  const taxableBase = calcTaxableBase(grossPay, socialInsurance)
  const withholdingTax =
    params.withholdingTax != null
      ? toNonNegInt(params.withholdingTax)
      : calcWithholdingTax({
          grossPay,
          socialInsurance,
          taxTableType,
          dependentsCount,
        })
  const netPay = Math.max(0, taxableBase - withholdingTax - otherDeduction)

  return {
    grossPay,
    socialInsurance,
    otherDeduction,
    taxTableType,
    dependentsCount,
    taxableBase,
    withholdingTax,
    netPay,
  }
}

/**
 * 金額表示（例: ￥200,000）
 * @param {number} amount
 */
export function formatYen(amount) {
  return `￥${Number(amount || 0).toLocaleString()}`
}
