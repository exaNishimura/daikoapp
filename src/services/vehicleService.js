import { supabase } from '@/lib/supabase'
import { getVehicleOperationStatuses } from './vehicleOperationService'
import { getOperationalVehicles } from '@/utils/operationStatusUtils'

/**
 * 全車両取得
 * @param {Object} options - オプション
 * @param {Date} options.targetTime - 稼働状況を判定する時刻（指定しない場合は全車両を返す）
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getVehicles(options = {}) {
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

    // 稼働状況チェックが指定されている場合
    if (options.targetTime) {
      const vehicleIds = (data || []).map(v => v.id)
      const today = new Date(options.targetTime)
      const todayStr = today.toISOString().split('T')[0]

      // 稼働状況を取得
      const { data: operationStatusesMap, error: statusError } = await getVehicleOperationStatuses(vehicleIds, todayStr)

      if (statusError) {
        // エラーが発生した場合は全車両を返す（フォールバック）
        return { data, error: null }
      }

      // 稼働中の車両のみをフィルタ
      const operationalVehicles = getOperationalVehicles(data || [], options.targetTime, operationStatusesMap || {})
      return { data: operationalVehicles, error: null }
    }

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
 * 車両更新
 */
export async function updateVehicle(vehicleId, updates) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating vehicle:', error)
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

