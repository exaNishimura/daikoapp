import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getShifts,
  getShiftsByDate,
  createShift,
  updateShift,
  deleteShift,
  deleteShiftsByDate,
  createShiftsBulk,
} from '@/services/shiftService'
import { queryKeys } from '@/lib/queryClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 指定期間のシフトデータを取得
 * @param {string} startDate - YYYY-MM-DD（任意）
 * @param {string} endDate - YYYY-MM-DD（任意）
 */
export function useShifts(startDate, endDate) {
  return useQuery({
    queryKey: ['shifts', 'range', startDate ?? null, endDate ?? null],
    queryFn: () => unwrap(getShifts(startDate, endDate)),
    enabled: Boolean(startDate && endDate),
  })
}

/**
 * 年月指定でシフトデータを取得（カレンダー表示用）
 * @param {number} year
 * @param {number} month
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - false の場合フェッチしない（モーダル未表示時等）
 */
export function useShiftsByMonth(year, month, options = {}) {
  const { enabled = true } = options
  const startDate = year && month ? `${year}-${String(month).padStart(2, '0')}-01` : null
  const endDate =
    year && month
      ? `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
      : null

  return useQuery({
    queryKey: queryKeys.shifts.byMonth(year, month),
    queryFn: () => unwrap(getShifts(startDate, endDate)),
    enabled: enabled && Boolean(startDate && endDate),
  })
}

/**
 * 指定日のシフトデータを車両別にグループ化して取得
 */
export function useShiftsByDate(date) {
  return useQuery({
    queryKey: ['shifts', 'byDateGrouped', date ?? null],
    queryFn: () => unwrap(getShiftsByDate(date)),
    enabled: Boolean(date),
  })
}

export function useCreateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shiftData) => unwrap(createShift(shiftData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
  })
}

export function useUpdateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, shiftData }) => unwrap(updateShift(id, shiftData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
  })
}

export function useDeleteShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteShift(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
  })
}

export function useDeleteShiftsByDate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (date) => unwrap(deleteShiftsByDate(date)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
  })
}

export function useCreateShiftsBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shifts) => unwrap(createShiftsBulk(shifts)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
  })
}
