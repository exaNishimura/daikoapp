import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getVehicleOperationStatus,
  getVehicleOperationStatuses,
  setVehicleOperationStatus,
  deleteVehicleOperationStatus,
  deleteVehicleOperationStatusesByDate,
  syncOperationStatusFromShifts,
} from '@/services/vehicleOperationService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

const dateKey = (date) =>
  date instanceof Date ? date.toISOString().split('T')[0] : date

/**
 * 指定車両・指定日の稼働状況を取得
 */
export function useVehicleOperationStatus(vehicleId, date) {
  return useQuery({
    queryKey: ['vehicleOperations', 'byVehicle', vehicleId, dateKey(date)],
    queryFn: () => unwrap(getVehicleOperationStatus(vehicleId, date)),
    enabled: Boolean(vehicleId && date),
  })
}

/**
 * 複数車両・指定日の稼働状況を取得
 */
export function useVehicleOperationStatuses(vehicleIds, date) {
  const ids = vehicleIds ?? []
  return useQuery({
    queryKey: ['vehicleOperations', 'byVehicles', [...ids].sort().join(','), dateKey(date)],
    queryFn: () => unwrap(getVehicleOperationStatuses(ids, date)),
    enabled: ids.length > 0 && Boolean(date),
  })
}

export function useSetVehicleOperationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicleId, statusData }) =>
      unwrap(setVehicleOperationStatus(vehicleId, statusData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicleOperations.all })
    },
  })
}

export function useDeleteVehicleOperationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicleId, statusId }) =>
      unwrap(deleteVehicleOperationStatus(vehicleId, statusId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicleOperations.all })
    },
  })
}

export function useDeleteVehicleOperationStatusesByDate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicleId, date }) =>
      unwrap(deleteVehicleOperationStatusesByDate(vehicleId, date)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicleOperations.all })
    },
  })
}

export function useSyncOperationStatusFromShifts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicles, date, shifts }) =>
      unwrap(syncOperationStatusFromShifts(vehicles, date, shifts)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicleOperations.all })
    },
  })
}
