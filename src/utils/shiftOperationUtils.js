import { timeToRowIndex } from './rowUtils'

function timeStringToRowIndex(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number)
  return timeToRowIndex(hour, minute)
}

/**
 * 号車のシフト一覧から vehicle_operation_status 用レコードを生成する。
 * 出勤時刻（shift.start）のみを稼働開始とし、終了時刻は設定しない。
 * （現場判断で延長するため、shift.end から STOP は作らない）
 */
export function buildOperationStatusesFromShifts(vehicleShifts) {
  const shiftsWithStart = (vehicleShifts || [])
    .filter((shift) => shift.start)
    .sort((a, b) => timeStringToRowIndex(a.start) - timeStringToRowIndex(b.start))

  if (shiftsWithStart.length === 0) {
    return [{ type: 'DAY_OFF', time: null }]
  }

  return [
    { type: 'DAY_OFF', time: null },
    { type: 'START', time: shiftsWithStart[0].start },
  ]
}
