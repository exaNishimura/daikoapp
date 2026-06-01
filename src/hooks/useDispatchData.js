import { useCallback, useEffect, useMemo, useState } from 'react'
import { getOrders } from '@/services/orderService'
import { getVehicles } from '@/services/vehicleService'
import { getSlotsByVehicleAndDate } from '@/services/slotService'
import {
  getVehicleOperationStatuses,
  syncOperationStatusFromShifts,
} from '@/services/vehicleOperationService'
import { getShiftsByDate } from '@/services/shiftService'
import { supabase } from '@/lib/supabase'
import { getBusinessDayBoundaries } from '@/utils/businessDayUtils'
import { getEarliestAvailableTimeWithSlots } from '@/utils/earliestTimeUtils'
import { formatBusinessDay } from '@/utils/timeUtils'

/**
 * DispatchBoard の「データ層」を 1 つの hook に集約。
 *
 * - orders / vehicles / slots / operationStatuses のロードと state
 * - Supabase Realtime の購読 (orders, dispatch_slots,
 *   vehicle_operation_status, shifts の 4 channel)
 * - シフト変更時に稼働状況を syncOperationStatusFromShifts で
 *   自動同期する処理
 * - earliestAvailableTime と businessDayText の派生
 *
 * setOrders / setSlots は楽観的更新のために露出している。
 */
export function useDispatchData() {
  const [orders, setOrders] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [slots, setSlots] = useState([])
  const [operationStatuses, setOperationStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const businessDate = useMemo(() => new Date(), [])
  const businessDayText = useMemo(() => formatBusinessDay(businessDate), [businessDate])

  const earliestAvailableTime = useMemo(() => {
    return getEarliestAvailableTimeWithSlots(vehicles, slots, 30, operationStatuses)
  }, [vehicles, slots, operationStatuses])

  const loadOperationStatuses = useCallback(async (vehiclesList) => {
    if (!vehiclesList || vehiclesList.length === 0) {
      setOperationStatuses({})
      return
    }
    try {
      const vehicleIds = vehiclesList.map((v) => v.id)
      const todayStr = new Date().toISOString().split('T')[0]
      const { data, error: opError } = await getVehicleOperationStatuses(vehicleIds, todayStr)
      if (opError) {
        if (import.meta.env.DEV) console.error('Error loading operation statuses:', opError)
        setOperationStatuses({})
      } else {
        setOperationStatuses(data || {})
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading operation statuses:', err)
      setOperationStatuses({})
    }
  }, [])

  const loadSlots = useCallback(async (vehiclesList) => {
    const { start, end } = getBusinessDayBoundaries(new Date())
    const allSlots = []
    for (const vehicle of vehiclesList) {
      try {
        const { data, error: slotError } = await getSlotsByVehicleAndDate(vehicle.id, start, end)
        if (slotError) continue
        if (data) allSlots.push(...data)
      } catch {
        continue
      }
    }
    setSlots(allSlots)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordersResult, vehiclesResult] = await Promise.all([getOrders(), getVehicles()])

      if (ordersResult.error) {
        if (import.meta.env.DEV) console.error('Error loading orders:', ordersResult.error)
        setError(`依頼データの読み込みに失敗: ${ordersResult.error.message || ordersResult.error}`)
        setOrders([])
      } else {
        setOrders(ordersResult.data || [])
      }

      if (vehiclesResult.error) {
        if (import.meta.env.DEV) console.error('Error loading vehicles:', vehiclesResult.error)
        setError(
          `車両データの読み込みに失敗: ${vehiclesResult.error.message || vehiclesResult.error}`
        )
        setVehicles([])
      } else {
        setVehicles(vehiclesResult.data || [])
        if (vehiclesResult.data && vehiclesResult.data.length > 0) {
          loadSlots(vehiclesResult.data)

          // シフトから稼働状況を自動生成
          const todayStr = new Date().toISOString().split('T')[0]
          getShiftsByDate(todayStr).then(({ data: shiftsByCar, error: shiftsError }) => {
            if (!shiftsError && shiftsByCar) {
              syncOperationStatusFromShifts(vehiclesResult.data, todayStr, shiftsByCar).then(() => {
                loadOperationStatuses(vehiclesResult.data)
              })
            } else {
              loadOperationStatuses(vehiclesResult.data)
            }
          })
        } else {
          setSlots([])
          setOperationStatuses({})
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading data:', err)
      setError(`データの読み込みに失敗: ${err.message}`)
      setOrders([])
      setVehicles([])
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [loadSlots, loadOperationStatuses])

  // 初期ロード
  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime: orders / dispatch_slots / vehicle_operation_status / shifts
  useEffect(() => {
    if (!supabase) return

    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData()
      })
      .subscribe()

    const slotsChannel = supabase
      .channel('slots-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_slots' }, () => {
        if (vehicles.length > 0) loadSlots(vehicles)
      })
      .subscribe()

    const operationStatusChannel = supabase
      .channel('operation-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_operation_status' },
        () => {
          if (vehicles.length > 0) loadOperationStatuses(vehicles)
        }
      )
      .subscribe()

    const shiftsChannel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        async (payload) => {
          if (vehicles.length === 0) return
          try {
            const todayStr = new Date().toISOString().split('T')[0]
            const shiftDate = payload.new?.date || payload.old?.date || todayStr

            const { data: shiftsByCar, error: shiftsError } = await getShiftsByDate(shiftDate)
            if (shiftsError) {
              if (import.meta.env.DEV) console.error('Error fetching shifts for sync:', shiftsError)
              return
            }

            const { error: syncError } = await syncOperationStatusFromShifts(
              vehicles,
              shiftDate,
              shiftsByCar || {}
            )
            if (syncError) {
              if (import.meta.env.DEV) {
                console.error('Error syncing operation status from shifts:', syncError)
              }
            } else {
              await loadOperationStatuses(vehicles)
            }
          } catch (err) {
            if (import.meta.env.DEV) console.error('Error handling shift change:', err)
          }
        }
      )
      .subscribe()

    return () => {
      ordersChannel.unsubscribe()
      slotsChannel.unsubscribe()
      operationStatusChannel.unsubscribe()
      shiftsChannel.unsubscribe()
    }
  }, [vehicles, loadData, loadSlots, loadOperationStatuses])

  return {
    orders,
    vehicles,
    slots,
    operationStatuses,
    loading,
    error,
    setError,
    setOrders,
    setSlots,
    loadData,
    loadSlots,
    loadOperationStatuses,
    earliestAvailableTime,
    businessDayText,
    businessDate,
  }
}
