import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deactivateCompany,
  deleteCompany,
  reorderCompanies,
} from '@/services/billing/companiesService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 取引先一覧。activeOnly でアクティブなものに絞れる。
 * @param {{ activeOnly?: boolean }} [options]
 */
export function useCompanies(options = {}) {
  const filters = { activeOnly: !!options.activeOnly }
  return useQuery({
    queryKey: queryKeys.companies.list(filters),
    queryFn: () => unwrap(getCompanies(filters)),
  })
}

export function useCompany(id) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id),
    queryFn: () => unwrap(getCompany(id)),
    enabled: id != null,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => unwrap(createCompany(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
    },
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }) => unwrap(updateCompany(id, payload)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      qc.invalidateQueries({ queryKey: queryKeys.companies.detail(vars.id) })
    },
  })
}

export function useDeactivateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deactivateCompany(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
    },
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteCompany(id)),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      qc.invalidateQueries({ queryKey: queryKeys.companies.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}

export function useReorderCompanies() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedRows) => unwrap(reorderCompanies(orderedRows)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
    },
  })
}
