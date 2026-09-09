import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import {
  generatePayrollDrafts,
  getPayrollSlipsByMonth,
  setPayrollSlipsStatus,
  updatePayrollSlip,
} from '@/services/payrollService'

export function usePayrollSlips(yearMonth, options = {}) {
  return useQuery({
    queryKey: queryKeys.payroll.byMonth(yearMonth),
    queryFn: async () => {
      const { data, error } = await getPayrollSlipsByMonth(yearMonth)
      if (error) throw error
      return data
    },
    enabled: Boolean(yearMonth) && options.enabled !== false,
  })
}

export function useGeneratePayrollDrafts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ yearMonth, overwritePublished = false }) => {
      const { data, error } = await generatePayrollDrafts(yearMonth, { overwritePublished })
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.payroll.byMonth(vars.yearMonth) })
      qc.invalidateQueries({ queryKey: queryKeys.payroll.all })
    },
  })
}

export function useUpdatePayrollSlip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch, employee }) => {
      const { data, error } = await updatePayrollSlip(id, patch, employee)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payroll.all })
    },
  })
}

export function useSetPayrollStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, status }) => {
      const { data, error } = await setPayrollSlipsStatus(ids, status)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payroll.all })
    },
  })
}
