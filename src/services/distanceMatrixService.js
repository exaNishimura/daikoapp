import { chunkArray } from '@/lib/areaTowns'
import {
  DISTANCE_MATRIX_BATCH_SIZE,
  encodeDistanceMatrixOrigin,
  parseDistanceMatrixResponse,
} from '@/lib/distanceMatrix'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchDistanceMatrixJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    const errorText = await response.text()
    const error = new Error(`HTTP ${response.status}: ${errorText}`)
    throw error
  }
  return response.json()
}

/**
 * 現在地（または指定地点）から各地への車での所要をバッチ取得する。
 *
 * @param {object} params
 * @param {{ lat: number, lng: number } | string} params.origin
 * @param {Array<{ id: string, address: string }>} params.destinations
 * @param {(update: { items: object[], done: number, total: number }) => void} [params.onBatch]
 * @param {() => boolean} [params.shouldAbort]
 */
export async function fetchDrivingDurations({ origin, destinations, onBatch, shouldAbort }) {
  const originParam = encodeDistanceMatrixOrigin(origin)
  if (!originParam) {
    return { error: 'Address is missing', items: [] }
  }
  if (!destinations.length) {
    return { error: null, items: [] }
  }

  const batches = chunkArray(destinations, DISTANCE_MATRIX_BATCH_SIZE)
  const items = []
  const total = destinations.length

  for (let i = 0; i < batches.length; i++) {
    if (shouldAbort?.()) {
      return { error: null, items, aborted: true }
    }

    const batch = batches[i]
    const destinationParam = batch.map((d) => encodeURIComponent(d.address)).join('|')
    const baseQuery =
      `/api/google-maps/distancematrix/json?origins=${encodeURIComponent(originParam)}` +
      `&destinations=${destinationParam}&mode=driving&language=ja&region=jp`

    try {
      let data = await fetchDistanceMatrixJson(`${baseQuery}&departure_time=now`)
      if (data.status === 'INVALID_REQUEST') {
        data = await fetchDistanceMatrixJson(baseQuery)
      }

      const parsed = parseDistanceMatrixResponse(
        data,
        batch.map((d) => d.id)
      )
      if (parsed.error) {
        return { error: parsed.error, items }
      }

      items.push(...parsed.items)
      await onBatch?.({ items: parsed.items, done: items.length, total })
    } catch (error) {
      return { error: error.message, items }
    }

    if (i < batches.length - 1) {
      await delay(150)
    }
  }

  return { error: null, items }
}
