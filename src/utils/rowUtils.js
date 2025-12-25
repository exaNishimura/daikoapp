/**
 * 行数ベースのタイムライン管理ユーティリティ
 * タイムラインは48行（18:00〜翌06:00、15分刻み）
 * 各行は0〜47のインデックスで管理
 */

/**
 * 時刻を行番号に変換
 * @param {number} hour - 時間（0-23）
 * @param {number} minute - 分（0-59）
 * @returns {number} 行番号（0-47）
 */
export function timeToRowIndex(hour, minute) {
  // 18:00 = 0行、翌06:00 = 47行
  if (hour >= 18) {
    // 18:00以降（当日）
    // 例: 20:00 = (20 - 18) * 4 + 0 = 8行
    return (hour - 18) * 4 + Math.floor(minute / 15)
  } else {
    // 06:00未満（前日の18:00から数える）
    // 例: 02:00 = (24 - 18) * 4 + (0 + 2) * 4 + 0 = 24 + 8 = 32行
    return (24 - 18) * 4 + hour * 4 + Math.floor(minute / 15)
  }
}

/**
 * 行番号を時刻に変換
 * @param {number} rowIndex - 行番号（0-47）
 * @returns {{hour: number, minute: number}} 時刻オブジェクト
 */
export function rowIndexToTime(rowIndex) {
  if (rowIndex < 0 || rowIndex > 47) {
    throw new Error(`Invalid row index: ${rowIndex}. Must be between 0 and 47.`)
  }
  
  if (rowIndex < 24) {
    // 18:00〜23:45（当日）
    const hour = 18 + Math.floor(rowIndex / 4)
    const minute = (rowIndex % 4) * 15
    return { hour, minute }
  } else {
    // 00:00〜06:00（翌日）
    const hour = Math.floor((rowIndex - 24) / 4)
    const minute = ((rowIndex - 24) % 4) * 15
    return { hour, minute }
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
  const isExactRowStart = (minute % 15 === 0) && (seconds === 0) && (milliseconds === 0)
  
  if (isExactRowStart) {
    return timeToRowIndex(hour, minute)
  } else {
    // 行の途中にある場合、次の行番号を返す
    const currentRow = timeToRowIndex(hour, minute)
    return Math.min(47, currentRow + 1)
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
  
  if (hour >= 18) {
    // 18:00以降（当日）
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
  return rowIndex * 20 // 15分 = 20px
}

/**
 * ピクセル位置を行番号に変換
 * @param {number} pixels - ピクセル位置
 * @returns {number} 行番号（0-47）
 */
export function pixelsToRowIndex(pixels) {
  return Math.floor(pixels / 20) // 15分 = 20px
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
  return Math.max(0, Math.min(47, Math.round(rowIndex)))
}

