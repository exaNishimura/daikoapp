import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
} from '@/services/orderService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 依頼一覧を取得
 * @param {string|null} status - ステータスフィルタ（null で全件）
 */
export function useOrders(status = null) {
  return useQuery({
    queryKey: queryKeys.orders.list({ status }),
    queryFn: () => unwrap(getOrders(status)),
  })
}

/**
 * IDで単一依頼を取得
 */
export function useOrder(id) {
  return useQuery({
    queryKey: ['orders', 'byId', id],
    queryFn: () => unwrap(getOrderById(id)),
    enabled: Boolean(id),
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderData) => unwrap(createOrder(orderData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }) => unwrap(updateOrder(id, updates)),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ['orders', 'byId', variables.id] })
      }
    },
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(cancelOrder(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatchSlots.all })
    },
  })
}
