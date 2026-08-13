import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  callLineIntakeApi,
  getLineIntakeSettings,
  listLineHoldingUnits,
} from '@/services/lineIntakeService'

export const lineIntakeKeys = {
  all: ['lineIntake'],
  queue: () => [...lineIntakeKeys.all, 'queue'],
  settings: () => [...lineIntakeKeys.all, 'settings'],
}

export function useLineQueue(options = {}) {
  const { enabled = true, refetchInterval } = options
  return useQuery({
    queryKey: lineIntakeKeys.queue(),
    queryFn: async () => {
      const { data, error } = await listLineHoldingUnits()
      if (error) throw error
      return data
    },
    enabled,
    refetchInterval,
  })
}

export function useLineIntakeSettings() {
  return useQuery({
    queryKey: lineIntakeKeys.settings(),
    queryFn: async () => {
      const { data, error } = await getLineIntakeSettings()
      if (error) throw error
      return data
    },
  })
}

export function useApproveLineUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ unitId, pin } = {}) => {
      const { data, error, raw } = await callLineIntakeApi({
        action: 'approve',
        unit_id: unitId,
        ...(pin ? { pin } : {}),
      })
      if (error) throw Object.assign(error, { raw })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lineIntakeKeys.queue() })
    },
  })
}

export function useAdminLineUnitAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await callLineIntakeApi(payload)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lineIntakeKeys.queue() })
      qc.invalidateQueries({ queryKey: lineIntakeKeys.settings() })
    },
  })
}
