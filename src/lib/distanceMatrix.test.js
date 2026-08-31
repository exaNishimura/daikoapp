import { describe, expect, it } from 'vitest'
import { encodeDistanceMatrixOrigin, parseDistanceMatrixResponse } from './distanceMatrix'

describe('encodeDistanceMatrixOrigin', () => {
  it('encodes latlng and address', () => {
    expect(encodeDistanceMatrixOrigin({ lat: 34.88, lng: 136.58 })).toBe('34.88,136.58')
    expect(encodeDistanceMatrixOrigin(' 三重県鈴鹿市 ')).toBe('三重県鈴鹿市')
    expect(encodeDistanceMatrixOrigin(null)).toBe('')
  })
})

describe('parseDistanceMatrixResponse', () => {
  it('maps OK elements to minutes', () => {
    const parsed = parseDistanceMatrixResponse(
      {
        status: 'OK',
        rows: [
          {
            elements: [
              {
                status: 'OK',
                duration: { value: 610 },
                duration_in_traffic: { value: 720 },
                distance: { value: 4300 },
              },
              { status: 'ZERO_RESULTS' },
            ],
          },
        ],
      },
      ['a', 'b']
    )
    expect(parsed.error).toBeNull()
    expect(parsed.items[0]).toEqual({
      id: 'a',
      minutes: 12,
      distanceKm: 4.3,
      status: 'OK',
    })
    expect(parsed.items[1].status).toBe('ZERO_RESULTS')
    expect(parsed.items[1].minutes).toBeNull()
  })

  it('returns API status as error', () => {
    const parsed = parseDistanceMatrixResponse(
      { status: 'REQUEST_DENIED', error_message: 'nope' },
      ['a']
    )
    expect(parsed.error).toBe('REQUEST_DENIED: nope')
    expect(parsed.items).toEqual([])
  })
})
