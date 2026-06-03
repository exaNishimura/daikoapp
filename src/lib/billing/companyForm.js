/**
 * 取引先マスタフォーム用の純関数群。
 * - alias の正規化（半角化 + trim）
 * - フォーム全体のバリデーション（重複名チェック含む）
 */

/**
 * 単一の alias 文字列を正規化する。
 * - null/undefined/'' → '' を返す
 * - 全角 ASCII (Ａ-Ｚ, ０-９ 等) → 半角
 * - 全角空白 (U+3000) → 半角空白
 * - 前後空白 trim
 *
 * @param {string|null|undefined} s
 * @returns {string}
 */
export function normalizeAlias(s) {
  if (s == null) return ''
  const str = String(s)
  if (str === '') return ''
  const halfwidth = str
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
  return halfwidth.trim()
}

/**
 * alias 配列を正規化し、空文字と重複を除去する（最初に出現したものを残す）。
 *
 * @param {Array<string>|null|undefined} arr
 * @returns {string[]}
 */
export function normalizeAliases(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  const out = []
  for (const raw of arr) {
    const v = normalizeAlias(raw)
    if (v === '') continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/**
 * 取引先フォームをバリデーションする。
 *
 * @param {Object} form
 * @param {string} form.name
 * @param {string} [form.invoice_display_name]
 * @param {string[]} [form.aliases]
 * @param {number|string} [form.display_order]
 * @param {boolean} [form.is_active]
 * @param {string} [form.memo]
 * @param {Array<{id:number, name:string}>} existingCompanies  既存の取引先一覧（重複チェック用）
 * @param {number|null} editingId  編集中の company.id（新規なら null）
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateCompanyForm(form, existingCompanies = [], editingId = null) {
  const errors = {}
  const nameTrimmed = String(form?.name ?? '').trim()

  if (nameTrimmed === '') {
    errors.name = '取引先名は必須です'
  } else {
    const dup = existingCompanies.find(
      (c) => c.id !== editingId && String(c.name ?? '').trim() === nameTrimmed
    )
    if (dup) {
      errors.name = '取引先名は重複できません'
    }
  }

  if (form?.display_order != null && form.display_order !== '') {
    const n = Number(form.display_order)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      errors.display_order = '並び順は整数で入力してください'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
