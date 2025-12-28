import { supabase } from '@/lib/supabase'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * Google Maps Directions APIを使用してルート計算
 * @param {string} pickupAddress - 出発地
 * @param {string} dropoffAddress - 目的地
 * @param {string[]|null} waypoints - 経由地の配列（オプション）
 * @param {string|null} waitingLocationAddress - 待機場所住所（復路の目的地、オプション）
 */
export async function estimateDuration(pickupAddress, dropoffAddress, waypoints = null, waitingLocationAddress = null) {
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
    let url = `/api/google-maps/directions/json?origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(dropoffAddress)}&key=${GOOGLE_MAPS_API_KEY}&language=ja`
    
    // 経由地がある場合は追加
    if (waypoints && waypoints.length > 0) {
      const waypointsParam = waypoints
        .filter((wp) => wp && wp.trim().length > 0)
        .map((wp) => encodeURIComponent(wp.trim()))
        .join('|')
      if (waypointsParam) {
        url += `&waypoints=${waypointsParam}`
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching route:', { pickupAddress, dropoffAddress, waypoints })
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
      console.log('Google Maps API response status:', data.status)
      if (data.error_message) {
        console.error('Google Maps API error message:', data.error_message)
      }
      // レスポンス全体は大きすぎるので、必要な情報だけをログに出力
      if (data.routes && data.routes.length > 0) {
        console.log('Route summary:', data.routes[0].summary || 'N/A')
        console.log('Total legs in route:', data.routes[0].legs?.length || 0)
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

    // すべてのlegsの所要時間を合計（経由地がある場合は複数のlegsがある）
    let totalDurationSeconds = 0
    const legsInfo = []
    for (let i = 0; i < data.routes[0].legs.length; i++) {
      const leg = data.routes[0].legs[i]
      const legDurationSeconds = leg.duration.value
      totalDurationSeconds += legDurationSeconds
      legsInfo.push({
        index: i + 1,
        from: leg.start_address || '出発地',
        to: leg.end_address || '目的地',
        durationSeconds: legDurationSeconds,
        durationMinutes: Math.round(legDurationSeconds / 60),
        distanceMeters: leg.distance?.value || 0,
        distanceKm: leg.distance ? (leg.distance.value / 1000).toFixed(2) : '0'
      })
    }
    
    // 秒→分に変換
    const oneWayMinutes = Math.round(totalDurationSeconds / 60)
    
    // 復路時間を計算（目的地 → 待機場所）
    let returnTripMinutes = 0
    if (waitingLocationAddress && waitingLocationAddress.trim().length > 0) {
      try {
        const returnUrl = `/api/google-maps/directions/json?origin=${encodeURIComponent(dropoffAddress)}&destination=${encodeURIComponent(waitingLocationAddress.trim())}&key=${GOOGLE_MAPS_API_KEY}&language=ja`
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Fetching return route:', { from: dropoffAddress, to: waitingLocationAddress })
        }

        const returnResponse = await fetch(returnUrl)
        
        if (returnResponse.ok) {
          const returnData = await returnResponse.json()
          
          if (returnData.status === 'OK' && returnData.routes && returnData.routes.length > 0 && returnData.routes[0].legs) {
            let returnDurationSeconds = 0
            for (const leg of returnData.routes[0].legs) {
              returnDurationSeconds += leg.duration.value
            }
            returnTripMinutes = Math.round(returnDurationSeconds / 60)
            
            if (process.env.NODE_ENV === 'development') {
              console.log('Return route calculated:', {
                from: dropoffAddress,
                to: waitingLocationAddress,
                duration: `${returnTripMinutes}分`
              })
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Return route calculation failed:', returnData.status)
            }
          }
        }
      } catch (returnError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error calculating return route:', returnError)
        }
        // 復路計算エラーは無視して続行（片道時間のみを使用）
      }
    }
    
    // 往復時間を計算（片道時間 + 復路時間）
    // 復路時間が計算できなかった場合は、片道時間を2倍（従来の動作）
    const roundTripMinutes = returnTripMinutes > 0 
      ? oneWayMinutes + returnTripMinutes
      : oneWayMinutes * 2

    if (process.env.NODE_ENV === 'development') {
      console.log('=== Route Duration Calculation ===')
      console.log('Origin:', pickupAddress)
      console.log('Destination:', dropoffAddress)
      console.log('Waypoints:', waypoints || 'なし')
      console.log('Waiting location:', waitingLocationAddress || 'なし')
      console.log('Total legs:', legsInfo.length)
      console.log('--- Leg Details ---')
      legsInfo.forEach((leg, index) => {
        console.log(`Leg ${leg.index}:`, {
          from: leg.from,
          to: leg.to,
          duration: `${leg.durationMinutes}分 (${leg.durationSeconds}秒)`,
          distance: `${leg.distanceKm}km`
        })
      })
      console.log('--- Summary ---')
      console.log('Total duration (seconds):', totalDurationSeconds)
      console.log('Total duration (minutes, rounded):', oneWayMinutes)
      console.log('One-way duration:', `${oneWayMinutes}分`)
      if (returnTripMinutes > 0) {
        console.log('Return trip duration (destination → waiting location):', `${returnTripMinutes}分`)
        console.log('Round-trip duration (one-way + return):', `${roundTripMinutes}分`)
      } else {
        console.log('Return trip duration: 計算なし（片道時間を2倍）')
        console.log('Round-trip duration (one-way × 2):', `${roundTripMinutes}分`)
      }
      console.log('This value will be saved as base_duration_min:', roundTripMinutes)
      console.log('=================================')
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

