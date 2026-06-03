import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bulkImportReceivables } from '@/services/billing/importService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 月次一括 import の React Query mutation。
 * 成功時は関連クエリを invalidate して画面を最新化する。
 */
export function useBulkImportReceivables() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(bulkImportReceivables(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
      qc.invalidateQueries({ queryKey: queryKeys.fixedExpenses.all })
    },
  })
}
