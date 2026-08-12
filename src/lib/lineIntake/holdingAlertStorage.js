const STORAGE_VERSION = 'v1'
export const HOLDING_SEEN_STORAGE_KEY = `lineHoldingSeenIds:${STORAGE_VERSION}`

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseSeenHoldingIds(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id) => typeof id === 'string' && id)
  } catch {
    return []
  }
}

export function loadSeenHoldingIds() {
  try {
    return new Set(parseSeenHoldingIds(sessionStorage.getItem(HOLDING_SEEN_STORAGE_KEY)))
  } catch {
    return new Set()
  }
}

/**
 * @param {Iterable<string>} ids
 */
export function saveSeenHoldingIds(ids) {
  try {
    sessionStorage.setItem(HOLDING_SEEN_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // private mode / quota
  }
}

/**
 * @param {Array<{ id?: string }>} units
 * @param {Set<string>} seen
 */
export function findUnseenHoldingUnits(units, seen) {
  return (units ?? []).filter((unit) => unit?.id && !seen.has(unit.id))
}
