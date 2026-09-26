import { calculateBuffer } from '@/services/routeService'
import {
  createOrder as createOrderService,
  findOrderByReservationMark as findOrderByReservationMarkService,
} from '@/services/orderService'
import { createSlot as createSlotService } from '@/services/slotService'
import { updateReservation as updateReservationService } from '@/services/reservationService'
import { findAutoPlacementSlot } from '@/lib/orderPlacement'
import { reservationIdFromOrder, withReservationMark } from '@/lib/reservation/reservationLink'
import { parseReservationMemo, waypointListFromMemo } from '@/lib/reservation/reservationMemo'

async function defaultCreateOrder(payload) {
  const { data, error } = await createOrderService(payload)
  if (error) throw error
  return data
}

async function defaultCreateSlot(payload) {
  const { data, error } = await createSlotService(payload)
  if (error) throw error
  return data
}

async function defaultUpdateReservation(id, patch) {
  const { data, error } = await updateReservationService(id, patch)
  if (error) throw error
  return data
}

async function defaultFindLinkedOrder(reservationId) {
  const { data, error } = await findOrderByReservationMarkService(reservationId)
  if (error) throw error
  return data
}

function resolveExistingOrder(reservation, existingOrders = []) {
  if (!reservation?.id) return null
  const marked = existingOrders.find((order) => reservationIdFromOrder(order) === reservation.id)
  if (marked) return marked
  if (reservation.order_id) {
    return existingOrders.find((order) => order.id === reservation.order_id) || null
  }
  return null
}

/**
 * 予約台帳行から orders 行を組み立てる。
 */
export function buildOrderPayloadFromReservation(reservation, startAt) {
  const parsed = parseReservationMemo(reservation?.memo)
  const phone = String(reservation?.phone || '').trim()
  const at = startAt instanceof Date ? startAt : new Date(startAt || reservation?.reserved_at)

  return {
    order_type: 'SCHEDULED',
    scheduled_at: Number.isNaN(at.getTime()) ? reservation?.reserved_at : at.toISOString(),
    pickup_location: reservation?.customer_name || null,
    pickup_address: parsed.pickup || '',
    dropoff_address: parsed.dropoff || '',
    waypoints: waypointListFromMemo(parsed),
    contact_phone: !phone || phone === '未入力' ? null : phone,
    car_model: parsed.car || null,
    parking_note: reservation?.id
      ? withReservationMark(parsed.parking || '', reservation.id)
      : parsed.parking || null,
    status: 'UNASSIGNED',
  }
}

function resolveDuration(order) {
  const baseDuration = order?.base_duration_min || 30
  const buffer = order?.buffer_min || calculateBuffer(baseDuration)
  return { baseDuration, buffer, totalDuration: baseDuration + buffer }
}

/**
 * 予約を SCHEDULED 依頼にして指定時刻に仮配置する。
 * 空きがなければ order だけ作り、手動 DnD に任せる。
 */
export async function placeReservationOnTimeline({
  reservation,
  vehicles,
  slots = [],
  operationStatuses,
  startAt,
  vehicleId,
  existingOrders = [],
  createOrder = defaultCreateOrder,
  createSlot = defaultCreateSlot,
  updateReservation = defaultUpdateReservation,
  findLinkedOrder = defaultFindLinkedOrder,
}) {
  if (!reservation?.id) return { skipped: true, reason: 'missing' }

  let order = resolveExistingOrder(reservation, existingOrders)
  if (!order) {
    try {
      order = await findLinkedOrder(reservation.id)
    } catch {
      order = null
    }
  }

  if (order?.id && slots.some((slot) => slot.order_id === order.id)) {
    return { skipped: true, reason: 'already-slotted', order }
  }

  if (!order?.id) {
    order = await createOrder(buildOrderPayloadFromReservation(reservation, startAt))
  }
  if (!order?.id) return { error: new Error('依頼の作成に失敗しました') }

  const { totalDuration } = resolveDuration(order)
  let availableSlot = null

  if (vehicleId && startAt) {
    availableSlot = {
      vehicleId,
      startAt: startAt instanceof Date ? startAt : new Date(startAt),
    }
  } else {
    const found = findAutoPlacementSlot({
      order,
      vehicles,
      slots,
      operationStatuses,
    })
    availableSlot = found.availableSlot
  }

  let slot = null
  if (availableSlot?.vehicleId && availableSlot.startAt) {
    const endAt = new Date(availableSlot.startAt)
    endAt.setMinutes(endAt.getMinutes() + totalDuration)
    slot = await createSlot({
      order_id: order.id,
      vehicle_id: availableSlot.vehicleId,
      start_at: availableSlot.startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'TENTATIVE',
    })
  }

  const reservedAt = availableSlot?.startAt
    ? availableSlot.startAt.toISOString()
    : order.scheduled_at

  try {
    await updateReservation(reservation.id, { reserved_at: reservedAt })
  } catch {
    // reserved_at 以外の更新失敗は配置自体は成功扱い
  }
  try {
    await updateReservation(reservation.id, { order_id: order.id })
  } catch {
    // order_id カラム未適用でも parking_note マークで紐付ける
  }

  return { order, slot, reservation: { ...reservation, order_id: order.id } }
}
