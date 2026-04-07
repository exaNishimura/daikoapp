/**
 * 従業員マスタとシフト画面のスタッフ名・色の共通ロジック
 */

export const FALLBACK_STAFF_NAMES = [
  '西村',
  '鈴木',
  'チョロモン',
  'たかし',
  'なみ',
  'しゅうや',
]

const FALLBACK_COLOR_BY_NAME = Object.freeze({
  西村: '#FFA500',
  鈴木: '#FFD700',
  チョロモン: '#8A2BE2',
  たかし: '#00BFFF',
  なみ: '#FF69B4',
  しゅうや: '#32CD32',
})

/**
 * アクティブ従業員名（sort_order → 名前順）。0件時はフォールバック。
 * @param {Array<{ name: string, is_active?: boolean, sort_order?: number }>} employees
 */
export function getActiveStaffNamesOrdered(employees) {
  if (!employees?.length) return [...FALLBACK_STAFF_NAMES]
  const active = employees
    .filter((e) => e && e.name && e.is_active !== false)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.name).localeCompare(String(b.name), 'ja')
    )
  const names = active.map((e) => e.name)
  return names.length ? names : [...FALLBACK_STAFF_NAMES]
}

/**
 * プルダウン用: アクティブ順 + 既存シフトにのみ登場する名前（非アクティブの過去データ用）
 * @param {string[]} orderedActiveNames
 * @param {string[]} shiftStaffNames
 */
export function mergeStaffNamesForSelect(orderedActiveNames, shiftStaffNames) {
  const set = new Set(orderedActiveNames)
  const extra = [...new Set(shiftStaffNames.filter(Boolean))].filter((n) => !set.has(n))
  extra.sort((a, b) => a.localeCompare(b, 'ja'))
  return [...orderedActiveNames, ...extra]
}

/**
 * 氏名 → 表示色（従業員の color を優先し、なければフォールバック）
 * @param {Array<{ name?: string, color?: string }>} employees
 */
export function buildStaffColorByName(employees) {
  const map = { ...FALLBACK_COLOR_BY_NAME }
  ;(employees || []).forEach((e) => {
    if (e?.name && e.color) map[e.name] = e.color
  })
  return map
}
