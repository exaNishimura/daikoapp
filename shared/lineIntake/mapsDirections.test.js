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
})
