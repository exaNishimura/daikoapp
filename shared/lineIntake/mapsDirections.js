/**
 * Edge 用 Google Maps Directions（Vite proxy 非依存）
 * SPA `routeService.estimateDuration` と同じ往復規則:
 *   片道 +（待機場所があれば 目的地→待機場所、なければ片道×2）
 */

function minutesFromRoute(data) {
  if (data?.status !== 'OK' || !data.routes?.[0]?.legs?.length) return null
  let seconds = 0
  for (const leg of data.routes[0].legs) {
    seconds += leg.duration?.value || 0
  }
  return Math.round(seconds / 60)
}

async function fetchLegMinutes(fetchImpl, origin, destination, apiKey) {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  url.searchParams.set('language', 'ja')
  url.searchParams.set('key', apiKey)
  const res = await fetchImpl(url.toString())
  if (!res.ok) return { minutes: null, error: `HTTP ${res.status}` }
  const data = await res.json()
  const minutes = minutesFromRoute(data)
  if (minutes == null) return { minutes: null, error: data.status || 'No route found' }
  return { minutes, error: null }
}

/**
 * @param {{
 *   origin: string,
 *   destination: string,
 *   apiKey: string,
 *   waitingLocationAddress?: string|null,
 *   fetchImpl?: typeof fetch
 * }} opts
 * @returns {Promise<{ duration: number|null, error: string|null }>}
 */
export async function fetchDirectionsDurationMinutes(opts) {
  const fetchImpl = opts.fetchImpl || fetch
  if (!opts.apiKey) return { duration: null, error: 'API key not configured' }
  if (!opts.origin || !opts.destination) {
    return { duration: null, error: 'Address is missing' }
  }

  try {
    const outbound = await fetchLegMinutes(fetchImpl, opts.origin, opts.destination, opts.apiKey)
    if (outbound.minutes == null) return { duration: null, error: outbound.error }

    const waiting =
      typeof opts.waitingLocationAddress === 'string' ? opts.waitingLocationAddress.trim() : ''
    if (waiting) {
      const ret = await fetchLegMinutes(fetchImpl, opts.destination, waiting, opts.apiKey)
      if (ret.minutes != null && ret.minutes > 0) {
        return { duration: outbound.minutes + ret.minutes, error: null }
      }
    }

    return { duration: outbound.minutes * 2, error: null }
  } catch (e) {
    return { duration: null, error: e?.message || 'fetch failed' }
  }
}
