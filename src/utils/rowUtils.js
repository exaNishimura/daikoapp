/**
 * 行数ベースのタイムライン管理ユーティリティ。
 * 行 0 はタイムライン開始（予約開始と営業開始の早い方）。15分刻み。
 */

import { getOperatingHours, getTimelineStartHour, timelineRowCount } from '@/lib/operatingHours'

/** 15分1行の高さ（px）。約3時間=12行が1画面に収まるスケール */
export const TIMELINE_ROW_HEIGHT_PX = 48

export function getTimelineRowCount() {
  const { businessEndHour } = getOperatingHours()
  return timelineRowCount(getTimelineStartHour(), businessEndHour)
}

export function getLastRowIndex() {
  return getTimelineRowCount() - 1
}

export function getTimelineTotalHeightPx() {
  return getTimelineRowCount() * TIMELINE_ROW_HEIGHT_PX
}

/**
 * 時刻を行番号に変換。タイムライン開始より前の夕方は行 0（開始時点で稼働済み）。
 * @param {number} hour
 * @param {number} minute
 * @returns {number}
 */
export function timeToRowIndex(hour, minute) {
  const start = getTimelineStartHour()
  const { businessEndHour } = getOperatingHours()
  if (hour >= start) {
    return (hour - start) * 4 + Math.floor(minute / 15)
  }
  if (hour < businessEndHour) {
    return (24 - start) * 4 + hour * 4 + Math.floor(minute / 15)
  }
  return 0
}

/**
 * 行番号を時刻に変換
 * @param {number} rowIndex
 * @returns {{hour: number, minute: number}}
 */
export function rowIndexToTime(rowIndex) {
  const start = getTimelineStartHour()
  const last = getLastRowIndex()
  if (rowIndex < 0 || rowIndex > last) {
    throw new Error(`Invalid row index: ${rowIndex}. Must be between 0 and ${last}.`)
  }

  const eveningRows = (24 - start) * 4
  if (rowIndex < eveningRows) {
    return {
      hour: start + Math.floor(rowIndex / 4),
      minute: (rowIndex % 4) * 15,
    }
  }
  const afterMidnight = rowIndex - eveningRows
  return {
    hour: Math.floor(afterMidnight / 4),
    minute: (afterMidnight % 4) * 15,
  }
}

/**
 * Dateオブジェクトを行番号に変換
 * @param {Date} date - 日時
 * @returns {number} 行番号（0-47）
 */
export function dateToRowIndex(date) {
  const hour = date.getHours()
  const minute = date.getMinutes()
  return timeToRowIndex(hour, minute)
}

/**
 * Dateオブジェクトを終了行番号に変換（スロットの終了時刻用）
 * end_atが行の途中にある場合、次の行番号を返す
 * @param {Date} date - 日時
 * @returns {number} 終了行番号（0-47）
 */
export function dateToEndRowIndex(date) {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const seconds = date.getSeconds()
  const milliseconds = date.getMilliseconds()

  // 分が15の倍数で、秒・ミリ秒が0の場合、その行の開始時刻なので、その行番号を返す
  // それ以外の場合（行の途中）、次の行番号を返す
  const isExactRowStart = minute % 15 === 0 && seconds === 0 && milliseconds === 0

  if (isExactRowStart) {
    return timeToRowIndex(hour, minute)
  } else {
    // 行の途中にある場合、次の行番号を返す
    const currentRow = timeToRowIndex(hour, minute)
    return Math.min(getLastRowIndex(), currentRow + 1)
  }
}

/**
 * 行番号をDateオブジェクトに変換
 * @param {number} rowIndex - 行番号（0-47）
 * @param {Date} baseDate - 基準日（営業日の日付）
 * @returns {Date} 日時
 */
export function rowIndexToDate(rowIndex, baseDate) {
  const { hour, minute } = rowIndexToTime(rowIndex)
  const date = new Date(baseDate)

  if (hour >= getTimelineStartHour()) {
    date.setHours(hour, minute, 0, 0)
  } else {
    // 06:00未満（翌日）
    date.setDate(date.getDate() + 1)
    date.setHours(hour, minute, 0, 0)
  }

  return date
}

/**
 * 行番号をピクセル位置に変換
 * @param {number} rowIndex - 行番号（0-47）
 * @returns {number} ピクセル位置（0-940）
 */
export function rowIndexToPixels(rowIndex) {
  return rowIndex * TIMELINE_ROW_HEIGHT_PX
}

/**
 * ピクセル位置を行番号に変換
 * @param {number} pixels - ピクセル位置
 * @returns {number} 行番号（0-47）
 */
export function pixelsToRowIndex(pixels) {
  return Math.floor(pixels / TIMELINE_ROW_HEIGHT_PX)
}

/**
 * 所要時間（分）を行数に変換
 * @param {number} minutes - 所要時間（分）
 * @returns {number} 行数
 */
export function minutesToRows(minutes) {
  return Math.ceil(minutes / 15) // 15分 = 1行
}

/**
 * 行数を所要時間（分）に変換
 * @param {number} rows - 行数
 * @returns {number} 所要時間（分）
 */
export function rowsToMinutes(rows) {
  return rows * 15 // 1行 = 15分
}

/**
 * 15分刻みで行番号にスナップ
 * @param {number} rowIndex - 行番号（小数点可）
 * @returns {number} スナップ後の行番号（0-47）
 */
export function snapToRowIndex(rowIndex) {
  return Math.max(0, Math.min(getLastRowIndex(), Math.round(rowIndex)))
}
