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
        shift => !shift.car && (shift.status === '休業' || shift.status === '定休日')
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
          if (process.env.NODE_ENV === 'development') {
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
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error setting DAY_OFF for vehicle ${vehicle.id}:`, dayOffError)
          }
        } else {
          results.push({ vehicleId: vehicle.id, type: 'DAY_OFF' })
        }
        continue
      }

      // シフトがある場合、startとendを分析してSTOP/STARTを設定
      // 営業時間は18:00-06:00（翌日）
      // シフトのstartとendは既に営業時間内（18:00-06:00）の時間帯になっていると仮定
      
      // シフトのstartとendを時刻（分）に変換してソート
      const shiftTimes = vehicleShifts
        .filter(shift => shift.start && shift.end)
        .map(shift => {
          const [startHour, startMin] = shift.start.split(':').map(Number)
          const [endHour, endMin] = shift.end.split(':').map(Number)
          // 時刻を分に変換（endが06:00以前の場合は翌日として扱う）
          let startMinutes = startHour * 60 + startMin
          let endMinutes = endHour * 60 + endMin
          
          // 営業時間は18:00-06:00（翌日）なので、endが06:00以前の場合は翌日として扱う
          if (endMinutes < 6 * 60 && startMinutes >= 18 * 60) {
            endMinutes += 24 * 60 // 翌日の時刻として扱う
          }
          
          return {
            start: startMinutes,
            end: endMinutes,
          }
        })
        .sort((a, b) => a.start - b.start)

      // 営業時間の開始（18:00 = 1080分）と終了（翌日の06:00 = 1440分）
      const businessStart = 18 * 60 // 1080分
      const businessEnd = 24 * 60 + 6 * 60 // 1440分（翌日の06:00）

      if (shiftTimes.length === 0) {
        // シフトのstart/endがない場合はDAY_OFF（その日は稼働しない）
        const { error: dayOffError } = await setVehicleOperationStatus(vehicle.id, {
          type: 'DAY_OFF',
          date: dateStr,
          time: null,
        })
        if (dayOffError) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error setting DAY_OFF for vehicle ${vehicle.id}:`, dayOffError)
          }
        } else {
          results.push({ vehicleId: vehicle.id, type: 'DAY_OFF' })
        }
      } else {
        // 最初のシフトの開始時刻が18:00より後なら、18:00からSTART
        const firstShiftStart = shiftTimes[0].start
        if (firstShiftStart > businessStart) {
          const startTime = '18:00'
          const { error: startError } = await setVehicleOperationStatus(vehicle.id, {
            type: 'START',
            date: dateStr,
            time: startTime,
          })
          if (startError) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`Error setting START for vehicle ${vehicle.id}:`, startError)
            }
          } else {
            results.push({ vehicleId: vehicle.id, type: 'START', time: startTime })
          }
        }

        // 最後のシフトの終了時刻が06:00より前なら、その時刻でSTOP
        const lastShiftEnd = shiftTimes[shiftTimes.length - 1].end
        // endが1440分（24:00）を超える場合は翌日の時刻として扱う
        const actualEnd = lastShiftEnd >= 24 * 60 ? lastShiftEnd - 24 * 60 : lastShiftEnd
        if (actualEnd < 6 * 60) {
          const stopHour = Math.floor(actualEnd / 60)
          const stopMin = actualEnd % 60
          const stopTime = `${stopHour.toString().padStart(2, '0')}:${stopMin.toString().padStart(2, '0')}`
          const { error: stopError } = await setVehicleOperationStatus(vehicle.id, {
            type: 'STOP',
            date: dateStr,
            time: stopTime,
          })
          if (stopError) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`Error setting STOP for vehicle ${vehicle.id}:`, stopError)
            }
          } else {
            results.push({ vehicleId: vehicle.id, type: 'STOP', time: stopTime })
          }
        }

        // シフト間の隙間を検出してSTOP/STARTを設定
        for (let i = 0; i < shiftTimes.length - 1; i++) {
          const currentEnd = shiftTimes[i].end
          const nextStart = shiftTimes[i + 1].start
          
          // シフト間に隙間がある場合（15分以上の隙間）
          if (nextStart - currentEnd >= 15) {
            // 前のシフトの終了時刻でSTOP
            const stopMinutes = currentEnd >= 24 * 60 ? currentEnd - 24 * 60 : currentEnd
            const stopHour = Math.floor(stopMinutes / 60)
            const stopMin = stopMinutes % 60
            const stopTime = `${stopHour.toString().padStart(2, '0')}:${stopMin.toString().padStart(2, '0')}`
            const { error: stopError } = await setVehicleOperationStatus(vehicle.id, {
              type: 'STOP',
              date: dateStr,
              time: stopTime,
            })
            if (stopError) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`Error setting STOP for vehicle ${vehicle.id}:`, stopError)
              }
            } else {
              results.push({ vehicleId: vehicle.id, type: 'STOP', time: stopTime })
            }

            // 次のシフトの開始時刻でSTART
            const startMinutes = nextStart >= 24 * 60 ? nextStart - 24 * 60 : nextStart
            const startHour = Math.floor(startMinutes / 60)
            const startMin = startMinutes % 60
            const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`
            const { error: startError } = await setVehicleOperationStatus(vehicle.id, {
              type: 'START',
              date: dateStr,
              time: startTime,
            })
            if (startError) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`Error setting START for vehicle ${vehicle.id}:`, startError)
              }
            } else {
              results.push({ vehicleId: vehicle.id, type: 'START', time: startTime })
            }
          }
        }
      }
    }

    return { data: results, error: null }
  } catch (error) {
    console.error('Error syncing operation status from shifts:', error)
    return { data: null, error }
  }
}

