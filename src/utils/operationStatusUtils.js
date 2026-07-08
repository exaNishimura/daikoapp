/**
 * 随伴車の稼働状況を判定するユーティリティ
 */

import { dateToRowIndex, rowIndexToDate, timeToRowIndex } from './rowUtils'

function timeStringToRowIndex(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0
  }
  return timeToRowIndex(hour, minute)
}

export function getBusinessDateFromTime(targetTime) {
  const targetDate = new Date(targetTime)
  const targetHours = targetDate.getHours()
  const businessDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  )
  if (targetHours < 6) {
    businessDate.setDate(businessDate.getDate() - 1)
  }
  return businessDate
}

function filterDayStatuses(operationStatuses, targetTime) {
  const dateStr = getBusinessDateFromTime(targetTime).toISOString().split('T')[0]
  return operationStatuses.filter((status) => {
    const statusDate = new Date(status.date + 'T00:00:00')
    return statusDate.toISOString().split('T')[0] === dateStr
  })
}

/**
 * 稼働状況レコードから稼働可能な行範囲を構築する
 * @returns {Array<{ startRow: number, endRow: number }>}
 */
export function buildOperationalWindowsFromStatuses(dayStatuses) {
  if (!dayStatuses?.length) {
    return []
  }

  const hasDefault = dayStatuses.some((status) => status.type === 'DEFAULT')
  const hasDayOff = dayStatuses.some((status) => status.type === 'DAY_OFF')

  if (hasDefault && !hasDayOff) {
    return [{ startRow: 0, endRow: 48 }]
  }

  const events = dayStatuses
    .filter((status) => (status.type === 'START' || status.type === 'STOP') && status.time)
    .map((status) => ({
      row: timeStringToRowIndex(status.time),
      type: status.type,
    }))
    .sort((a, b) => a.row - b.row)

  const windows = []
  let active = !hasDayOff
  let windowStart = hasDayOff ? null : 0

  for (const event of events) {
    if (event.type === 'START') {
      if (!active) {
        active = true
        windowStart = event.row
      }
      continue
    }

    if (active && windowStart !== null) {
      windows.push({ startRow: windowStart, endRow: event.row })
    }
    active = false
    windowStart = null
  }

  if (active && windowStart !== null) {
    windows.push({ startRow: windowStart, endRow: 48 })
  }

  return windows
}

const TIMELINE_ROW_COUNT = 48

/**
 * タイムライン上の配置可/不可帯を構築する
 * @returns {{ placementBands: Array<{ startRow: number, endRow: number }>, blockedBands: Array<{ startRow: number, endRow: number }>, shiftStartTime: string|null }}
 */
export function buildTimelinePlacementBands(dayStatuses, totalRows = TIMELINE_ROW_COUNT) {
  const hasDayOff = dayStatuses?.some((status) => status.type === 'DAY_OFF')
  const placementBands = buildOperationalWindowsFromStatuses(dayStatuses || [])
  const shiftStartTime =
    dayStatuses?.find((status) => status.type === 'START' && status.time)?.time ?? null

  if (placementBands.length === 0) {
    if (hasDayOff) {
      return {
        placementBands: [],
        blockedBands: [{ startRow: 0, endRow: totalRows }],
        shiftStartTime,
      }
    }
    return {
      placementBands: [{ startRow: 0, endRow: totalRows }],
      blockedBands: [],
      shiftStartTime,
    }
  }

  const blockedBands = []
  let cursor = 0
  const sortedPlacement = [...placementBands].sort((a, b) => a.startRow - b.startRow)

  for (const band of sortedPlacement) {
    if (cursor < band.startRow) {
      blockedBands.push({ startRow: cursor, endRow: band.startRow })
    }
    cursor = Math.max(cursor, band.endRow)
  }

  if (cursor < totalRows) {
    blockedBands.push({ startRow: cursor, endRow: totalRows })
  }

  return {
    placementBands: sortedPlacement,
    blockedBands,
    shiftStartTime,
  }
}

/**
 * 指定時刻で車両が稼働中かどうかを判定
 */
export function isVehicleOperational(vehicleId, targetTime, operationStatuses) {
  void vehicleId

  if (!operationStatuses || operationStatuses.length === 0) {
    return true
  }

  const dayStatuses = filterDayStatuses(operationStatuses, targetTime)
  if (dayStatuses.length === 0) {
    return true
  }

  const windows = buildOperationalWindowsFromStatuses(dayStatuses)
  if (windows.length === 0) {
    return !dayStatuses.some((status) => status.type === 'DAY_OFF')
  }

  const targetRow = dateToRowIndex(new Date(targetTime))
  return windows.some(
    (window) => targetRow >= window.startRow && targetRow < window.endRow
  )
}

/**
 * 号車の最も早い稼働開始時刻を返す（シフト出勤時刻ベースの START を反映）
 */
export function getEarliestOperationalStartTime(operationStatuses, referenceTime) {
  const dayStatuses = filterDayStatuses(operationStatuses, referenceTime)
  const windows = buildOperationalWindowsFromStatuses(dayStatuses)
  if (windows.length === 0) {
    return null
  }

  const earliestRow = Math.min(...windows.map((window) => window.startRow))
  const businessDate = getBusinessDateFromTime(referenceTime)
  return rowIndexToDate(earliestRow, businessDate)
}

/**
 * 指定時刻で稼働中の車両リストを取得
 */
export function getOperationalVehicles(vehicles, targetTime, operationStatusesMap) {
  if (!vehicles || vehicles.length === 0) {
    return []
  }

  return vehicles.filter((vehicle) => {
    const statuses = operationStatusesMap[vehicle.id] || []
    return isVehicleOperational(vehicle.id, targetTime, statuses)
  })
}

/**
 * 複数の稼働状況設定をマージし、優先順位を適用
 */
export function mergeOperationStatuses(statuses) {
  if (!statuses || statuses.length === 0) {
    return []
  }

  const priorityOrder = { START: 4, STOP: 3, DAY_OFF: 2, DEFAULT: 1 }

  return statuses.slice().sort((a, b) => {
    const aPriority = priorityOrder[a.type] || 0
    const bPriority = priorityOrder[b.type] || 0

    if (aPriority !== bPriority) {
      return bPriority - aPriority
    }

    if (a.time && b.time) {
      const aTime = a.time.split(':').map(Number)
      const bTime = b.time.split(':').map(Number)
      const aMinutes = aTime[0] * 60 + aTime[1]
      const bMinutes = bTime[0] * 60 + bTime[1]
      return bMinutes - aMinutes
    }

    if (!a.time) return -1
    if (!b.time) return 1

    return 0
  })
}
