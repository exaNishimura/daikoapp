import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getStaffRates,
  upsertStaffRate,
  deleteStaffRate,
} from '@/services/billing/staffRatesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useStaffRates() {
  return useQuery({
    queryKey: queryKeys.staffRates.list(),
    queryFn: () => unwrap(getStaffRates()),
  })
}

export function useUpsertStaffRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(upsertStaffRate(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffRates.all })
    },
  })
}

export function useDeleteStaffRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteStaffRate(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffRates.all })
    },
  })
}
