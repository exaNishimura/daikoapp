import { supabase } from '@/lib/supabase'

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

export async function getStaffRates() {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('staff_rates')
      .select('*')
      .order('display_order', { ascending: true })
      .order('staff_name', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching staff_rates:', error)
    return { data: null, error }
  }
}

export async function upsertStaffRate(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('staff_rates')
      .upsert(payload, { onConflict: 'staff_name' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error upserting staff_rates:', error)
    return { data: null, error }
  }
}

export async function deleteStaffRate(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase.from('staff_rates').delete().eq('id', id)
    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error deleting staff_rates:', error)
    return { data: null, error }
  }
}
