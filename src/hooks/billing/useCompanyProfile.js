import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCompanyProfile, upsertCompanyProfile } from '@/services/billing/companyProfileService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useCompanyProfile(options = {}) {
  return useQuery({
    queryKey: queryKeys.companyProfile.current(),
    queryFn: () => unwrap(getCompanyProfile()),
    ...options,
  })
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(upsertCompanyProfile(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companyProfile.all })
    },
  })
}
