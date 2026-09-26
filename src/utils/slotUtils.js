/**
 * スロット関連のユーティリティ関数（行番号ベース）
 */

import { getOperatingHours } from '@/lib/operatingHours'
import { exceedsBusinessHours } from './timeUtils'
import {
  dateToRowIndex,
  dateToEndRowIndex,
  getLastRowIndex,
  rowIndexToDate,
  minutesToRows,
  snapToRowIndex,
} from './rowUtils'
import { isVehicleOperational, getEarliestOperationalStartTime } from './operationStatusUtils'

/**
 * 車両のスロットリストから最短の空き時間を見つける（行番号ベース）
 * @param {Array} slots - スロットの配列（start_atでソート済み）
 * @param {Date} orderStartTime - 依頼の希望開始時刻（今すぐの場合は現在時刻）
 * @param {number} duration - 必要な時間（分）
 * @param {boolean} preferExactTime - trueの場合、指定された時刻を優先（現在時刻の影響を受けない）
 * @returns {Date|null} - 配置可能な開始時刻、見つからない場合はnull
 */
export function findEarliestAvailableSlot(
  slots,
  orderStartTime,
  duration,
  preferExactTime = false
) {
  const orderDate = new Date(orderStartTime)
  const orderHours = orderDate.getHours()
  let businessDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())

  if (orderHours < getOperatingHours().businessEndHour) {
    businessDay.setDate(businessDay.getDate() - 1)
  }

  // 希望開始時刻を行番号に変換
  const orderStartRowIndex = dateToRowIndex(orderStartTime)

  // 希望開始時刻以降の空き時間を探す
  let orderStartSnappedRow = orderStartRowIndex

  // preferExactTimeがfalseの場合のみ、現在時刻を考慮
  if (!preferExactTime) {
    // 現在時刻を行番号に変換（比較用）
    const now = new Date()
    const nowRowIndex = dateToRowIndex(now)

    // 現在時刻が行の途中にあるかチェック（分が15の倍数でない場合、または秒・ミリ秒がある場合）
    const nowMinutes = now.getMinutes()
    const nowSeconds = now.getSeconds()
    const isNowInMiddleOfRow = nowMinutes % 15 !== 0 || nowSeconds > 0

    // 希望開始時刻が現在時刻と同じ行またはそれ以前の場合、現在時刻以降に調整
    // ただし、営業時間外（6:00-18:00）でorderStartTimeが18:00（行番号0）に設定されている場合は例外
    if (orderStartRowIndex === 0) {
      // 18:00に設定されている場合（営業時間外の依頼）、18:00から開始
      orderStartSnappedRow = 0
    } else if (orderStartRowIndex <= nowRowIndex) {
      // 現在時刻が行の途中にある場合、次の行に切り上げ
      if (isNowInMiddleOfRow) {
        orderStartSnappedRow = nowRowIndex + 1
      } else {
        // 現在時刻が行の開始時刻の場合、現在の行から開始可能
        orderStartSnappedRow = nowRowIndex
      }
    }
  }

  // 必要な行数を計算
  const requiredRows = minutesToRows(duration)

  const businessStartRow = 0
  const businessEndRow = getLastRowIndex()

  // スロットがない場合、希望開始時刻から配置
  if (!slots || slots.length === 0) {
    const candidateRow = Math.max(orderStartSnappedRow, businessStartRow)

    // 営業時間を超えないかチェック
    if (candidateRow + requiredRows - 1 > businessEndRow) {
      return null
    }

    return rowIndexToDate(candidateRow, businessDay)
  }

  // スロットを行番号ベースでソート（start_atから行番号に変換）
  // end_atは終了行番号として計算（行の途中の場合は次の行番号）
  const slotRows = slots
    .map((slot) => {
      const startAt = new Date(slot.start_at)
      const endAt = new Date(slot.end_at)
      const startRow = dateToRowIndex(startAt)
      const endRow = dateToEndRowIndex(endAt) // 終了行番号（行の途中の場合は次の行）

      return {
        startRow,
        endRow,
        slot,
      }
    })
    .sort((a, b) => a.startRow - b.startRow)

  // 希望開始時刻から最初の空き時間を探す
  let candidateRow = Math.max(orderStartSnappedRow, businessStartRow)

  for (let i = 0; i < slotRows.length; i++) {
    const slotRow = slotRows[i]

    // 候補行が現在のスロットの開始行より前の場合、配置可能
    if (candidateRow + requiredRows <= slotRow.startRow) {
      // 営業時間を超えないかチェック
      if (candidateRow + requiredRows - 1 <= businessEndRow) {
        return rowIndexToDate(candidateRow, businessDay)
      }
    }

    // 次の候補行は現在のスロットの終了行
    candidateRow = Math.max(candidateRow, slotRow.endRow)
  }

  // 最後のスロットの後に配置
  if (slotRows.length > 0) {
    const lastSlotRow = slotRows[slotRows.length - 1]
    candidateRow = Math.max(candidateRow, lastSlotRow.endRow)
  }

  // 営業時間を超えないかチェック
  if (candidateRow + requiredRows - 1 > businessEndRow) {
    return null
  }

  // candidateRowが範囲外の場合はnullを返す
  if (candidateRow < 0 || candidateRow > businessEndRow) {
    return null
  }

  return rowIndexToDate(candidateRow, businessDay)
}

/**
 * すべての車両から最短の空き時間を見つける（行番号ベース）
 * @param {Array} vehicles - 車両の配列
 * @param {Array} allSlots - すべてのスロットの配列
 * @param {Date} orderStartTime - 依頼の希望開始時刻
 * @param {number} duration - 必要な時間（分）
 * @param {boolean} preferExactTime - trueの場合、指定された時刻を優先（現在時刻の影響を受けない）
 * @returns {Object|null} - { vehicleId, startAt } または null
 */
export function findEarliestAvailableSlotAcrossVehicles(
  vehicles,
  allSlots,
  orderStartTime,
  duration,
  preferExactTime = false,
  operationStatusesMap = {}
) {
  if (!vehicles || vehicles.length === 0) {
    return null
  }

  let earliestSlot = null
  let earliestStartAt = null
  let earliestRowIndex = null

  for (const vehicle of vehicles) {
    const statuses = operationStatusesMap[vehicle.id] || []

    const earliestOperationalStart = getEarliestOperationalStartTime(statuses, orderStartTime)
    const effectiveOrderStartTime =
      earliestOperationalStart && earliestOperationalStart > orderStartTime
        ? earliestOperationalStart
        : orderStartTime

    if (!isVehicleOperational(vehicle.id, effectiveOrderStartTime, statuses)) {
      continue
    }

    // この車両のスロットを取得（start_atでソート）
    const vehicleSlots = allSlots
      .filter((slot) => slot.vehicle_id === vehicle.id)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))

    const startAt = findEarliestAvailableSlot(
      vehicleSlots,
      effectiveOrderStartTime,
      duration,
      preferExactTime
    )

    if (startAt) {
      // 稼働状況を再チェック（開始時刻での稼働状況）
      const statuses = operationStatusesMap[vehicle.id] || []
      if (!isVehicleOperational(vehicle.id, startAt, statuses)) {
        // 開始時刻で非稼働の場合はスキップ
        continue
      }

      // 行番号で比較（より早い行番号を優先）
      const rowIndex = dateToRowIndex(startAt)

      if (earliestRowIndex === null || rowIndex < earliestRowIndex) {
        earliestRowIndex = rowIndex
        earliestStartAt = startAt
        earliestSlot = {
          vehicleId: vehicle.id,
          startAt: startAt,
        }
      }
    }
  }

  return earliestSlot
}

/**
 * 指定開始〜所要時間の半開区間 [start, start+duration) が、その車両の既存スロットと重ならないか。
 * 営業時間の行範囲を超える場合も空きなし。
 */
export function isExactTimeFreeOnVehicle(slots, startAt, duration) {
  if (!startAt || !duration) return false

  const lastRow = getLastRowIndex()
  const startRow = dateToRowIndex(startAt)
  const requiredRows = minutesToRows(duration)
  if (startRow < 0 || startRow > lastRow) return false
  if (startRow + requiredRows - 1 > lastRow) return false

  const start = startAt.getTime()
  const end = start + duration * 60 * 1000
  for (const slot of slots || []) {
    const slotStart = new Date(slot.start_at).getTime()
    const slotEnd = new Date(slot.end_at).getTime()
    if (start < slotEnd && end > slotStart) return false
  }
  return true
}

/**
 * 指定時刻ちょうどに載せられる稼働中の車両を探す。見つからなければ null。
 * 「最短の空き」ではなく、開始時刻が startAt と一致する場合のみ返す。
 */
export function findExactAvailableVehicle(
  vehicles,
  allSlots,
  startAt,
  duration,
  operationStatusesMap = {}
) {
  if (!vehicles?.length || !startAt || !duration) return null

  const slotsByVehicle = new Map()
  for (const slot of allSlots || []) {
    const id = slot.vehicle_id
    if (!slotsByVehicle.has(id)) slotsByVehicle.set(id, [])
    slotsByVehicle.get(id).push(slot)
  }

  for (const vehicle of vehicles) {
    const statuses = operationStatusesMap[vehicle.id] || []
    if (!isVehicleOperational(vehicle.id, startAt, statuses)) continue
    const vehicleSlots = slotsByVehicle.get(vehicle.id) || []
    if (!isExactTimeFreeOnVehicle(vehicleSlots, startAt, duration)) continue
    return { vehicleId: vehicle.id, startAt }
  }

  return null
}
