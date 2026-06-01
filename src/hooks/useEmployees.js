import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmployees,
  getActiveEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '@/services/employeeService'
import { queryKeys } from '@/lib/queryClient'

/**
 * 既存サービス関数 ({data, error} 形式) を TanStack Query 互換に変換
 * - error があれば throw（TanStack Query が isError として捕捉）
 * - 正常時は data を返す
 */
async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 従業員一覧を取得（全件）
 */
export function useEmployees() {
  return useQuery({
    queryKey: queryKeys.employees.list({ activeOnly: false }),
    queryFn: () => unwrap(getEmployees()),
  })
}

/**
 * アクティブな従業員のみ取得（シフト編集等で使用）
 */
export function useActiveEmployees() {
  return useQuery({
    queryKey: queryKeys.employees.list({ activeOnly: true }),
    queryFn: () => unwrap(getActiveEmployees()),
  })
}

/**
 * 従業員を新規作成。成功時に employees キャッシュを無効化。
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (employeeData) => unwrap(createEmployee(employeeData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
    },
  })
}

/**
 * 従業員を更新。成功時に employees キャッシュを無効化。
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, employeeData }) => unwrap(updateEmployee(id, employeeData)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
    },
  })
}

/**
 * 従業員を削除。成功時に employees キャッシュを無効化。
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => unwrap(deleteEmployee(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
    },
  })
}
