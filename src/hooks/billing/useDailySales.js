import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDailySalesByMonth,
  getDailySalesByDate,
  upsertDailySale,
  deleteDailySale,
} from '@/services/billing/dailySalesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useDailySales(year, month) {
  return useQuery({
    queryKey: queryKeys.dailySales.byMonth(year, month),
    queryFn: () => unwrap(getDailySalesByMonth(year, month)),
    enabled: !!year && !!month,
  })
}

export function useDailySaleByDate(date) {
  return useQuery({
    queryKey: queryKeys.dailySales.byDate(date),
    queryFn: () => unwrap(getDailySalesByDate(date)),
    enabled: !!date,
  })
}

export function useUpsertDailySale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(upsertDailySale(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}

export function useDeleteDailySale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workDate) => unwrap(deleteDailySale(workDate)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}
