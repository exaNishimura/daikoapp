import { supabase } from '@/lib/supabase'

/**
 * 競合判定: 2つの時間範囲が重複しているかチェック
 */
export function hasTimeConflict(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

/**
 * スロット間の競合チェック
 */
export function checkSlotConflict(slotA, slotB) {
  if (slotA.vehicle_id !== slotB.vehicle_id) {
    return false
  }

  const startA = new Date(slotA.start_at)
  const endA = new Date(slotA.end_at)
  const startB = new Date(slotB.start_at)
  const endB = new Date(slotB.end_at)

  return hasTimeConflict(startA, endA, startB, endB)
}

/**
 * サーバー側での競合チェック（データベースから取得）
 */
export async function checkConflictInDatabase(vehicleId, startAt, endAt, excludeSlotId = null) {
  if (!supabase) {
    return { hasConflict: false, conflictingSlot: null, error: new Error('Supabase client not initialized') }
  }

  try {
    let query = supabase
      .from('dispatch_slots')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'CONFIRMED') // 確定済みスロットのみチェック

    if (excludeSlotId) {
      query = query.neq('id', excludeSlotId)
    }

    const { data: slots, error } = await query

    if (error) throw error

    // 各スロットと競合チェック
    for (const slot of slots) {
      const slotStart = new Date(slot.start_at)
      const slotEnd = new Date(slot.end_at)
      const newStart = new Date(startAt)
      const newEnd = new Date(endAt)

      if (hasTimeConflict(newStart, newEnd, slotStart, slotEnd)) {
        return { hasConflict: true, conflictingSlot: slot }
      }
    }

    return { hasConflict: false, conflictingSlot: null }
  } catch (error) {
    console.error('Error checking conflict:', error)
    return { hasConflict: false, conflictingSlot: null, error }
  }
}

/**
 * 車両の全競合スロットを取得
 */
export async function getConflictsForVehicle(vehicleId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data: slots, error } = await supabase
      .from('dispatch_slots')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('start_at', { ascending: true })

    if (error) throw error

    const conflicts = []
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (checkSlotConflict(slots[i], slots[j])) {
          conflicts.push(slots[i], slots[j])
        }
      }
    }

    return { data: conflicts, error: null }
  } catch (error) {
    console.error('Error getting conflicts:', error)
    return { data: null, error }
  }
}

