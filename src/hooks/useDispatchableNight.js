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
import { formatWorkDateKey, getBusinessDayBoundaries, getNightRangeFromWorkDateKey } from '@/utils/businessDayUtils'

const EMPTY_VEHICLES = []
const EMPTY_MAP = {}
const EMPTY_SLOTS = []

/**
 * 指定した営業夜の配車可能 15 分枠。
 * 当夜も翌日以降も、稼働状況とスロットの重なりを見る。
 * @param {string} nightDate YYYY-MM-DD
 * @param {{ allowSlot?: { date: string, hour: number, minute: number } | null, now?: Date }} [options]
 */
export function useDispatchableNight(nightDate, options = {}) {
  const { allowSlot = null, now, boardSlots = null, boardNight = null } = options
  const useBoardSlots = Array.isArray(boardSlots) && boardNight === nightDate
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
  const { start, end } = getNightRangeFromWorkDateKey(nightDate)
  const occupancyQuery = useSlotsInRange(start, end, {
    enabled: Boolean(nightDate) && !useBoardSlots,
  })

  const isLoading =
    Boolean(nightDate) &&
    (vehiclesQuery.isPending ||
      shiftsQuery.isPending ||
      (vehicleIds.length > 0 && statusesQuery.isPending) ||
      (!useBoardSlots && occupancyQuery.isLoading))

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
      existingSlots: useBoardSlots ? boardSlots : (occupancyQuery.data ?? EMPTY_SLOTS),
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
    useBoardSlots,
    boardSlots,
    occupancyQuery.data,
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
