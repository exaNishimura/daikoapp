import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReservation,
  deleteReservation,
  getReservation,
  listReservations,
  listReservationsByMonth,
  updateReservation,
} from '@/services/reservationService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * @param {{ dateFrom?: string, dateTo?: string, q?: string }} [filters]
 * @param {{ enabled?: boolean }} [options]
 */
export function useReservations(filters = {}, options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: queryKeys.reservations.list(filters),
    queryFn: () => unwrap(listReservations(filters)),
    enabled,
  })
}

export function useReservationsByMonth(year, month, options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: queryKeys.reservations.byMonth(year, month),
    queryFn: () => unwrap(listReservationsByMonth(year, month)),
    enabled: enabled && Boolean(year && month),
  })
}

export function useReservation(id, options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: queryKeys.reservations.detail(id),
    queryFn: () => unwrap(getReservation(id)),
    enabled: enabled && Boolean(id),
  })
}

function invalidateReservations(queryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => unwrap(createReservation(input)),
    onSuccess: () => invalidateReservations(queryClient),
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => unwrap(updateReservation(id, patch)),
    onSuccess: () => invalidateReservations(queryClient),
  })
}

export function useDeleteReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteReservation(id)),
    onSuccess: () => invalidateReservations(queryClient),
  })
}
