/**
 * 新規依頼を最短のスロットに自動配置するためのロジック。
 *
 * DispatchBoard.handleOrderCreated に埋まっていた 130 行ぐらいの処理を、
 *   1) 希望開始時刻を決める
 *   2) 配置可能スロットを検索
 *   3) スロットを作る
 * の 3 つに分けてここに切り出した。
 */

import { dateToRowIndex, rowIndexToDate } from '@/utils/rowUtils'
import { findEarliestAvailableSlotAcrossVehicles } from '@/utils/slotUtils'
import { calculateBuffer } from '@/services/routeService'

/**
 * 営業日の開始日 (ローカル日付) を返す。
 * 06:00 未満は前日扱い。
 */
function getBusinessDayStartDate(reference = new Date()) {
  const day = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  if (reference.getHours() < 6) day.setDate(day.getDate() - 1)
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
  const hours = now.getHours()
  const isBusinessHour = hours >= 18 || hours < 6

  if (order.order_type === 'NOW') {
    if (isBusinessHour) {
      // 現在の行を翌行にスナップ (15 分後)
      const currentRowIndex = dateToRowIndex(now)
      const nextRowIndex = Math.min(47, currentRowIndex + 1)
      return rowIndexToDate(nextRowIndex, getBusinessDayStartDate(now))
    }
    // 営業時間外 → 次の 18:00
    const next = new Date(now)
    next.setHours(18, 0, 0, 0)
    if (hours >= 18) next.setDate(next.getDate() + 1)
    return next
  }

  if (order.scheduled_at) {
    return new Date(order.scheduled_at)
  }

  // フォールバック: 営業時間内ならそのまま、外なら 18:00 (今日)
  if (isBusinessHour) return new Date(now)
  const fallback = new Date(now)
  fallback.setHours(18, 0, 0, 0)
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
  // 日時指定の場合のみ「ピッタリこの時刻」を優先したい
  const preferExactTime = order.order_type === 'SCHEDULED' && Boolean(order.scheduled_at)

  const availableSlot = findEarliestAvailableSlotAcrossVehicles(
    vehicles,
    slots,
    orderStartTime,
    totalDuration,
    preferExactTime,
    operationStatuses
  )

  return { availableSlot, totalDuration }
}
