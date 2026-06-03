/**
 * Excel インポート時の企業名マッチング (純関数)。
 *
 * 売掛シートの企業名は `companies.name` または `companies.aliases` に一致するかを
 * 以下の優先度でマッチングする:
 *
 *   1. name 完全一致
 *   2. alias 完全一致
 *   3. invoice_display_name 完全一致
 *
 * いずれも一致しない場合は部分一致候補リストを返し、UI 側で
 * 「新規追加 / 既存統合 / スキップ」を選択させる。
 *
 * @typedef {Object} Company
 * @property {number} id
 * @property {string} name
 * @property {string|null} [invoice_display_name]
 * @property {string[]} [aliases]
 * @property {boolean} [is_active]
 *
 * @typedef {Object} MatchResult
 * @property {boolean} matched
 * @property {'name'|'alias'|'invoice_display_name'} [kind]
 * @property {Company} [company]        matched=true のとき
 * @property {Company[]} [candidates]   matched=false のとき (部分一致候補)
 */

function normalize(s) {
  if (s == null) return ''
  return String(s).trim()
}

/**
 * 1 企業名を既存企業群と照合する。
 *
 * @param {string|null|undefined} input
 * @param {Company[]} companies
 * @param {{ activeOnly?: boolean }} [options]  candidates の絞り込みで is_active=true のみにするか
 * @returns {MatchResult|null}
 */
export function matchCompany(input, companies, options = {}) {
  const key = normalize(input)
  if (!key) return null
  if (!Array.isArray(companies)) return { matched: false, candidates: [] }

  // 1. name 完全一致
  for (const c of companies) {
    if (normalize(c.name) === key) {
      return { matched: true, kind: 'name', company: c }
    }
  }
  // 2. alias 完全一致
  for (const c of companies) {
    if (Array.isArray(c.aliases) && c.aliases.some((a) => normalize(a) === key)) {
      return { matched: true, kind: 'alias', company: c }
    }
  }
  // 3. invoice_display_name 完全一致
  for (const c of companies) {
    if (c.invoice_display_name && normalize(c.invoice_display_name) === key) {
      return { matched: true, kind: 'invoice_display_name', company: c }
    }
  }
  // 4. 部分一致候補
  return {
    matched: false,
    candidates: findCandidateCompanies(key, companies, options),
  }
}

/**
 * 部分一致候補リスト (name または alias に substring を含むもの)。
 * 短い名前 (=入力に近い) が前に来るようソート。
 *
 * @param {string|null|undefined} input
 * @param {Company[]} companies
 * @param {{ activeOnly?: boolean, limit?: number }} [options]
 * @returns {Company[]}
 */
export function findCandidateCompanies(input, companies, options = {}) {
  const key = normalize(input)
  if (!key) return []
  if (!Array.isArray(companies)) return []
  const { activeOnly = false, limit = 10 } = options

  const result = []
  for (const c of companies) {
    if (activeOnly && c.is_active === false) continue
    const name = normalize(c.name)
    const aliases = Array.isArray(c.aliases) ? c.aliases.map(normalize) : []
    const display = normalize(c.invoice_display_name)
    if (
      name.includes(key) ||
      display.includes(key) ||
      aliases.some((a) => a.includes(key))
    ) {
      result.push(c)
    }
  }
  return result
    .sort((a, b) => normalize(a.name).length - normalize(b.name).length)
    .slice(0, limit)
}

/**
 * 自動マッチ結果と UI 決定 (decisions) をマージして
 * `{ [companyName]: companyId }` のマップを返す。
 * - 自動マッチ済みは matchCompany 結果から
 * - 未マッチは decisions に `{ companyId }` がセットされていれば採用
 * - 'skip' / 'new' / undefined はマップに含めない (= 取り込み対象外)
 *
 * @param {{ companyNames: string[], companies: Company[], decisions: Object }} args
 * @returns {Record<string, number>}
 */
export function resolveCompanyMap({ companyNames, companies, decisions = {} }) {
  const map = {}
  for (const name of companyNames ?? []) {
    const m = matchCompany(name, companies ?? [])
    if (m?.matched) {
      map[name] = m.company.id
      continue
    }
    const d = decisions[name]
    if (d && typeof d === 'object' && d.companyId) {
      map[name] = d.companyId
    }
  }
  return map
}
