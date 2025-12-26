import { supabase } from '@/lib/supabase'

/**
 * 指定車両・指定日の稼働状況を取得
 * @param {string} vehicleId - 車両ID
 * @param {Date|string} date - 日付（Dateオブジェクトまたは'YYYY-MM-DD'形式の文字列）
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getVehicleOperationStatus(vehicleId, date) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    // dateを'YYYY-MM-DD'形式の文字列に変換
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date

    const { data, error } = await supabase
      .from('vehicle_operation_status')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('date', dateStr)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching vehicle operation status:', error)
    return { data: null, error }
  }
}

/**
 * 複数車両・指定日の稼働状況を一括取得
 * @param {Array<string>} vehicleIds - 車両IDの配列
 * @param {Date|string} date - 日付
 * @returns {Promise<{data: Object|null, error: Error|null}>} vehicleIdをキーとしたオブジェクト
 */
export async function getVehicleOperationStatuses(vehicleIds, date) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date

    const { data, error } = await supabase
      .from('vehicle_operation_status')
      .select('*')
      .in('vehicle_id', vehicleIds)
      .eq('date', dateStr)
      .order('created_at', { ascending: true })

    if (error) throw error

    // vehicleIdをキーとしたオブジェクトに変換
    const result = {}
    vehicleIds.forEach(id => {
      result[id] = (data || []).filter(status => status.vehicle_id === id)
    })

    return { data: result, error: null }
  } catch (error) {
    console.error('Error fetching vehicle operation statuses:', error)
    return { data: null, error }
  }
}

/**
 * 稼働状況を設定（INSERT/UPDATE）
 * @param {string} vehicleId - 車両ID
 * @param {Object} statusData - 稼働状況データ
 * @param {string} statusData.type - 'DEFAULT' | 'DAY_OFF' | 'STOP' | 'START'
 * @param {Date|string} statusData.date - 日付
 * @param {string} statusData.time - 時刻（'HH:MM'形式、STOP/STARTの場合必須）
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function setVehicleOperationStatus(vehicleId, statusData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { type, date, time } = statusData

    // バリデーション
    if (!type || !['DEFAULT', 'DAY_OFF', 'STOP', 'START'].includes(type)) {
      return { data: null, error: new Error('Invalid type') }
    }

    if (!date) {
      return { data: null, error: new Error('Date is required') }
    }

    if ((type === 'STOP' || type === 'START') && !time) {
      return { data: null, error: new Error('Time is required for STOP and START types') }
    }

    // dateを'YYYY-MM-DD'形式の文字列に変換
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date

    // timeを'HH:MM'形式に変換（Dateオブジェクトの場合）
    let timeStr = time
    if (time instanceof Date) {
      const hours = String(time.getHours()).padStart(2, '0')
      const minutes = String(time.getMinutes()).padStart(2, '0')
      timeStr = `${hours}:${minutes}`
    }

    // UNIQUE制約により、同じvehicle_id, date, typeの組み合わせは自動的にUPDATEされる
    const { data, error } = await supabase
      .from('vehicle_operation_status')
      .upsert({
        vehicle_id: vehicleId,
        type,
        date: dateStr,
        time: timeStr || null,
      }, {
        onConflict: 'vehicle_id,date,type'
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error setting vehicle operation status:', error)
    return { data: null, error }
  }
}

/**
 * 稼働状況設定を削除
 * @param {string} vehicleId - 車両ID
 * @param {string} statusId - 稼働状況ID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function deleteVehicleOperationStatus(vehicleId, statusId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('vehicle_operation_status')
      .delete()
      .eq('id', statusId)
      .eq('vehicle_id', vehicleId)
      .select()
      .single()

    if (error) throw error
    return { data: { id: statusId }, error: null }
  } catch (error) {
    console.error('Error deleting vehicle operation status:', error)
    return { data: null, error }
  }
}

