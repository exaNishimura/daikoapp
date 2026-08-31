const STORAGE_KEY = 'travelTimeFavorites:v1'

function isTownId(value) {
  return typeof value === 'string' && value.includes(':')
}

/**
 * @param {string} city
 * @param {string} name
 */
export function townIdFromParts(city, name) {
  return `${city}:${name}`
}

/**
 * @param {string} id
 * @returns {{ city: string, name: string }|null}
 */
export function parseTownId(id) {
  if (!isTownId(id)) return null
  const idx = id.indexOf(':')
  return { city: id.slice(0, idx), name: id.slice(idx + 1) }
}

/**
 * @returns {string[]}
 */
export function loadFavoriteTownIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.ids)) return []
    return parsed.ids.filter(isTownId)
  } catch {
    return []
  }
}

/**
 * @param {Iterable<string>} ids
 */
export function saveFavoriteTownIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...ids].filter(isTownId) }))
  } catch {
    // private mode / quota
  }
}

export function clearFavoriteTownIds() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // private mode / quota
  }
}

/**
 * @param {Iterable<string>} ids
 * @param {string} id
 * @param {boolean} isFavorite
 * @returns {string[]}
 */
export function setFavoriteTownId(ids, id, isFavorite) {
  const next = new Set(ids)
  if (isFavorite) next.add(id)
  else next.delete(id)
  return [...next]
}
