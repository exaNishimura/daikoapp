import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getFixedExpensesByMonthWithCarryOver,
  upsertFixedExpense,
  upsertFixedExpensesBulk,
  deleteFixedExpense,
} from '@/services/billing/fixedExpensesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useFixedExpenses(year, month) {
  return useQuery({
    queryKey: queryKeys.fixedExpenses.byMonth(year, month),
    queryFn: async () => {
      const result = await getFixedExpensesByMonthWithCarryOver(year, month)
      if (result.error) throw result.error
      return {
        rows: result.data ?? [],
        carriedOver: Boolean(result.carriedOver),
      }
    },
    enabled: !!year && !!month,
  })
}

export function useUpsertFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(upsertFixedExpense(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fixedExpenses.all })
    },
  })
}

export function useUpsertFixedExpensesBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows) => unwrap(upsertFixedExpensesBulk(rows)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fixedExpenses.all })
    },
  })
}

export function useDeleteFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteFixedExpense(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fixedExpenses.all })
    },
  })
}
