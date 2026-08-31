import { describe, expect, it } from 'vitest'
import { formatRouteCalculationError } from './routeErrors'

describe('formatRouteCalculationError', () => {
  it('returns generic message for falsy', () => {
    expect(formatRouteCalculationError(null)).toBe('ルート計算に失敗しました')
    expect(formatRouteCalculationError(undefined)).toBe('ルート計算に失敗しました')
  })

  it('handles known error codes', () => {
    expect(formatRouteCalculationError('API key not configured')).toMatch(/APIキー/)
    expect(formatRouteCalculationError('Address is missing')).toMatch(/出発地または目的地/)
    expect(formatRouteCalculationError('OVER_QUERY_LIMIT exceeded')).toMatch(/使用量制限/)
    expect(formatRouteCalculationError('ZERO_RESULTS')).toMatch(/見つかりませんでした/)
    expect(formatRouteCalculationError('INVALID_REQUEST')).toMatch(/無効なリクエスト/)
  })

  it('distinguishes REQUEST_DENIED variants', () => {
    expect(formatRouteCalculationError('REQUEST_DENIED: referer restrictions on key')).toMatch(
      /HTTPリファラー制限/
    )
    expect(
      formatRouteCalculationError('REQUEST_DENIED: This API project is not authorized')
    ).toMatch(/Distance Matrix API/)
    expect(formatRouteCalculationError('REQUEST_DENIED: something else')).toMatch(
      /APIキーの権限がありません/
    )
  })

  it('falls back for unknown errors', () => {
    expect(formatRouteCalculationError('weird error')).toBe('ルート計算に失敗しました: weird error')
  })

  it('accepts Error instances', () => {
    expect(formatRouteCalculationError(new Error('ZERO_RESULTS'))).toMatch(/見つかりませんでした/)
  })
})
