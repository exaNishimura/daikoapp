/**
 * 自社情報 (company_profile) フォームのスキーマ / 正規化 / バリデーション。
 * シングルトン (id=1) なので、フォーム単位の純関数だけで充分。
 */

export const BANK_ACCOUNT_TYPES = ['普通', '当座', '貯蓄']

export const COMPANY_PROFILE_FIELDS = [
  'name',
  'postal_code',
  'address',
  'invoice_number',
  'bank',
  'bank_branch',
  'bank_account_type',
  'bank_account_number',
  'bank_account_holder',
]

const FIELD_LABELS = {
  name: '屋号 / 社名',
  postal_code: '郵便番号',
  address: '住所',
  invoice_number: 'インボイス番号',
  bank: '銀行名',
  bank_branch: '支店名',
  bank_account_type: '口座種別',
  bank_account_number: '口座番号',
  bank_account_holder: '口座名義',
}

export const EMPTY_COMPANY_PROFILE = COMPANY_PROFILE_FIELDS.reduce(
  (acc, key) => ({ ...acc, [key]: key === 'bank_account_type' ? '普通' : '' }),
  {}
)

const POSTAL_RE_NORMALIZED = /^\d{3}-\d{4}$/

/**
 * 郵便番号を `123-4567` 形式に正規化する。
 * - 全角数字 → 半角
 * - 全角ハイフン → 半角
 * - trim
 * - 数字 7 桁ならハイフン挿入、それ以外は trim 結果をそのまま返す
 */
export function normalizePostalCode(s) {
  if (s == null) return ''
  let str = String(s).trim()
  if (str === '') return ''
  str = str
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\u2010-\u2015\uFF0D\u30FC]/g, '-')
  const digitsOnly = str.replace(/-/g, '')
  if (/^\d{7}$/.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`
  }
  return str
}

/**
 * 自社情報フォームをバリデーションする。
 * @param {Object} form
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateCompanyProfileForm(form = {}) {
  const errors = {}

  for (const field of COMPANY_PROFILE_FIELDS) {
    const value = form[field]
    const trimmed = typeof value === 'string' ? value.trim() : value
    if (trimmed == null || trimmed === '') {
      errors[field] = `${FIELD_LABELS[field]}は必須です`
    }
  }

  if (!errors.postal_code) {
    const normalized = normalizePostalCode(form.postal_code)
    if (!POSTAL_RE_NORMALIZED.test(normalized)) {
      errors.postal_code = '郵便番号は 123-4567 形式で入力してください'
    }
  }

  if (!errors.bank_account_type && !BANK_ACCOUNT_TYPES.includes(form.bank_account_type)) {
    errors.bank_account_type = `口座種別は ${BANK_ACCOUNT_TYPES.join('/')} のいずれかを選んでください`
  }

  if (!errors.bank_account_number) {
    const digitsOnly = String(form.bank_account_number).replace(/\s/g, '')
    if (!/^\d+$/.test(digitsOnly)) {
      errors.bank_account_number = '口座番号は数字のみで入力してください'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
