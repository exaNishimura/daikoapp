import { calculateBuffer, estimateDuration } from '@/services/routeService'

/**
 * フォーム値から DB に渡す orderData を組み立てる。
 *
 * - 文字列は trim、空文字は null に変換
 * - SCHEDULED の場合のみ scheduled_at を ISO 文字列で付加
 * - waypoints は trim 後に空文字を除去し、0 件なら null
 */
export function buildOrderPayload(formData) {
  const waypoints = (formData.waypoints || [])
    .map((wp) => (typeof wp === 'string' ? wp.trim() : ''))
    .filter((wp) => wp.length > 0)

  const payload = {
    order_type: formData.order_type,
    pickup_location: formData.pickup_location?.trim() || null,
    pickup_address: formData.pickup_address?.trim() || '',
    dropoff_address: formData.dropoff_address?.trim() || '',
    waypoints: waypoints.length > 0 ? waypoints : null,
    contact_phone: formData.contact_phone?.trim() || null,
    car_model: formData.car_model?.trim() || null,
    car_plate: formData.car_plate?.trim() || null,
    car_color: formData.car_color?.trim() || null,
    parking_note: formData.parking_note?.trim() || null,
    status: 'UNASSIGNED',
  }

  if (formData.order_type === 'SCHEDULED' && formData.scheduled_at) {
    payload.scheduled_at = new Date(formData.scheduled_at).toISOString()
  }

  return { payload, waypoints }
}

const DEFAULT_DURATION_MIN = 30

/**
 * ルート計算が失敗 / null の場合の保険値（往復 15min × 2）を返す。
 */
function getDefaultRouteValues() {
  return {
    base_duration_min: DEFAULT_DURATION_MIN,
    buffer_min: calculateBuffer(DEFAULT_DURATION_MIN),
    buffer_manual: false,
  }
}

/**
 * 依頼を作成し、ルート計算結果（base_duration_min / buffer_min）を続いて反映する。
 *
 * createOrder は失敗したら throw。ルート計算/update の失敗は致命ではないので
 * デフォルト値で更新を試み、それでも失敗したら飲み込む（依頼自体は作成済み）。
 *
 * @param {Object} args
 * @param {Object} args.formData - フォーム入力値
 * @param {(orderData: Object) => Promise<Object>} args.createOrder - 作成 mutation（成功時 order を返す）
 * @param {(args: { id: string, updates: Object }) => Promise<unknown>} args.updateOrder - 更新 mutation
 * @param {() => Promise<Array>} args.fetchVehicles - 車両一覧取得（待機場所抽出のため）
 * @returns {Promise<Object>} 作成された order
 */
export async function submitOrderWithRouteCalculation({
  formData,
  createOrder,
  updateOrder,
  fetchVehicles,
}) {
  const { payload, waypoints } = buildOrderPayload(formData)

  const order = await createOrder(payload)
  if (!order) throw new Error('依頼の作成に失敗しました')

  let waitingLocationAddress = null
  try {
    const vehicles = await fetchVehicles()
    if (Array.isArray(vehicles) && vehicles.length > 0) {
      waitingLocationAddress = vehicles[0].waiting_location_address || null
    }
  } catch (vehicleError) {
    if (import.meta.env.DEV) {
      console.error('Error fetching vehicles for waiting location:', vehicleError)
    }
  }

  const { duration, error: routeError } = await estimateDuration(
    order.pickup_address,
    order.dropoff_address,
    waypoints.length > 0 ? waypoints : null,
    waitingLocationAddress
  )

  let updates
  if (routeError || !duration) {
    if (routeError && import.meta.env.DEV) {
      console.error('Route calculation error:', routeError)
    }
    updates = getDefaultRouteValues()
  } else {
    updates = {
      base_duration_min: duration,
      buffer_min: calculateBuffer(duration),
      buffer_manual: false,
    }
  }

  try {
    await updateOrder({ id: order.id, updates })
  } catch (updateError) {
    if (import.meta.env.DEV) {
      console.error('Failed to update order with route data:', updateError)
    }
  }

  return order
}
