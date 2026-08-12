/**
 * Edge 用 Google Maps Directions（Vite proxy 非依存）
 */

/**
 * @param {{ origin: string, destination: string, apiKey: string, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<{ duration: number|null, error: string|null }>}
 */
export async function fetchDirectionsDurationMinutes(opts) {
  const fetchImpl = opts.fetchImpl || fetch
  if (!opts.apiKey) return { duration: null, error: 'API key not configured' }
  if (!opts.origin || !opts.destination) {
    return { duration: null, error: 'Address is missing' }
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', opts.origin)
  url.searchParams.set('destination', opts.destination)
  url.searchParams.set('language', 'ja')
  url.searchParams.set('key', opts.apiKey)

  try {
    const res = await fetchImpl(url.toString())
    if (!res.ok) {
      return { duration: null, error: `HTTP ${res.status}` }
    }
    const data = await res.json()
    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.length) {
      return { duration: null, error: data.status || 'No route found' }
    }
    let seconds = 0
    for (const leg of data.routes[0].legs) {
      seconds += leg.duration?.value || 0
    }
    // 片道×2（待機場所なしフォールバック）— SPA routeService と整合
    const oneWay = Math.round(seconds / 60)
    return { duration: oneWay * 2, error: null }
  } catch (e) {
    return { duration: null, error: e?.message || 'fetch failed' }
  }
}
