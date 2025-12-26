/**
 * 直近依頼をとれる時間を計算するユーティリティ
 */

import { findEarliestAvailableSlotAcrossVehicles } from './slotUtils'
import { calculateBuffer } from '@/services/routeService'

/**
 * すべての車両を考慮して、直近依頼をとれる時間を取得
 * @param {Array} vehicles - 車両の配列
 * @param {Array} slots - すべてのスロットの配列
 * @param {number} defaultDuration - デフォルトの所要時間（分、デフォルト: 30分）
 * @param {Object} operationStatusesMap - vehicleIdをキーとした稼働状況設定のマップ（オプション）
 * @returns {string} 直近依頼をとれる時間の文字列（例: "今すぐ" または "20:15"）
 */
export function getEarliestAvailableTimeWithSlots(vehicles, slots, defaultDuration = 30, operationStatusesMap = {}) {
  if (!vehicles || vehicles.length === 0) {
    return '車両がありません'
  }

  const now = new Date()
  const hours = now.getHours()

  // 営業時間外の場合、次の18:00以降の空き時間を検索
  let searchStartTime = now
  if (hours >= 6 && hours < 18) {
    // 営業時間外の場合、次の18:00を検索開始時刻とする
    searchStartTime = new Date(now)
    searchStartTime.setHours(18, 0, 0, 0)
  }

  // スロットの状況を確認
  const buffer = calculateBuffer(defaultDuration)
  const totalDuration = defaultDuration + buffer

  // 検索開始時刻以降の空き時間を検索
  const availableSlot = findEarliestAvailableSlotAcrossVehicles(
    vehicles,
    slots || [],
    searchStartTime,
    totalDuration,
    false, // preferExactTime
    operationStatusesMap
  )

  if (!availableSlot) {
    return '空き時間がありません'
  }

  const startAt = availableSlot.startAt
  const startHours = startAt.getHours()
  const startMinutes = startAt.getMinutes()

  // 現在時刻と比較（ミリ秒単位で正確に計算）
  const nowTime = now.getTime()
  const startTime = startAt.getTime()
  const timeDiffMinutes = Math.round((startTime - nowTime) / (1000 * 60))

  // 15分以内の場合は「今すぐ」と表示（営業時間内の場合のみ）
  // 営業時間外の場合は、次の18:00以降なので「今すぐ」は表示しない
  if (hours < 6 || hours >= 18) {
    if (timeDiffMinutes <= 15) {
      return '今すぐ'
    }
  }

  // 時刻をフォーマット
  const hoursStr = String(startHours).padStart(2, '0')
  const minutesStr = String(startMinutes).padStart(2, '0')
  return `${hoursStr}:${minutesStr}`
}

