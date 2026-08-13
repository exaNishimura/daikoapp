import { describe, expect, it, vi } from 'vitest'
import { fetchDirectionsDurationMinutes } from './mapsDirections.js'

describe('fetchDirectionsDurationMinutes', () => {
  it('returns round-trip minutes from legs', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        routes: [{ legs: [{ duration: { value: 600 } }] }],
      }),
    }))
    const result = await fetchDirectionsDurationMinutes({
      origin: 'A',
      destination: 'B',
      apiKey: 'k',
      fetchImpl,
    })
    expect(result.duration).toBe(20) // 10min * 2
    expect(result.error).toBeNull()
  })

  it('adds destination→waiting location instead of doubling when waiting is set', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const dest = new URL(url).searchParams.get('destination')
      const seconds = dest === '待機所' ? 480 : 600
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          routes: [{ legs: [{ duration: { value: seconds } }] }],
        }),
      }
    })
    const result = await fetchDirectionsDurationMinutes({
      origin: 'A',
      destination: 'B',
      waitingLocationAddress: '待機所',
      apiKey: 'k',
      fetchImpl,
    })
    expect(result.duration).toBe(18) // 10 + 8
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
