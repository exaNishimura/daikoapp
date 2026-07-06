import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDailyStaffSalesByDate,
  getDailyStaffSalesByMonth,
  upsertDailyStaffSalesBatch,
} from '@/services/billing/dailyStaffSalesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useDailyStaffSalesByDate(workDate) {
  return useQuery({
    queryKey: queryKeys.staffSales.byDate(workDate),
    queryFn: () => unwrap(getDailyStaffSalesByDate(workDate)),
    enabled: !!workDate,
  })
}

export function useDailyStaffSalesByMonth(year, month) {
  return useQuery({
    queryKey: queryKeys.staffSales.byMonth(year, month),
    queryFn: () => unwrap(getDailyStaffSalesByMonth(year, month)),
    enabled: !!year && !!month,
  })
}

export function useUpsertDailyStaffSalesBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workDate, rows }) => unwrap(upsertDailyStaffSalesBatch(workDate, rows)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
    },
  })
}
