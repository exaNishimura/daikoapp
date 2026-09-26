/**
 * 時間計算ユーティリティ
 */

import { getOperatingHours, getTimelineStartHour, isHourInWindow } from '@/lib/operatingHours'
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
 * Date をタイムライン開始からの分に変換する。開始前の早朝は +1440。
 */
export function dateToBusinessMinutes(date) {
  const startMinutes = getTimelineStartHour() * 60
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const totalMinutes = hours * 60 + minutes

  if (totalMinutes < startMinutes) {
    return totalMinutes + 1440
  }
  return totalMinutes - startMinutes
}

/**
 * 営業日分からDateオブジェクトに変換
 * タイムライン開始からの分を Date に戻す。
 */
export function businessMinutesToDate(businessMinutes, baseDate) {
  // baseDateが指定されていない場合、現在の日付を使用
  const date = baseDate ? new Date(baseDate) : new Date()

  // タイムライン開始時刻に合わせる
  // 06:00未満の場合は前日の営業日として扱う
  const localHours = date.getHours()
  let businessDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const { businessEndHour } = getOperatingHours()
  const startHour = getTimelineStartHour()
  if (localHours < businessEndHour) {
    businessDay.setDate(businessDay.getDate() - 1)
  }

  if (businessMinutes > 360) {
    businessDay.setDate(businessDay.getDate() - 1)
  }

  businessDay.setHours(startHour, 0, 0, 0)

  // businessMinutesを時間と分に変換
  const hours = Math.floor(businessMinutes / 60)
  const minutes = businessMinutes % 60

  // 日付を設定
  const resultDate = new Date(businessDay)
  resultDate.setHours(startHour + hours, minutes, 0, 0)

  if (startHour + hours >= 24) {
    resultDate.setDate(resultDate.getDate() + 1)
    resultDate.setHours((startHour + hours) % 24, minutes, 0, 0)
  }

  return resultDate
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

/**
 * 依頼を受けられる最短時間を取得
 * @returns {string} 最短時間の文字列（例: "今すぐ" または "20:00から"）
 */
export function getEarliestAvailableTime() {
  const now = new Date()
  const hours = now.getHours()
  const { businessStartHour, businessEndHour } = getOperatingHours()
  if (isHourInWindow(hours, businessStartHour, businessEndHour)) {
    return '今すぐ'
  }

  const nextBusinessStart = new Date(now)
  nextBusinessStart.setHours(businessStartHour, 0, 0, 0)

  const hoursStr = String(nextBusinessStart.getHours()).padStart(2, '0')
  const minutesStr = String(nextBusinessStart.getMinutes()).padStart(2, '0')

  return `${hoursStr}:${minutesStr}から`
}
