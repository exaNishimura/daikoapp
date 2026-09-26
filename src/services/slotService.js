import { supabase } from '@/lib/supabase'
import { checkConflictInDatabase } from '@/services/conflictDetectionService'

/**
 * 依頼に紐づくスロット
 */
export async function getSlotsByOrderId(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  try {
    const { data, error } = await supabase
      .from('dispatch_slots')
      .select('*')
      .eq('order_id', orderId)
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching slots by order:', error)
    return { data: null, error }
  }
}

/**
 * スロット作成
 */
export async function createSlot(slotData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('dispatch_slots')
      .insert([slotData])
      .select()
      .single()

    if (error) throw error

    // 依頼ステータスをTENTATIVEに更新
    await supabase.from('orders').update({ status: 'TENTATIVE' }).eq('id', slotData.order_id)

    return { data, error: null }
  } catch (error) {
    console.error('Error creating slot:', error)
    return { data: null, error }
  }
}

/**
 * スロット更新
 */
export async function updateSlot(id, updates) {
  try {
    const { data, error } = await supabase
      .from('dispatch_slots')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating slot:', error)
    return { data: null, error }
  }
}

/**
 * スロット確定
 */
export async function confirmSlot(id) {
  try {
    const { data: current, error: fetchError } = await supabase
      .from('dispatch_slots')
      .select('id, vehicle_id, start_at, end_at, order_id')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError

    const conflict = await checkConflictInDatabase(
      current.vehicle_id,
      current.start_at,
      current.end_at,
      current.id
    )
    if (conflict.error) return { data: null, error: conflict.error }
    if (conflict.hasConflict) {
      return { data: null, error: new Error('確定済みの配車と時間が重なっています') }
    }

    const { data, error } = await supabase
      .from('dispatch_slots')
      .update({ status: 'CONFIRMED' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // 依頼ステータスをCONFIRMEDに更新
    if (data) {
      await supabase.from('orders').update({ status: 'CONFIRMED' }).eq('id', data.order_id)
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error confirming slot:', error)
    return { data: null, error }
  }
}

/**
 * スロット削除
 */
export async function deleteSlot(id) {
  try {
    // スロットに紐づく依頼IDを取得
    const { data: slot } = await supabase
      .from('dispatch_slots')
      .select('order_id')
      .eq('id', id)
      .single()

    // スロット削除
    const { error } = await supabase.from('dispatch_slots').delete().eq('id', id)

    if (error) throw error

    // 依頼ステータスをUNASSIGNEDに更新
    if (slot) {
      await supabase.from('orders').update({ status: 'UNASSIGNED' }).eq('id', slot.order_id)
    }

    return { error: null }
  } catch (error) {
    console.error('Error deleting slot:', error)
    return { error }
  }
}

/**
 * 車両IDと日付範囲でスロット取得
 */
export async function getSlotsByVehicleAndDate(vehicleId, startDate, endDate) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const startDateStr = startDate.toISOString()
    const endDateStr = endDate.toISOString()

    const { data: allSlotsInDB, error: allError } = await supabase
      .from('dispatch_slots')
      .select('*')
      .order('start_at', { ascending: true })

    if (allError) {
      // エラーでも続行（空配列として扱う）
    }

    // 指定されたvehicle_idのスロットをフィルタリング
    const allSlots = (allSlotsInDB || []).filter((slot) => slot.vehicle_id === vehicleId)

    // スロットが日付範囲と重複しているかをチェック
    // 重複条件: start_at <= endDate AND end_at >= startDate
    // クライアント側でフィルタリングして確実に取得

    const queryStart = new Date(startDateStr)
    const queryEnd = new Date(endDateStr)

    // すべてのスロットから重複しているものをフィルタリング
    const filteredSlots = (allSlots || []).filter((slot) => {
      const slotStart = new Date(slot.start_at)
      const slotEnd = new Date(slot.end_at)
      // 重複条件: start_at <= endDate AND end_at >= startDate
      const condition1 = slotStart <= queryEnd
      const condition2 = slotEnd >= queryStart
      const overlaps = condition1 && condition2

      return overlaps
    })

    return { data: filteredSlots, error: null }
  } catch (error) {
    console.error('Error fetching slots:', error)
    return { data: null, error }
  }
}

/**
 * 日付範囲と重なる全車両のスロット
 */
export async function getSlotsInRange(startDate, endDate) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('dispatch_slots')
      .select('*')
      .lt('start_at', endDate.toISOString())
      .gt('end_at', startDate.toISOString())
      .order('start_at', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching slots in range:', error)
    return { data: null, error }
  }
}
