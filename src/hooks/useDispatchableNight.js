import { useMemo } from 'react'
import {
  OCCUPANCY_DURATION_MIN,
  buildDispatchableSlots,
  resolveNightOperationStatuses,
} from '@/lib/reservation/dispatchableNight'
import { useShiftsByDate } from '@/hooks/useShifts'
import { useSlotsInRange } from '@/hooks/useDispatchSlots'
import { useVehicleOperationStatuses } from '@/hooks/useVehicleOperations'
import { useVehicles } from '@/hooks/useVehicles'
import { formatWorkDateKey, getBusinessDayBoundaries } from '@/utils/businessDayUtils'

const EMPTY_VEHICLES = []
const EMPTY_MAP = {}
const EMPTY_SLOTS = []

function nightRange(nightDate) {
  if (!nightDate) return { start: null, end: null }
  const [year, month, day] = nightDate.split('-').map(Number)
  if (!year || !month || !day) return { start: null, end: null }
  return {
    start: new Date(year, month - 1, day, 18, 0, 0, 0),
    end: new Date(year, month - 1, day + 1, 6, 0, 0, 0),
  }
}

/**
 * 指定した営業夜の配車可能 15 分枠。
 * 当営業夜は配車スロットの空きも見る。翌日以降は稼働状況のみ。
 * @param {string} nightDate YYYY-MM-DD
 * @param {{ allowSlot?: { date: string, hour: number, minute: number } | null, now?: Date }} [options]
 */
export function useDispatchableNight(nightDate, options = {}) {
  const { allowSlot = null, now } = options
  const vehiclesQuery = useVehicles()
  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES
  const vehicleIds = vehicles.map((vehicle) => vehicle.id)

  const currentNightKey = formatWorkDateKey(
    getBusinessDayBoundaries(now ?? new Date()).businessDay
  )
  const isCurrentNight = Boolean(nightDate) && nightDate === currentNightKey
  const isFutureNight = Boolean(nightDate) && nightDate > currentNightKey

  const statusesQuery = useVehicleOperationStatuses(vehicleIds, nightDate)
  const shiftsQuery = useShiftsByDate(nightDate)
  const { start, end } = nightRange(nightDate)
  const occupancyQuery = useSlotsInRange(start, end, { enabled: Boolean(nightDate) })

  const isLoading =
    Boolean(nightDate) &&
    (vehiclesQuery.isPending ||
      shiftsQuery.isPending ||
      (vehicleIds.length > 0 && statusesQuery.isPending) ||
      occupancyQuery.isLoading)

  const statusesMap = useMemo(() => {
    if (!nightDate || isLoading) return {}
    return resolveNightOperationStatuses({
      vehicles,
      storedByVehicleId: statusesQuery.data ?? EMPTY_MAP,
      shiftsByCar: shiftsQuery.data ?? EMPTY_MAP,
      dateStr: nightDate,
    })
  }, [nightDate, isLoading, vehicles, statusesQuery.data, shiftsQuery.data])

  const slots = useMemo(() => {
    if (!nightDate || isLoading) return []
    return buildDispatchableSlots({
      nightDate,
      vehicles,
      statusesMap,
      now: now ?? new Date(),
      allowSlot,
      existingSlots: occupancyQuery.data ?? EMPTY_SLOTS,
      durationMin: OCCUPANCY_DURATION_MIN,
      checkOccupancy: true,
    })
  }, [
    nightDate,
    isLoading,
    vehicles,
    statusesMap,
    now,
    allowSlot,
    occupancyQuery.data,
    isCurrentNight,
  ])

  return {
    slots,
    isLoading,
    vehicles,
    statusesMap,
    isCurrentNight,
    isFutureNight,
  }
}
