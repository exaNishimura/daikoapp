import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSlot,
  updateSlot,
  confirmSlot,
  deleteSlot,
  getSlotsByVehicleAndDate,
} from '@/services/slotService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 車両IDと日付範囲でスロット取得
 * @param {string} vehicleId
 * @param {Date} startDate
 * @param {Date} endDate
 */
export function useSlotsByVehicleAndDate(vehicleId, startDate, endDate) {
  return useQuery({
    queryKey: [
      'dispatchSlots',
      'byVehicle',
      vehicleId,
      startDate?.toISOString() ?? null,
      endDate?.toISOString() ?? null,
    ],
    queryFn: () => unwrap(getSlotsByVehicleAndDate(vehicleId, startDate, endDate)),
    enabled: Boolean(vehicleId && startDate && endDate),
  })
}

/**
 * スロット系 mutation の共通成功処理
 * - dispatch_slots と orders の両方を再取得（slot 操作は order ステータスも変更するため）
 */
function invalidateSlotAndOrder(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dispatchSlots.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
}

export function useCreateSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slotData) => unwrap(createSlot(slotData)),
    onSuccess: () => invalidateSlotAndOrder(queryClient),
  })
}

export function useUpdateSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }) => unwrap(updateSlot(id, updates)),
    onSuccess: () => invalidateSlotAndOrder(queryClient),
  })
}

export function useConfirmSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(confirmSlot(id)),
    onSuccess: () => invalidateSlotAndOrder(queryClient),
  })
}

export function useDeleteSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await deleteSlot(id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => invalidateSlotAndOrder(queryClient),
  })
}
