/**
 * 取引先名 (Excel 売掛シートに書かれた raw 文字列) を
 * `companies` マスタの 1 行に対応付けるマッチャー (純関数)。
 *
 * 戦略 (上から優先):
 *   1. `name` 完全一致
 *   2. `aliases[]` のいずれかに完全一致
 *   3. `name` または `aliases` を正規化した値と、入力を正規化した値が一致
 *      正規化: NFKC 全角→半角化、空白除去、"株式会社" "(株)" 等の接頭辞除去
 *
 * 戻り値:
 *   - { companyId, confidence: 'exact'|'alias'|'normalized', candidates: [matched] }
 *   - 見つからない場合は { companyId: null, candidates: [] }
 *   - 正規化マッチが複数該当した場合は candidates に複数を返し companyId は null
 *     （UI で選択させるため）
 */

/**
 * @typedef {Object} CompanyRow
 * @property {string|number}  id
 * @property {string}         name
 * @property {string[]}       [aliases]
 * @property {string|null}    [invoice_display_name]
 * @property {boolean}        [is_active]
 */

/**
 * @typedef {Object} MatchResult
 * @property {string|number|null}  companyId
 * @property {'exact'|'alias'|'normalized'|null} confidence
 * @property {CompanyRow[]} candidates
 */

/**
 * @param {string} rawName
 * @param {CompanyRow[]} companies
 * @returns {MatchResult}
 */
export function matchCompany(rawName, companies) {
  if (!rawName || !Array.isArray(companies) || companies.length === 0) {
    return { companyId: null, confidence: null, candidates: [] }
  }

  const trimmed = String(rawName).trim()
  if (!trimmed) {
    return { companyId: null, confidence: null, candidates: [] }
  }

  // ===== 1. name 完全一致 =====
  const exact = companies.find((c) => c.name === trimmed)
  if (exact) {
    return { companyId: exact.id, confidence: 'exact', candidates: [exact] }
  }

  // ===== 2. aliases 完全一致 =====
  const aliasHit = companies.find((c) =>
    Array.isArray(c.aliases) && c.aliases.includes(trimmed)
  )
  if (aliasHit) {
    return { companyId: aliasHit.id, confidence: 'alias', candidates: [aliasHit] }
  }

  // ===== 3. 正規化マッチ =====
  const normalizedInput = normalize(trimmed)
  if (!normalizedInput) {
    return { companyId: null, confidence: null, candidates: [] }
  }

  const normalizedHits = companies.filter((c) => {
    if (normalize(c.name) === normalizedInput) return true
    if (Array.isArray(c.aliases)) {
      return c.aliases.some((a) => normalize(a) === normalizedInput)
    }
    return false
  })

  if (normalizedHits.length === 1) {
    return {
      companyId: normalizedHits[0].id,
      confidence: 'normalized',
      candidates: normalizedHits,
    }
  }
  if (normalizedHits.length > 1) {
    // 複数候補があるとき、UI 側で選択させるため companyId は null。
    return { companyId: null, confidence: null, candidates: normalizedHits }
  }

  return { companyId: null, confidence: null, candidates: [] }
}

/**
 * 比較用の正規化:
 *   - NFKC で全角英数 → 半角、全角カタカナ → 半角に統一
 *   - 全空白 (半角/全角) を除去
 *   - 法人格接頭辞を除去
 *   - 大文字小文字無視 (lower)
 *
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  if (!s) return ''
  let r = String(s).normalize('NFKC').toLowerCase()
  r = r.replace(/[\s\u3000]+/g, '')
  // 法人格接頭辞・接尾辞 (正規化後)
  r = r.replace(/^(株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱|㈲)/g, '')
  r = r.replace(/(株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱|㈲)$/g, '')
  return r
}
