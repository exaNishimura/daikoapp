import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDailyClosuresByMonth,
  indexClosuresByDate,
  resendDailyCloseReport,
} from '@/services/billing/dailyCloseService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useDailyClosures(year, month) {
  return useQuery({
    queryKey: queryKeys.dailyClosures.month(year, month),
    queryFn: () => unwrap(getDailyClosuresByMonth(year, month)),
    enabled: !!year && !!month,
  })
}

export function useClosuresByDate(year, month) {
  const query = useDailyClosures(year, month)
  return {
    ...query,
    closuresByDate: indexClosuresByDate(query.data),
  }
}

export function useResendDailyClose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workDate) => unwrap(resendDailyCloseReport(workDate)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dailyClosures.all })
    },
  })
}
