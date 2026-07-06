import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getReceivables,
  getReceivablesByWorkDate,
  getUnbilledByCompany,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  replaceShiftReceivables,
} from '@/services/billing/receivablesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 売掛一覧。filter は { year, month, companyId, invoiced }
 */
export function useReceivables(filter = {}) {
  return useQuery({
    queryKey: queryKeys.receivables.list(filter),
    queryFn: () => unwrap(getReceivables(filter)),
  })
}

export function useReceivablesByWorkDate(workDate) {
  return useQuery({
    queryKey: queryKeys.receivables.byWorkDate(workDate),
    queryFn: () => unwrap(getReceivablesByWorkDate(workDate)),
    enabled: !!workDate,
  })
}

/**
 * 月別未請求集計 (企業ごと)。請求書発行画面用。
 */
export function useUnbilledByCompany(year, month) {
  return useQuery({
    queryKey: queryKeys.receivables.unbilledByCompany(year, month),
    queryFn: () => unwrap(getUnbilledByCompany(year, month)),
    enabled: !!year && !!month,
  })
}

export function useCreateReceivable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(createReceivable(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}

export function useUpdateReceivable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => unwrap(updateReceivable(id, payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}

export function useDeleteReceivable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteReceivable(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}

export function useReplaceShiftReceivables() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workDate, lines }) => unwrap(replaceShiftReceivables(workDate, lines)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
    },
  })
}
