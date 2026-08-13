/**
 * 依頼詳細パネルから呼ばれる「ビジネスロジック」を集約したヘルパー群。
 *
 * - 編集保存（updates + 関連 dispatch_slots の end_at 再計算）
 * - ルート再計算（estimateDuration -> updateOrder）
 * - 確定（既存 TENTATIVE があれば confirm、無ければ空き枠を探して新規作成 -> confirm）
 * - ステータス巻き戻し（slot のステータスも連動更新）
 *
 * supabase インスタンスや service 関数は引数で受け取るので
 * テストはモックを差し込めば書ける。
 */

import { findEarliestAvailableSlotAcrossVehicles } from '@/utils/slotUtils'
import { getRevertStatus } from '@/utils/orderStatusUtils'

export function normalizeWaypoints(waypoints) {
  return (waypoints || [])
    .map((wp) => (typeof wp === 'string' ? wp.trim() : ''))
    .filter((wp) => wp.length > 0)
}

/**
 * 出発地・目的地・経由地のいずれかが変わったか。
 */
export function hasRouteChanged(order, formData) {
  const nextWaypoints = normalizeWaypoints(formData.waypoints)
  const prevWaypoints = normalizeWaypoints(order.waypoints)

  if ((formData.pickup_address || '').trim() !== (order.pickup_address || '').trim()) {
    return true
  }
  if ((formData.dropoff_address || '').trim() !== (order.dropoff_address || '').trim()) {
    return true
  }
  if (nextWaypoints.length !== prevWaypoints.length) {
    return true
  }
  return nextWaypoints.some((wp, i) => wp !== prevWaypoints[i])
}

async function resolveWaitingLocationAddress(relatedVehicle, getVehicles) {
  let waitingLocationAddress = relatedVehicle?.waiting_location_address || null
  if (waitingLocationAddress || !getVehicles) {
    return waitingLocationAddress
  }
  try {
    const { data: vehicles } = await getVehicles()
    if (Array.isArray(vehicles) && vehicles.length > 0) {
      return vehicles[0].waiting_location_address || null
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('Error fetching vehicles for waiting location:', e)
    }
  }
  return null
}

/**
 * ルート所要時間を計算する。失敗時は duration=null。
 */
export async function computeRouteDuration({
  pickupAddress,
  dropoffAddress,
  waypoints,
  relatedVehicle,
  deps,
}) {
  const { estimateDuration, calculateBuffer, getVehicles } = deps
  const waitingLocationAddress = await resolveWaitingLocationAddress(relatedVehicle, getVehicles)
  const normalizedWaypoints = normalizeWaypoints(waypoints)

  const { duration, error } = await estimateDuration(
    pickupAddress,
    dropoffAddress,
    normalizedWaypoints.length > 0 ? normalizedWaypoints : null,
    waitingLocationAddress
  )

  if (error || !duration) {
    return {
      duration: null,
      buffer: null,
      error: error || 'ルート計算の結果が取得できませんでした',
    }
  }

  return { duration, buffer: calculateBuffer(duration), error: null }
}

/**
 * 編集保存。
 * - 出発地・目的地・経由地が変わっていれば estimateDuration で所要時間を再計算
 * - 関連する dispatch_slots のうち TENTATIVE のものだけ end_at を再計算
 * - 最後に order を update
 *
 * @returns {Promise<{ order: Object, routeRecalculated: boolean, routeRecalcError: unknown }>}
 */
export async function saveOrderEdit({ order, formData, relatedVehicle = null, deps }) {
  const { supabase, updateOrder } = deps

  let baseDurationMin = parseInt(formData.base_duration_min, 10)
  let bufferMin = parseInt(formData.buffer_min, 10)
  let bufferManual = true
  let routeRecalculated = false
  let routeRecalcError = null

  const waypoints = normalizeWaypoints(formData.waypoints)
  const pickupAddress = (formData.pickup_address || '').trim()
  const dropoffAddress = (formData.dropoff_address || '').trim()

  if (hasRouteChanged(order, formData) && pickupAddress && dropoffAddress) {
    const result = await computeRouteDuration({
      pickupAddress,
      dropoffAddress,
      waypoints,
      relatedVehicle,
      deps,
    })
    if (result.duration) {
      baseDurationMin = result.duration
      bufferMin = result.buffer
      bufferManual = false
      routeRecalculated = true
    } else {
      routeRecalcError = result.error
    }
  }

  const updates = {
    pickup_location: formData.pickup_location?.trim() || null,
    pickup_address: formData.pickup_address,
    dropoff_address: formData.dropoff_address,
    waypoints: waypoints.length > 0 ? waypoints : null,
    contact_phone: formData.contact_phone || null,
    car_model: formData.car_model || null,
    car_plate: formData.car_plate || null,
    car_color: formData.car_color || null,
    parking_note: formData.parking_note || null,
    base_duration_min: baseDurationMin,
    buffer_min: bufferMin,
    buffer_manual: bufferManual,
  }

  const { data: existingSlots } = await supabase
    .from('dispatch_slots')
    .select('*')
    .eq('order_id', order.id)

  if (existingSlots && existingSlots.length > 0) {
    const totalDuration = baseDurationMin + bufferMin
    for (const slot of existingSlots) {
      if (slot.status === 'TENTATIVE') {
        const endAt = new Date(slot.start_at)
        endAt.setMinutes(endAt.getMinutes() + totalDuration)
        await supabase
          .from('dispatch_slots')
          .update({ end_at: endAt.toISOString() })
          .eq('id', slot.id)
      }
    }
  }

  const { data: updatedOrder, error } = await updateOrder(order.id, updates)
  if (error) throw error
  return { order: updatedOrder, routeRecalculated, routeRecalcError }
}

/**
 * ルート再計算。エラー時は estimateDuration の error をそのまま throw。
 *
 * @returns {Promise<{ order: Object, duration: number, buffer: number }>}
 */
export async function recalculateOrderRoute({ order, formData, relatedVehicle, deps }) {
  const { updateOrder } = deps

  if (!formData.pickup_address?.trim()) {
    throw new Error('出発地を入力してください')
  }
  if (!formData.dropoff_address?.trim()) {
    throw new Error('目的地を入力してください')
  }

  const result = await computeRouteDuration({
    pickupAddress: formData.pickup_address.trim(),
    dropoffAddress: formData.dropoff_address.trim(),
    waypoints: formData.waypoints,
    relatedVehicle,
    deps,
  })

  if (result.error) {
    const err = new Error(typeof result.error === 'string' ? result.error : result.error.message)
    err.cause = result.error
    throw err
  }

  const { data: updatedOrder, error: updateError } = await updateOrder(order.id, {
    base_duration_min: result.duration,
    buffer_min: result.buffer,
    buffer_manual: false,
  })
  if (updateError) throw updateError

  return { order: updatedOrder, duration: result.duration, buffer: result.buffer }
}

/**
 * 確定処理。
 * - TENTATIVE の dispatch_slots があればそれを confirmSlot
 * - 無ければ空き時間を探して新規 createSlot -> confirmSlot
 * - 最後に order の status を CONFIRMED に
 *
 * @returns {Promise<Object>} 更新後の order
 */
export async function confirmOrder({ order, vehicles, slots, deps }) {
  const { supabase, getOrderById, calculateBuffer, createSlot, confirmSlot, updateOrder } = deps

  const { data: existingSlots, error: slotsError } = await supabase
    .from('dispatch_slots')
    .select('*')
    .eq('order_id', order.id)
    .eq('status', 'TENTATIVE')

  if (slotsError) throw slotsError

  let slotsToConfirm = existingSlots || []

  if (slotsToConfirm.length === 0) {
    if (!vehicles || vehicles.length === 0) {
      throw new Error('車両が登録されていません')
    }

    const { data: latestOrder, error: orderError } = await getOrderById(order.id)
    if (orderError) throw orderError

    const baseDuration = latestOrder?.base_duration_min || 30
    const buffer = latestOrder?.buffer_min || calculateBuffer(baseDuration)
    const totalDuration = baseDuration + buffer

    // 開始時刻：営業時間内なら今、そうでなければ次の 18:00
    const now = new Date()
    const hours = now.getHours()
    let orderStartTime
    if (hours >= 18 || hours < 6) {
      orderStartTime = new Date(now)
    } else {
      orderStartTime = new Date(now)
      orderStartTime.setHours(18, 0, 0, 0)
    }

    const availableSlot = findEarliestAvailableSlotAcrossVehicles(
      vehicles,
      slots,
      orderStartTime,
      totalDuration
    )
    if (!availableSlot) {
      throw new Error('配置可能な時間が見つかりませんでした')
    }

    const endAt = new Date(availableSlot.startAt)
    endAt.setMinutes(endAt.getMinutes() + totalDuration)

    const { data: newSlot, error: createError } = await createSlot({
      order_id: order.id,
      vehicle_id: availableSlot.vehicleId,
      start_at: availableSlot.startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'TENTATIVE',
    })
    if (createError) throw createError
    if (!newSlot) throw new Error('スロットの作成に失敗しました')

    slotsToConfirm = [newSlot]
  }

  for (const slot of slotsToConfirm) {
    const { error: confirmError } = await confirmSlot(slot.id)
    if (confirmError) throw confirmError
  }

  const { data: updatedOrder, error: updateError } = await updateOrder(order.id, {
    status: 'CONFIRMED',
  })
  if (updateError) throw updateError

  return updatedOrder
}

/**
 * 1 段階前のステータスに戻す。
 * - CONFIRMED -> TENTATIVE のときは関連 dispatch_slots を CONFIRMED -> TENTATIVE に戻す
 * - 他のステータスから CONFIRMED に戻すときは dispatch_slots を CONFIRMED に揃える
 *
 * @returns {Promise<Object>} 更新後の order
 */
export async function revertOrderStatus({ order, deps }) {
  const { supabase, updateOrder } = deps

  const previousStatus = getRevertStatus(order.status)
  if (!previousStatus) throw new Error('戻すことができないステータスです')

  const { data: updatedOrder, error } = await updateOrder(order.id, {
    status: previousStatus,
  })
  if (error) throw error

  if (order.status === 'CONFIRMED' && previousStatus === 'TENTATIVE') {
    const { data: relatedSlots } = await supabase
      .from('dispatch_slots')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'CONFIRMED')

    if (relatedSlots && relatedSlots.length > 0) {
      for (const slot of relatedSlots) {
        await supabase.from('dispatch_slots').update({ status: 'TENTATIVE' }).eq('id', slot.id)
      }
    }
  } else if (previousStatus === 'CONFIRMED') {
    const { data: relatedSlots } = await supabase
      .from('dispatch_slots')
      .select('*')
      .eq('order_id', order.id)

    if (relatedSlots && relatedSlots.length > 0) {
      for (const slot of relatedSlots) {
        await supabase.from('dispatch_slots').update({ status: 'CONFIRMED' }).eq('id', slot.id)
      }
    }
  }

  return updatedOrder
}
