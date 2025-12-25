import { supabase } from '@/lib/supabase'

/**
 * 全車両取得
 */
export async function getVehicles() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return { data: null, error }
  }
}

/**
 * 車両作成
 */
export async function createVehicle(vehicleData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicleData])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return { data: null, error }
  }
}

/**
 * 車両削除（名前で検索して削除）
 */
export async function deleteVehicleByName(name) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    // まず該当する車両を検索
    const { data: vehicles, error: searchError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('name', name)
      .limit(1)

    if (searchError) throw searchError

    if (!vehicles || vehicles.length === 0) {
      return { data: null, error: new Error(`車両 "${name}" が見つかりません`) }
    }

    // 削除実行
    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicles[0].id)

    if (deleteError) throw deleteError
    return { data: { id: vehicles[0].id }, error: null }
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    return { data: null, error }
  }
}

