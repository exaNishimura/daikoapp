import { supabase } from '@/lib/supabase'

/**
 * 依頼作成
 */
export async function createOrder(orderData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase.from('orders').insert([orderData]).select().single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating order:', error)
    return { data: null, error }
  }
}

/**
 * 依頼取得（ステータスでフィルタ可能）
 */
export async function getOrders(status = null) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching orders:', error)
    return { data: null, error }
  }
}

/**
 * IDで依頼取得
 */
export async function getOrderById(id) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching order:', error)
    return { data: null, error }
  }
}

/**
 * parking_note の [RESERVATION:uuid] マークから依頼を探す。
 * reservations.order_id カラム未適用時の紐付けフォールバック。
 */
export async function findOrderByReservationMark(reservationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  if (!reservationId) return { data: null, error: null }

  try {
    const mark = `[RESERVATION:${reservationId}]`
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('parking_note', `%${mark}%`)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return { data: data || null, error: null }
  } catch (error) {
    console.error('Error finding order by reservation mark:', error)
    return { data: null, error }
  }
}

/**
 * 依頼更新
 */
export async function updateOrder(id, updates) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating order:', error)
    return { data: null, error }
  }
}

/**
 * 依頼キャンセル（データベースから削除）
 */
export async function cancelOrder(id) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    // データベースから物理的に削除
    // dispatch_slotsはON DELETE CASCADEで自動削除される
    const { error } = await supabase.from('orders').delete().eq('id', id)

    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error cancelling order:', error)
    return { data: null, error }
  }
}
