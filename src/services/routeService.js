import { supabase } from '@/lib/supabase'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * Google Maps Directions APIを使用してルート計算
 */
export async function estimateDuration(pickupAddress, dropoffAddress) {
  if (!GOOGLE_MAPS_API_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Google Maps API key not configured')
    }
    return { duration: null, error: 'API key not configured' }
  }

  if (!pickupAddress || !dropoffAddress) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Pickup or dropoff address is missing')
    }
    return { duration: null, error: 'Address is missing' }
  }

  try {
    // プロキシ経由でAPIを呼び出す（CORSエラーを回避）
    // APIキーはクエリパラメータとして含める（プロキシで転送される）
    const url = `/api/google-maps/directions/json?origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(dropoffAddress)}&key=${GOOGLE_MAPS_API_KEY}&language=ja`

    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching route:', { pickupAddress, dropoffAddress })
    }

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      if (process.env.NODE_ENV === 'development') {
        console.error('Google Maps API error response:', response.status, errorText)
      }
      return { duration: null, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()

    if (process.env.NODE_ENV === 'development') {
      console.log('Google Maps API response:', data.status, data)
      if (data.error_message) {
        console.error('Google Maps API error message:', data.error_message)
      }
    }

    if (data.status !== 'OK') {
      // エラーメッセージを詳細化
      let errorMessage = data.status || 'No route found'
      if (data.error_message) {
        errorMessage = `${data.status}: ${data.error_message}`
      }
      return { duration: null, error: errorMessage }
    }

    if (!data.routes || data.routes.length === 0) {
      return { duration: null, error: 'No route found' }
    }

    if (!data.routes[0].legs || data.routes[0].legs.length === 0) {
      return { duration: null, error: 'No legs found in route' }
    }

    // 最初のルートの所要時間を取得（秒→分に変換）
    const durationSeconds = data.routes[0].legs[0].duration.value
    const oneWayMinutes = Math.round(durationSeconds / 60)
    
    // 往復時間を計算（片道時間を2倍）
    const roundTripMinutes = oneWayMinutes * 2

    if (process.env.NODE_ENV === 'development') {
      console.log('Route duration calculated:', {
        oneWay: oneWayMinutes,
        roundTrip: roundTripMinutes,
        unit: 'minutes'
      })
    }

    return { duration: roundTripMinutes, error: null }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error estimating route duration:', error)
    }
    return { duration: null, error: error.message }
  }
}

/**
 * バッファ計算（一律10分）
 */
export function calculateBuffer(baseDuration) {
  // バッファは一律10分
  return 10
}

