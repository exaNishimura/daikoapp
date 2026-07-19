import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reassignVehicleSales } from '@/services/billing/reassignVehicleSalesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useReassignVehicleSales() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ workDate, fromCar, toCar }) =>
      unwrap(reassignVehicleSales({ workDate, fromCar, toCar })),
    onSuccess: (_data, variables) => {
      const workDate = variables?.workDate
      qc.invalidateQueries({ queryKey: queryKeys.shifts.all })
      qc.invalidateQueries({ queryKey: queryKeys.dailySales.all })
      qc.invalidateQueries({ queryKey: queryKeys.staffSales.all })
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.vehicleOperations.all })
      if (workDate) {
        qc.invalidateQueries({ queryKey: queryKeys.dailySales.byDate(workDate) })
        qc.invalidateQueries({ queryKey: queryKeys.staffSales.byDate(workDate) })
        qc.invalidateQueries({ queryKey: queryKeys.receivables.byWorkDate(workDate) })
      }
    },
  })
}
