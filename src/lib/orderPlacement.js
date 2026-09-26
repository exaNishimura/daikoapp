/**
 * 新規依頼を最短のスロットに自動配置するためのロジック。
 *
 * DispatchBoard.handleOrderCreated に埋まっていた 130 行ぐらいの処理を、
 *   1) 希望開始時刻を決める
 *   2) 配置可能スロットを検索
 *   3) スロットを作る
 * の 3 つに分けてここに切り出した。
 */

import { getOperatingHours, isHourInWindow } from '@/lib/operatingHours'
import { dateToRowIndex, getLastRowIndex, rowIndexToDate } from '@/utils/rowUtils'
import {
  findEarliestAvailableSlotAcrossVehicles,
  findExactAvailableVehicle,
} from '@/utils/slotUtils'
import { calculateBuffer } from '@/services/routeService'

/** ルート未計算のときの所要時間。空き判定・DnD・予約配置で共通。 */
export const DEFAULT_ORDER_DURATION_MIN = 30

/**
 * @param {object | null | undefined} order
 * @returns {{ baseDuration: number, buffer: number, totalDuration: number }}
 */
export function resolveOrderDuration(order) {
  const baseDuration = Number(order?.base_duration_min) || DEFAULT_ORDER_DURATION_MIN
  const buffer = order?.buffer_min ?? calculateBuffer(baseDuration)
  return { baseDuration, buffer, totalDuration: baseDuration + buffer }
}

/**
 * 営業日の開始日 (ローカル日付) を返す。
 * 06:00 未満は前日扱い。
 */
function getBusinessDayStartDate(reference = new Date()) {
  const day = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  if (reference.getHours() < getOperatingHours().businessEndHour) day.setDate(day.getDate() - 1)
  return day
}

/**
 * 「今すぐ」「日時指定」「フォールバック」の希望開始時刻を統一的に決める。
 *
 * @param {object} order
 * @param {Date}   [now=new Date()]
 * @returns {Date}
 */
export function computeDesiredStartTime(order, now = new Date()) {
  const { businessStartHour, businessEndHour } = getOperatingHours()
  const hours = now.getHours()
  const isBusinessHour = isHourInWindow(hours, businessStartHour, businessEndHour)

  if (order.order_type === 'NOW') {
    if (isBusinessHour) {
      const currentRowIndex = dateToRowIndex(now)
      const nextRowIndex = Math.min(getLastRowIndex(), Math.max(0, currentRowIndex) + 1)
      return rowIndexToDate(nextRowIndex, getBusinessDayStartDate(now))
    }
    const next = new Date(now)
    next.setHours(businessStartHour, 0, 0, 0)
    if (hours >= businessStartHour) next.setDate(next.getDate() + 1)
    return next
  }

  if (order.scheduled_at) {
    return new Date(order.scheduled_at)
  }

  // フォールバック: 営業時間内ならそのまま、外なら営業開始（今日）
  if (isBusinessHour) return new Date(now)
  const fallback = new Date(now)
  fallback.setHours(businessStartHour, 0, 0, 0)
  return fallback
}

/**
 * 自動配置のメイン処理。
 *
 * @returns {{ availableSlot: object | null, totalDuration: number }}
 *   availableSlot が null のときは「配置可能な時間が見つからなかった」状態。
 */
export function findAutoPlacementSlot({
  order,
  vehicles,
  slots,
  operationStatuses,
  now = new Date(),
}) {
  const baseDuration = order.base_duration_min || 30
  const buffer = order.buffer_min || calculateBuffer(baseDuration)
  const totalDuration = baseDuration + buffer

  const orderStartTime = computeDesiredStartTime(order, now)
  const preferExactTime = order.order_type === 'SCHEDULED' && Boolean(order.scheduled_at)

  if (preferExactTime) {
    const availableSlot = findExactAvailableVehicle(
      vehicles,
      slots,
      orderStartTime,
      totalDuration,
      operationStatuses
    )
    return { availableSlot, totalDuration }
  }

  const availableSlot = findEarliestAvailableSlotAcrossVehicles(
    vehicles,
    slots,
    orderStartTime,
    totalDuration,
    false,
    operationStatuses
  )

  return { availableSlot, totalDuration }
}
