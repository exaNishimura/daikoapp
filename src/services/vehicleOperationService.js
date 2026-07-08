import { supabase } from '@/lib/supabase'
import { buildOperationStatusesFromShifts } from '@/utils/shiftOperationUtils'

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
    vehicleIds.forEach((id) => {
      result[id] = (data || []).filter((status) => status.vehicle_id === id)
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
      .upsert(
        {
          vehicle_id: vehicleId,
          type,
          date: dateStr,
          time: timeStr || null,
        },
        {
          onConflict: 'vehicle_id,date,type',
        }
      )
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

/**
 * 指定車両・指定日の稼働状況を一括削除
 * @param {string} vehicleId - 車両ID
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function deleteVehicleOperationStatusesByDate(vehicleId, date) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date

    const { data, error } = await supabase
      .from('vehicle_operation_status')
      .delete()
      .eq('vehicle_id', vehicleId)
      .eq('date', dateStr)
      .select()

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error deleting vehicle operation statuses by date:', error)
    return { data: null, error }
  }
}

/**
 * シフトから稼働状況を自動生成して設定
 * @param {Array} vehicles - 車両リスト
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @param {Array} shifts - シフトデータの配列（carフィールドでグループ化済み）
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function syncOperationStatusFromShifts(vehicles, date, shifts) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date
    const results = []

    // 各車両について処理
    for (const vehicle of vehicles) {
      // 車両名から号車番号を抽出（例: '1号車' → '1'）
      const carNumber = vehicle.name.replace('号車', '').trim()

      // 該当するシフトを取得
      const vehicleShifts = shifts[carNumber] || []

      // その日の全シフトを確認（carがnullの場合も含む）
      const allShiftsForDate = Object.values(shifts).flat()
      const hasDayOffStatus = allShiftsForDate.some(
        (shift) => !shift.car && (shift.status === '休業' || shift.status === '定休日')
      )

      // まず、その日の既存の稼働状況を削除（シフトから自動生成されたもののみ）
      // 注意: 手動で設定されたものも削除される可能性があるため、慎重に実装
      // 今回は、シフトから自動生成する際は既存の設定を全て削除してから再生成する
      await deleteVehicleOperationStatusesByDate(vehicle.id, dateStr)

      // 休業・定休日の場合はDAY_OFFを設定
      if (hasDayOffStatus) {
        const { error: dayOffError } = await setVehicleOperationStatus(vehicle.id, {
          type: 'DAY_OFF',
          date: dateStr,
          time: null,
        })
        if (dayOffError) {
          if (import.meta.env.DEV) {
            console.error(`Error setting DAY_OFF for vehicle ${vehicle.id}:`, dayOffError)
          }
        } else {
          results.push({ vehicleId: vehicle.id, type: 'DAY_OFF' })
        }
        continue
      }

      // シフトがない場合はDAY_OFF（その日は稼働しない）を設定
      if (vehicleShifts.length === 0) {
        const { error: dayOffError } = await setVehicleOperationStatus(vehicle.id, {
          type: 'DAY_OFF',
          date: dateStr,
          time: null,
        })
        if (dayOffError) {
          if (import.meta.env.DEV) {
            console.error(`Error setting DAY_OFF for vehicle ${vehicle.id}:`, dayOffError)
          }
        } else {
          results.push({ vehicleId: vehicle.id, type: 'DAY_OFF' })
        }
        continue
      }

      // シフトがある場合、出勤・退勤時刻から稼働帯を生成
      const statusPlan = buildOperationStatusesFromShifts(vehicleShifts)
      for (const status of statusPlan) {
        const { error: statusError } = await setVehicleOperationStatus(vehicle.id, {
          type: status.type,
          date: dateStr,
          time: status.time,
        })
        if (statusError) {
          if (import.meta.env.DEV) {
            console.error(`Error setting ${status.type} for vehicle ${vehicle.id}:`, statusError)
          }
        } else {
          results.push({
            vehicleId: vehicle.id,
            type: status.type,
            time: status.time,
          })
        }
      }
    }

    return { data: results, error: null }
  } catch (error) {
    console.error('Error syncing operation status from shifts:', error)
    return { data: null, error }
  }
}
