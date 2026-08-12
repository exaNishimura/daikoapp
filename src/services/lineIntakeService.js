import { supabase } from '@/lib/supabase'

const FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : ''

/**
 * Edge Function line-intake-api を呼ぶ
 * @param {object} body
 */
export async function callLineIntakeApi(body) {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!FUNCTIONS_BASE) {
    return { data: null, error: new Error('VITE_SUPABASE_URL not configured') }
  }

  try {
    const {
      data: { session },
    } = supabase ? await supabase.auth.getSession() : { data: { session: null } }

    const res = await fetch(`${FUNCTIONS_BASE}/line-intake-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || anon}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: null, error: new Error(data.error || `HTTP ${res.status}`), status: res.status, raw: data }
    }
    return { data, error: null }
  } catch (error) {
    console.error('lineIntakeApi error:', error)
    return { data: null, error }
  }
}

export async function listLineHoldingUnits() {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') }
  try {
    const { data, error } = await supabase
      .from('line_booking_units')
      .select('*, line_bookings(*)')
      .in('status', ['HOLDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error(error)
    return { data: null, error }
  }
}

export async function getLineIntakeSettings() {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') }
  try {
    const { data, error } = await supabase.from('line_intake_settings').select('*').eq('id', 1).single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function listMyLineUnits(lineUserId) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') }
  try {
    const { data: bookings, error: bErr } = await supabase
      .from('line_bookings')
      .select('id')
      .eq('line_user_id', lineUserId)
    if (bErr) throw bErr
    const ids = (bookings || []).map((b) => b.id)
    if (!ids.length) return { data: [], error: null }
    const { data, error } = await supabase
      .from('line_booking_units')
      .select('*')
      .in('booking_id', ids)
      .in('status', ['HOLDING', 'CONFIRMED'])
      .order('pickup_at', { ascending: true })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * 電話優先ロック作成（確保 / 否決帯を LINE 不可にする）
 */
export async function createPhonePriorityLock({
  businessDay,
  startAt,
  endAt,
  reason,
  sourceOrderId = null,
  createdBy = null,
}) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') }
  try {
    const { data, error } = await supabase
      .from('phone_priority_locks')
      .insert([
        {
          business_day: businessDay,
          start_at: startAt,
          end_at: endAt,
          reason,
          source_order_id: sourceOrderId,
          created_by: createdBy,
        },
      ])
      .select('*')
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error(error)
    return { data: null, error }
  }
}
