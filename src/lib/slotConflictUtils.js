import { checkSlotConflict } from '@/services/conflictDetectionService'

/**
 * 全スロットの競合を検出する。
 * @returns {{ conflictIds: Set<string>, pairs: Array<[object, object]> }}
 */
export function detectAllConflicts(slots) {
  const conflictIds = new Set()
  const pairs = []

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (checkSlotConflict(slots[i], slots[j])) {
        conflictIds.add(slots[i].id)
        conflictIds.add(slots[j].id)
        pairs.push([slots[i], slots[j]])
      }
    }
  }

  return { conflictIds, pairs }
}

function formatSlotTimeRange(startAt, endAt) {
  const opts = { hour: '2-digit', minute: '2-digit' }
  const start = new Date(startAt).toLocaleTimeString('ja-JP', opts)
  const end = new Date(endAt).toLocaleTimeString('ja-JP', opts)
  return `${start}〜${end}`
}

/**
 * 指定依頼に関する競合メッセージ一覧を返す。
 */
export function getOrderConflictMessages(orderId, slots, vehicles = []) {
  const orderSlots = slots.filter((s) => s.order_id === orderId)
  const messages = new Set()

  for (const slot of orderSlots) {
    for (const other of slots) {
      if (other.id === slot.id || !checkSlotConflict(slot, other)) continue

      const vehicle = vehicles.find((v) => v.id === slot.vehicle_id)
      const vehicleName = vehicle?.name || '号車'
      const range = formatSlotTimeRange(other.start_at, other.end_at)
      messages.add(`${vehicleName}の ${range} と時間が重複しています。時刻を調整してください。`)
    }
  }

  return [...messages]
}

/**
 * スロット単体の競合ツールチップ用メッセージ。
 */
export function getSlotConflictTooltip(slotId, slots, vehicles = []) {
  const slot = slots.find((s) => s.id === slotId)
  if (!slot) return ''

  const vehicle = vehicles.find((v) => v.id === slot.vehicle_id)
  const vehicleName = vehicle?.name || '号車'
  const conflicts = slots.filter((other) => other.id !== slot.id && checkSlotConflict(slot, other))

  if (conflicts.length === 0) return ''

  const ranges = conflicts.map((c) => formatSlotTimeRange(c.start_at, c.end_at)).join('、')
  return `${vehicleName}: ${ranges} と重複`
}
