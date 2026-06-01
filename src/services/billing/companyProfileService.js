import { supabase } from '@/lib/supabase'

/**
 * 自社情報 (company_profile) のシングルトン CRUD。
 * id は常に 1 (CHECK 制約で保証)。
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

export async function getCompanyProfile() {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('company_profile')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching company_profile:', error)
    return { data: null, error }
  }
}

/**
 * UPSERT (id=1)。請求書発行時に snapshot するので必ず存在させておく。
 */
export async function upsertCompanyProfile(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('company_profile')
      .upsert({ ...payload, id: 1 }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error upserting company_profile:', error)
    return { data: null, error }
  }
}
