/**
 * 時間計算ユーティリティ
 */

import { getOperatingHours, getTimelineStartHour } from '@/lib/operatingHours'
import { TIMELINE_ROW_HEIGHT_PX } from './rowUtils'

/**
 * 15分刻みでスナップ
 */
export function snapTo15Minutes(minutes) {
  return Math.round(minutes / 15) * 15
}

/**
 * 時刻を深夜0時からの分に変換する
 */
export function timeToMinutes(hours, minutes = 0) {
  return hours * 60 + minutes
}

/**
 * 分を時間:分形式に変換
 */
export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return { hours, minutes }
}

/**
 * 時間→px変換（15分 = TIMELINE_ROW_HEIGHT_PX）
 */
export function minutesToPixels(minutes) {
  return (minutes / 15) * TIMELINE_ROW_HEIGHT_PX
}

/**
 * px→時間変換
 */
export function pixelsToMinutes(pixels) {
  return (pixels / TIMELINE_ROW_HEIGHT_PX) * 15
}

/**
 * 06:00超過チェック
 */
export function exceedsBusinessHours(endAt) {
  const endDate = new Date(endAt)
  const { businessEndHour } = getOperatingHours()
  const startHour = getTimelineStartHour()
  const endHour = endDate.getHours()
  const endMinutes = endDate.getMinutes()
  if (endHour === businessEndHour && endMinutes > 0) return true
  return endHour > businessEndHour && endHour < startHour
}

/**
 * 営業日文字列を生成（例: "2025年12月23日(月)"）
 * 日またぎ営業（タイムライン開始〜翌06:00）に対応
 * 06:00未満の場合は前日の日付を返す
 */
export function formatBusinessDay(date) {
  const now = new Date(date)
  const hours = now.getHours()

  if (hours < getOperatingHours().businessEndHour) {
    now.setDate(now.getDate() - 1)
  }

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const weekday = now.toLocaleDateString('ja-JP', { weekday: 'short' })
  return `${year}年${month}月${day}日(${weekday})`
}
