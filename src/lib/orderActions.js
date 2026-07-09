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

/**
 * 編集保存。
 * - 関連する dispatch_slots のうち TENTATIVE のものだけ end_at を再計算
 * - 最後に order を update
 *
 * @returns {Promise<Object>} 更新後の order
 */
export async function saveOrderEdit({ order, formData, deps }) {
  const { supabase, updateOrder } = deps

  const baseDurationMin = parseInt(formData.base_duration_min, 10)
  const bufferMin = parseInt(formData.buffer_min, 10)

  const waypoints = (formData.waypoints || []).map((wp) => wp.trim()).filter((wp) => wp.length > 0)

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
    buffer_manual: true,
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
  return updatedOrder
}

/**
 * ルート再計算。エラー時は estimateDuration の error をそのまま throw。
 *
 * @returns {Promise<{ order: Object, duration: number, buffer: number }>}
 */
export async function recalculateOrderRoute({ order, formData, relatedVehicle, deps }) {
  const { estimateDuration, calculateBuffer, getVehicles, updateOrder } = deps

  if (!formData.pickup_address?.trim()) {
    throw new Error('出発地を入力してください')
  }
  if (!formData.dropoff_address?.trim()) {
    throw new Error('目的地を入力してください')
  }

  const waypoints = (formData.waypoints || []).map((wp) => wp.trim()).filter((wp) => wp.length > 0)

  let waitingLocationAddress = relatedVehicle?.waiting_location_address || null
  if (!waitingLocationAddress) {
    try {
      const { data: vehicles } = await getVehicles()
      if (Array.isArray(vehicles) && vehicles.length > 0) {
        waitingLocationAddress = vehicles[0].waiting_location_address || null
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Error fetching vehicles for waiting location:', e)
      }
    }
  }

  const { duration, error } = await estimateDuration(
    formData.pickup_address.trim(),
    formData.dropoff_address.trim(),
    waypoints.length > 0 ? waypoints : null,
    waitingLocationAddress
  )

  if (error) {
    // 呼び出し側で formatRouteCalculationError に通せるように、
    // ここでは生の文字列を throw する
    const err = new Error(typeof error === 'string' ? error : error.message)
    err.cause = error
    throw err
  }
  if (!duration) {
    throw new Error('ルート計算の結果が取得できませんでした')
  }

  const buffer = calculateBuffer(duration)
  const { data: updatedOrder, error: updateError } = await updateOrder(order.id, {
    base_duration_min: duration,
    buffer_min: buffer,
    buffer_manual: false,
  })
  if (updateError) throw updateError

  return { order: updatedOrder, duration, buffer }
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
