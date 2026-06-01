import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getStaffSalesByMonth,
  getStaffSalesByDate,
  upsertStaffSale,
  upsertStaffSalesBulk,
  deleteStaffSale,
} from '@/services/billing/staffSalesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useStaffSales(year, month) {
  return useQuery({
    queryKey: queryKeys.staffSales.byMonth(year, month),
    queryFn: () => unwrap(getStaffSalesByMonth(year, month)),
    enabled: !!year && !!month,
  })
}

export function useStaffSalesByDate(date) {
  return useQuery({
    queryKey: queryKeys.staffSales.byDate(date),
    queryFn: () => unwrap(getStaffSalesByDate(date)),
    enabled: !!date,
  })
}

export function useUpsertStaffSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(upsertStaffSale(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
    },
  })
}

export function useUpsertStaffSalesBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows) => unwrap(upsertStaffSalesBulk(rows)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
    },
  })
}

export function useDeleteStaffSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteStaffSale(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
    },
  })
}
