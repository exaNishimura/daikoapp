import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicleByName,
} from '@/services/vehicleService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 全車両を取得
 * @param {Object} options
 * @param {Date} [options.targetTime] - 稼働中車両のみフィルタする時刻
 */
export function useVehicles(options = {}) {
  const { targetTime } = options
  return useQuery({
    queryKey: targetTime
      ? ['vehicles', 'list', { targetTime: targetTime.toISOString() }]
      : queryKeys.vehicles.list(),
    queryFn: () => unwrap(getVehicles(targetTime ? { targetTime } : {})),
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vehicleData) => unwrap(createVehicle(vehicleData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all })
    },
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicleId, updates }) => unwrap(updateVehicle(vehicleId, updates)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all })
    },
  })
}

export function useDeleteVehicleByName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name) => unwrap(deleteVehicleByName(name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all })
    },
  })
}
