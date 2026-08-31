export const DISTANCE_MATRIX_BATCH_SIZE = 25

/**
 * @param {{ lat: number, lng: number } | string} origin
 */
export function encodeDistanceMatrixOrigin(origin) {
  if (typeof origin === 'string') return origin.trim()
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    return `${origin.lat},${origin.lng}`
  }
  return ''
}

/**
 * Distance Matrix の1バッチ分を町IDつき結果へ変換する。
 *
 * @param {object} data - Google Distance Matrix JSON
 * @param {string[]} destinationIds
 * @returns {{ error: string|null, items: Array<{ id: string, minutes: number|null, distanceKm: number|null, status: string }> }}
 */
export function parseDistanceMatrixResponse(data, destinationIds) {
  if (!data || data.status !== 'OK') {
    const status = data?.status || 'UNKNOWN_ERROR'
    const message = data?.error_message ? `${status}: ${data.error_message}` : status
    return { error: message, items: [] }
  }

  const elements = data.rows?.[0]?.elements ?? []
  const items = destinationIds.map((id, index) => {
    const element = elements[index]
    if (!element || element.status !== 'OK') {
      return {
        id,
        minutes: null,
        distanceKm: null,
        status: element?.status ?? 'UNKNOWN',
      }
    }
    const seconds = element.duration_in_traffic?.value ?? element.duration?.value ?? null
    const meters = element.distance?.value ?? 0
    return {
      id,
      minutes: seconds == null ? null : Math.round(seconds / 60),
      distanceKm: Math.round((meters / 1000) * 10) / 10,
      status: 'OK',
    }
  })

  return { error: null, items }
}
