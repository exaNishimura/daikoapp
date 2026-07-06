/**
 * 従業員マスタとシフト画面のスタッフ名・色の共通ロジック
 */

export const FALLBACK_STAFF_NAMES = ['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや']

const FALLBACK_COLOR_BY_NAME = Object.freeze({
  西村: '#FFA500',
  鈴木: '#FFD700',
  チョロモン: '#8A2BE2',
  たかし: '#00BFFF',
  なみ: '#FF69B4',
  しゅうや: '#32CD32',
})

/** 従業員マスタの色選択肢 + 追加スタッフ用パレット */
const STAFF_COLOR_PALETTE = [
  '#FFA500',
  '#FFD700',
  '#8A2BE2',
  '#00BFFF',
  '#FF69B4',
  '#32CD32',
  '#FF0000',
  '#0000FF',
  '#A52A2A',
  '#808080',
]

function normalizeStaffName(name) {
  if (typeof name !== 'string') return ''
  return name.normalize('NFKC').trim()
}

function normalizeColor(color) {
  if (typeof color !== 'string') return ''
  return color.normalize('NFKC').trim()
}

function pickUnusedColor(usedColors, seedName) {
  const unused = STAFF_COLOR_PALETTE.find((color) => !usedColors.has(color))
  if (unused) return unused

  let hash = 0
  for (let i = 0; i < seedName.length; i++) {
    hash = seedName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 42%)`
}

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
  const names = active.map((e) => normalizeStaffName(e.name)).filter(Boolean)
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

function findEmployeeByName(employees, staffName) {
  const name = normalizeStaffName(staffName)
  if (!name) return null
  return (employees || []).find((e) => normalizeStaffName(e?.name) === name) ?? null
}

/** スタッフ名で従業員マスタを検索 */
export function findEmployeeByStaffName(employees, staffName) {
  return findEmployeeByName(employees, staffName)
}

export function findEmployeeById(employees, employeeId) {
  if (!employeeId) return null
  return (employees || []).find((e) => e?.id === employeeId) ?? null
}

/**
 * シフト行から従業員を解決（employee_id 優先、なければ staff 名で後方互換）
 */
export function resolveShiftEmployee(shift, employees) {
  if (!shift) return null
  const byId = findEmployeeById(employees, shift.employee_id)
  if (byId) return byId
  return findEmployeeByName(employees, shift.staff)
}

export function getStaffDisplayName(shift, employees) {
  return resolveShiftEmployee(shift, employees)?.name ?? normalizeStaffName(shift?.staff) ?? ''
}

export function getStaffColorForShift(shift, employees, colorByName) {
  const emp = resolveShiftEmployee(shift, employees)
  const fromMaster = normalizeColor(emp?.color)
  if (fromMaster) return fromMaster
  return getStaffColor(colorByName, shift?.staff, employees)
}

/**
 * シフト保存用: employee_id と表示用 staff 名をセットで返す
 */
export function toShiftStaffFields(employeeId, employees) {
  const emp = findEmployeeById(employees, employeeId)
  return {
    employee_id: employeeId || null,
    staff: emp?.name ? normalizeStaffName(emp.name) : null,
  }
}

/**
 * アクティブ従業員（sort_order → 名前順）
 */
export function getActiveEmployeesOrdered(employees) {
  if (!employees?.length) return []
  return employees
    .filter((e) => e && e.name && e.is_active !== false)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.name).localeCompare(String(b.name), 'ja')
    )
}

/**
 * フィルター・プルダウン用: アクティブ + シフトにのみ存在する従業員
 */
export function getEmployeeSelectOptions(employees, shifts) {
  const map = new Map()
  for (const emp of getActiveEmployeesOrdered(employees)) {
    map.set(emp.id, emp)
  }
  for (const shift of shifts || []) {
    if (shift?.status) continue
    const emp = resolveShiftEmployee(shift, employees)
    if (emp?.id && !map.has(emp.id)) {
      map.set(emp.id, emp)
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.name).localeCompare(String(b.name), 'ja')
  )
}

/**
 * 氏名 → 表示色（従業員の color を優先し、なければパレットから自動割当）
 * @param {Array<{ name?: string, color?: string }>} employees
 * @param {string[]} [extraNames] - シフトにのみ存在するスタッフ名
 */
export function buildStaffColorByName(employees, extraNames = []) {
  const map = { ...FALLBACK_COLOR_BY_NAME }
  const usedColors = new Set(Object.values(map))

  const assignColor = (rawName) => {
    const name = normalizeStaffName(rawName)
    if (!name || map[name]) return

    const masterColor = normalizeColor(findEmployeeByName(employees, name)?.color)
    if (masterColor) {
      map[name] = masterColor
      usedColors.add(masterColor)
      return
    }

    const color = pickUnusedColor(usedColors, name)
    map[name] = color
    usedColors.add(color)
  }

  ;(employees || []).forEach((e) => {
    const name = normalizeStaffName(e?.name)
    if (!name) return

    const color = normalizeColor(e.color)
    if (color) {
      map[name] = color
      usedColors.add(color)
      return
    }

    assignColor(name)
  })

  extraNames.forEach((name) => assignColor(name))

  return map
}

/**
 * スタッフ名から表示色を取得（従業員マスタの color を最優先）
 * @param {Record<string, string>} colorByName
 * @param {string | undefined | null} staffName
 * @param {Array<{ name?: string, color?: string }>} [employees]
 */
export function getStaffColor(colorByName, staffName, employees) {
  const name = normalizeStaffName(staffName)
  if (!name) return '#bdbdbd'

  const fromMaster = normalizeColor(findEmployeeByName(employees, name)?.color)
  if (fromMaster) return fromMaster

  const fromMap = colorByName?.[name]
  if (fromMap) return fromMap

  return '#bdbdbd'
}
