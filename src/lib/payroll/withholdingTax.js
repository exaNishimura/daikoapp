/**
 * 給与所得の源泉徴収税額（令和8年分）
 *
 * 甲欄: 財務省告示による電算機計算の特例
 *   https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/denshi_01.pdf
 * 乙欄: 国税庁「月額表の乙欄を適用する給与等に対する税額の電算機計算」
 *   https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/denshi_02.pdf
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

const OTSU_PCT_THRESHOLD = 105000
const OTSU_TABLE_MAX = 740000
const OTSU_TOP_THRESHOLD = 1710000
const DEPENDENT_MONTHLY = 31667
const OTSU_DEPENDENT_CREDIT = 1610

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

function toDependentsCount(n) {
  return Math.max(0, Math.floor(Number(n) || 0))
}

function floorYen(n) {
  if (n <= 0) return 0
  return Math.floor(n + 1e-9)
}

/** 1円未満切り上げ（給与所得控除） */
function ceilYen(n) {
  if (n <= 0) return 0
  const f = Math.floor(n + 1e-9)
  return n - f > 1e-9 ? f + 1 : f
}

/** 10円未満四捨五入（甲欄） */
function roundTo10(n) {
  if (n <= 0) return 0
  return Math.round(n / 10) * 10
}

/** 50円未満切捨て、50円以上100円未満は100円に切上げ（乙欄） */
function roundTo100(n) {
  if (n <= 0) return 0
  const rem = n % 100
  if (rem < 50) return n - rem
  return n - rem + 100
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
 * 第1表 給与所得控除
 * @param {number} amount 社会保険料等控除後（乙欄は 2.5倍 / 1.5倍した額）
 */
function salaryIncomeDeduction(amount) {
  if (amount <= 158333) return 54167
  if (amount <= 299999) return ceilYen(amount * 0.3 + 6667)
  if (amount <= 549999) return ceilYen(amount * 0.2 + 36667)
  if (amount <= 708330) return ceilYen(amount * 0.1 + 91667)
  return 162500
}

/**
 * 基礎控除（甲欄第3表 / 乙欄第2表）
 * @param {number} amount
 */
function basicDeduction(amount) {
  if (amount <= 2120833) return 48334
  if (amount <= 2162499) return 40000
  if (amount <= 2204166) return 26667
  if (amount <= 2245833) return 13334
  return 0
}

/**
 * 甲欄 第4表（復興特別所得税込み）
 * @param {number} taxableIncome
 */
function kouTaxFormula(taxableIncome) {
  const b = taxableIncome
  if (b <= 0) return 0
  if (b <= 162500) return b * 0.05105
  if (b <= 275000) return b * 0.1021 - 8296
  if (b <= 579166) return b * 0.2042 - 36374
  if (b <= 750000) return b * 0.23483 - 54113
  if (b <= 1500000) return b * 0.33693 - 130688
  if (b <= 3333333) return b * 0.4084 - 237893
  return b * 0.45945 - 408061
}

/**
 * 乙欄 第3表（復興特別所得税を含まない。後で ×1.021）
 * @param {number} taxableIncome
 */
function otsuTaxFormula(taxableIncome) {
  const b = taxableIncome
  if (b <= 0) return 0
  if (b <= 162500) return b * 0.05
  if (b <= 275000) return b * 0.1 - 8125
  if (b <= 579166) return b * 0.2 - 35625
  if (b <= 750000) return b * 0.23 - 53000
  if (b <= 1500000) return b * 0.33 - 128000
  return b * 0.4 - 233000
}

function otsuSubTax(scaledAmount) {
  const taxable =
    scaledAmount - salaryIncomeDeduction(scaledAmount) - basicDeduction(scaledAmount)
  return floorYen(otsuTaxFormula(taxable))
}

/**
 * 乙欄の計算基準額 = 月額表「以上」欄（階差の下限）
 * @param {number} amount
 */
function otsuCalculationBase(amount) {
  if (amount === OTSU_TABLE_MAX) return OTSU_TABLE_MAX
  if (amount <= 220999) {
    return amount - ((amount - OTSU_PCT_THRESHOLD) % 2000)
  }
  return amount - ((amount - 221000) % 3000)
}

function calcOtsuMidTax(amount) {
  const base = otsuCalculationBase(amount)
  const taxA = otsuSubTax(base * 2.5)
  const taxB = otsuSubTax(base * 1.5)
  const c = roundTo100(taxA - taxB)
  return roundTo100(c * 1.021)
}

function applyOtsuDependentCredit(tax, dependentsCount) {
  if (dependentsCount <= 0) return tax
  return Math.max(0, tax - dependentsCount * OTSU_DEPENDENT_CREDIT)
}

function calcOtsuTax(amount, dependentsCount) {
  if (amount < OTSU_PCT_THRESHOLD) {
    return applyOtsuDependentCredit(floorYen(amount * 0.03063), dependentsCount)
  }
  if (amount <= OTSU_TABLE_MAX) {
    return applyOtsuDependentCredit(calcOtsuMidTax(amount), dependentsCount)
  }
  if (amount < OTSU_TOP_THRESHOLD) {
    const tax = floorYen(259200 + (amount - OTSU_TABLE_MAX) * 0.4084)
    return applyOtsuDependentCredit(tax, dependentsCount)
  }
  if (amount === OTSU_TOP_THRESHOLD) {
    return applyOtsuDependentCredit(655400, dependentsCount)
  }
  const tax = floorYen(655400 + (amount - OTSU_TOP_THRESHOLD) * 0.45945)
  return applyOtsuDependentCredit(tax, dependentsCount)
}

function calcKouTax(amount, dependentsCount) {
  const taxableIncome =
    amount -
    salaryIncomeDeduction(amount) -
    DEPENDENT_MONTHLY * dependentsCount -
    basicDeduction(amount)
  if (taxableIncome <= 0) return 0
  return roundTo10(kouTaxFormula(taxableIncome))
}

/**
 * 源泉徴収税額を算出
 * @param {object} params
 * @param {number} params.grossPay 総支給額
 * @param {number} [params.socialInsurance=0] 社会保険料控除額
 * @param {'KOU'|'OTSU'|'甲欄'|'乙欄'} [params.taxTableType='OTSU']
 * @param {number} [params.dependentsCount=0] 扶養親族等の数（甲欄。乙欄は従たる給与の扶養控除等がある場合のみ）
 * @returns {number} 円
 */
export function calcWithholdingTax({
  grossPay,
  socialInsurance = 0,
  taxTableType = TAX_TABLE_OTSU,
  dependentsCount = 0,
} = {}) {
  const base = calcTaxableBase(grossPay, socialInsurance)
  const table = normalizeTaxTableType(taxTableType)
  const deps = toDependentsCount(dependentsCount)

  if (table === TAX_TABLE_OTSU) {
    return calcOtsuTax(base, deps)
  }
  return calcKouTax(base, deps)
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
  const dependentsCount = toDependentsCount(params.dependentsCount)

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
