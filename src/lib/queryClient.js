import { QueryClient } from '@tanstack/react-query'

/**
 * アプリ共通の QueryClient
 *
 * 業務アプリなので過剰な再フェッチは抑える。
 * - staleTime 60s: 1分以内は cache をそのまま使う
 * - gcTime 5min: 未使用クエリは 5 分でガーベジコレクト
 * - retry 1: ネットワーク不調で 1 回だけリトライ
 * - refetchOnWindowFocus: 復帰時の自動再フェッチは ON（手元のタブ間ズレを抑える）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

/**
 * アプリ全体で利用するクエリキー集約
 * 命名規則: 配列の先頭にエンティティ名、続けてフィルタ条件
 * 例: ['employees', 'list'], ['orders', 'byDate', '2025-06-01']
 */
export const queryKeys = {
  employees: {
    all: ['employees'],
    list: (filters = {}) => ['employees', 'list', filters],
  },
  vehicles: {
    all: ['vehicles'],
    list: () => ['vehicles', 'list'],
  },
  orders: {
    all: ['orders'],
    list: (filters = {}) => ['orders', 'list', filters],
    byDate: (date) => ['orders', 'byDate', date],
  },
  shifts: {
    all: ['shifts'],
    byMonth: (year, month) => ['shifts', 'byMonth', year, month],
  },
  dispatchSlots: {
    all: ['dispatchSlots'],
    byDate: (date) => ['dispatchSlots', 'byDate', date],
  },
  vehicleOperations: {
    all: ['vehicleOperations'],
    byDate: (date) => ['vehicleOperations', 'byDate', date],
  },
}
