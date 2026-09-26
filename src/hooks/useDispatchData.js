import { useCallback, useEffect, useMemo, useState } from 'react'
import { getOrders } from '@/services/orderService'
import { getVehicles } from '@/services/vehicleService'
import { getSlotsInRange } from '@/services/slotService'
import {
  getVehicleOperationStatuses,
  syncOperationStatusFromShifts,
} from '@/services/vehicleOperationService'
import { getShiftsByDate } from '@/services/shiftService'
import { supabase } from '@/lib/supabase'
import { resolveNightOperationStatuses } from '@/lib/reservation/dispatchableNight'
import { formatWorkDateKey, getBusinessDayBoundaries, getNightRangeFromWorkDateKey } from '@/utils/businessDayUtils'
import { getEarliestAvailableTimeWithSlots } from '@/utils/earliestTimeUtils'
import { formatBusinessDay } from '@/utils/timeUtils'

/**
 * DispatchBoard の「データ層」を 1 つの hook に集約。
 *
 * - orders / vehicles / slots / operationStatuses のロードと state
 * - 選択中の営業夜のスロット・稼働状況・シフト
 * - Supabase Realtime の購読
 */
export function useDispatchData(nightDate) {
  const [orders, setOrders] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [slots, setSlots] = useState([])
  const [slotsNight, setSlotsNight] = useState(null)
  const [operationStatuses, setOperationStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const nightRange = useMemo(() => getNightRangeFromWorkDateKey(nightDate), [nightDate])
  const businessDate = nightRange.businessDay
  const businessDayText = useMemo(() => {
    if (!businessDate) return ''
    const labelAt = new Date(
      businessDate.getFullYear(),
      businessDate.getMonth(),
      businessDate.getDate(),
      20,
      0,
      0,
      0
    )
    return formatBusinessDay(labelAt)
  }, [businessDate])

  const earliestAvailableTime = useMemo(() => {
    return getEarliestAvailableTimeWithSlots(vehicles, slots, 30, operationStatuses)
  }, [vehicles, slots, operationStatuses])

  const loadOperationStatuses = useCallback(
    async (vehiclesList) => {
      if (!vehiclesList || vehiclesList.length === 0 || !nightDate) {
        setOperationStatuses({})
        return
      }
      try {
        const vehicleIds = vehiclesList.map((v) => v.id)
        const { data, error: opError } = await getVehicleOperationStatuses(vehicleIds, nightDate)
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
    },
    [nightDate]
  )

  const loadSlots = useCallback(
    async (vehiclesList) => {
      const loadingFor = nightDate
      if (!vehiclesList || vehiclesList.length === 0) {
        setSlots([])
        setSlotsNight(loadingFor)
        return
      }
      const { start, end } = getNightRangeFromWorkDateKey(nightDate)
      if (!start || !end) {
        setSlots([])
        setSlotsNight(loadingFor)
        return
      }
      try {
        const { data, error: slotError } = await getSlotsInRange(start, end)
        if (slotError) {
          setSlots([])
          setSlotsNight(loadingFor)
          return
        }
        setSlots(data || [])
        setSlotsNight(loadingFor)
      } catch {
        setSlots([])
        setSlotsNight(loadingFor)
      }
    },
    [nightDate]
  )

  const syncNightOperations = useCallback(
    async (vehiclesList) => {
      if (!vehiclesList?.length || !nightDate) {
        setOperationStatuses({})
        return
      }
      const currentKey = formatWorkDateKey(getBusinessDayBoundaries().businessDay)
      const { data: shiftsByCar, error: shiftsError } = await getShiftsByDate(nightDate)
      const shifts = shiftsError ? {} : shiftsByCar || {}

      if (nightDate === currentKey) {
        await syncOperationStatusFromShifts(vehiclesList, nightDate, shifts)
        await loadOperationStatuses(vehiclesList)
        return
      }

      const vehicleIds = vehiclesList.map((vehicle) => vehicle.id)
      const { data: stored } = await getVehicleOperationStatuses(vehicleIds, nightDate)
      setOperationStatuses(
        resolveNightOperationStatuses({
          vehicles: vehiclesList,
          storedByVehicleId: stored || {},
          shiftsByCar: shifts,
          dateStr: nightDate,
        })
      )
    },
    [nightDate, loadOperationStatuses]
  )

  const loadVehiclesAndOrders = useCallback(async () => {
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
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading data:', err)
      setError(`データの読み込みに失敗: ${err.message}`)
      setOrders([])
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    await loadVehiclesAndOrders()
  }, [loadVehiclesAndOrders])

  useEffect(() => {
    loadVehiclesAndOrders()
  }, [loadVehiclesAndOrders])

  useEffect(() => {
    setSlotsNight(null)
  }, [nightDate])

  useEffect(() => {
    if (vehicles.length === 0) {
      setSlots([])
      setSlotsNight(nightDate)
      setOperationStatuses({})
      return
    }
    loadSlots(vehicles)
    syncNightOperations(vehicles)
  }, [vehicles, nightDate, loadSlots, syncNightOperations])

  useEffect(() => {
    if (!supabase) return

    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadVehiclesAndOrders()
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
          if (vehicles.length > 0) syncNightOperations(vehicles)
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
          const shiftDate = payload.new?.date || payload.old?.date
          if (shiftDate && shiftDate !== nightDate) return
          try {
            await syncNightOperations(vehicles)
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
  }, [
    vehicles,
    nightDate,
    loadVehiclesAndOrders,
    loadSlots,
    syncNightOperations,
  ])

  return {
    orders,
    vehicles,
    slots,
    slotsNight,
    operationStatuses,
    loading,
    error,
    setError,
    setOrders,
    setSlots,
    loadData,
    loadSlots,
    loadOperationStatuses,
    syncNightOperations,
    earliestAvailableTime,
    businessDayText,
    businessDate,
  }
}
