import { useMemo } from 'react'
import {
  buildDispatchableSlots,
  resolveNightOperationStatuses,
} from '@/lib/reservation/dispatchableNight'
import { useShiftsByDate } from '@/hooks/useShifts'
import { useVehicleOperationStatuses } from '@/hooks/useVehicleOperations'
import { useVehicles } from '@/hooks/useVehicles'

const EMPTY_VEHICLES = []
const EMPTY_MAP = {}

/**
 * 指定した営業夜の配車可能 15 分枠。
 * @param {string} nightDate YYYY-MM-DD
 * @param {{ allowSlot?: { date: string, hour: number, minute: number } | null, now?: Date }} [options]
 */
export function useDispatchableNight(nightDate, options = {}) {
  const { allowSlot = null, now } = options
  const vehiclesQuery = useVehicles()
  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES
  const vehicleIds = vehicles.map((vehicle) => vehicle.id)

  const statusesQuery = useVehicleOperationStatuses(vehicleIds, nightDate)
  const shiftsQuery = useShiftsByDate(nightDate)

  const isLoading =
    Boolean(nightDate) &&
    (vehiclesQuery.isPending ||
      shiftsQuery.isPending ||
      (vehicleIds.length > 0 && statusesQuery.isPending))

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
    })
  }, [nightDate, isLoading, vehicles, statusesMap, now, allowSlot])

  return {
    slots,
    isLoading,
    vehicles,
    statusesMap,
  }
}
