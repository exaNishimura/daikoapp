import { useQuery } from '@tanstack/react-query'
import { listShiftAvailabilityRequests } from '@/services/employeeShiftService'
import { queryKeys } from '@/lib/queryClient'

/**
 * 管理者向け: 指定月のシフト希望一覧
 * @param {string|null} yearMonth YYYY-MM
 */
export function useShiftAvailabilityRequests(yearMonth) {
  return useQuery({
    queryKey: queryKeys.shiftRequests.byMonth(yearMonth),
    queryFn: async () => {
      const { data, error } = await listShiftAvailabilityRequests(yearMonth)
      if (error) throw error
      return data?.rows ?? []
    },
    enabled: Boolean(yearMonth),
  })
}
