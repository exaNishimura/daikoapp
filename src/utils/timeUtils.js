/**
 * 時間計算ユーティリティ
 */

/**
 * 15分刻みでスナップ
 */
export function snapTo15Minutes(minutes) {
  return Math.round(minutes / 15) * 15
}

/**
 * 時間を分に変換（18:00 = 1080分）
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
 * Dateオブジェクトから分に変換（営業日基準: 18:00 = 0分）
 */
export function dateToBusinessMinutes(date) {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const totalMinutes = hours * 60 + minutes

  // 18:00以降はそのまま、18:00以前は翌日の時間として扱う
  if (totalMinutes < 1080) {
    return totalMinutes + 1440 // 24時間 = 1440分を加算
  }
  return totalMinutes - 1080 // 18:00 = 1080分を引く
}

/**
 * 営業日分からDateオブジェクトに変換
 * businessMinutesが負の値の場合、18:00より前の時間を表現
 * businessMinutesが360分（00:00）を超える場合、前日の18:00から数える
 */
export function businessMinutesToDate(businessMinutes, baseDate) {
  // baseDateが指定されていない場合、現在の日付を使用
  const date = baseDate ? new Date(baseDate) : new Date()
  
  // 営業日の開始時刻（18:00）に設定
  // 06:00未満の場合は前日の営業日として扱う
  const localHours = date.getHours()
  let businessDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (localHours < 6) {
    // 06:00未満の場合は前日の営業日として扱う
    businessDay.setDate(businessDay.getDate() - 1)
  }
  
  // businessMinutesが360分（00:00）を超える場合、前日の18:00から数える
  if (businessMinutes > 360) {
    // 前日の18:00から数える
    businessDay.setDate(businessDay.getDate() - 1)
  }
  
  // 営業日の18:00に設定
  businessDay.setHours(18, 0, 0, 0)
  
  // businessMinutesを時間と分に変換
  // businessMinutesが360分を超える場合、前日の18:00から数えるので、そのまま使用
  const hours = Math.floor(businessMinutes / 60)
  const minutes = businessMinutes % 60
  
  // 日付を設定
  const resultDate = new Date(businessDay)
  resultDate.setHours(18 + hours, minutes, 0, 0)
  
  // 24時を超えた場合は翌日
  if (18 + hours >= 24) {
    resultDate.setDate(resultDate.getDate() + 1)
    resultDate.setHours((18 + hours) % 24, minutes, 0, 0)
  }
  
  return resultDate
}

/**
 * 時間→px変換（15分 = 20px）
 */
export function minutesToPixels(minutes) {
  return (minutes / 15) * 20
}

/**
 * px→時間変換（20px = 15分）
 */
export function pixelsToMinutes(pixels) {
  return (pixels / 20) * 15
}

/**
 * 06:00超過チェック
 */
export function exceedsBusinessHours(endAt) {
  const endDate = new Date(endAt)
  const endHour = endDate.getHours()
  const startDate = new Date(endAt)
  startDate.setHours(18, 0, 0, 0) // 18:00に設定

  // 18:00以降で開始し、翌06:00を超える場合
  if (endHour > 6 && endDate.getDate() > startDate.getDate()) {
    return true
  }

  return false
}

/**
 * 営業日文字列を生成（例: "2025年12月23日(月)"）
 * 日またぎ営業（18:00〜翌06:00）に対応
 * 06:00未満の場合は前日の日付を返す
 */
export function formatBusinessDay(date) {
  const now = new Date(date)
  const hours = now.getHours()
  
  // 06:00未満の場合は前日の日付として扱う
  if (hours < 6) {
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
 * @returns {string} 最短時間の文字列（例: "今すぐ" または "18:00から"）
 */
export function getEarliestAvailableTime() {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  
  // 営業時間内（18:00以降、翌06:00以前）
  if (hours >= 18 || hours < 6) {
    return '今すぐ'
  }
  
  // 営業時間外の場合、次の18:00を表示
  const nextBusinessStart = new Date(now)
  nextBusinessStart.setHours(18, 0, 0, 0)
  
  const hoursStr = String(nextBusinessStart.getHours()).padStart(2, '0')
  const minutesStr = String(nextBusinessStart.getMinutes()).padStart(2, '0')
  
  return `${hoursStr}:${minutesStr}から`
}

