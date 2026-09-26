import { getBusinessDayKey } from '@/utils/businessDayUtils'

/**
 * 即時・時刻なしは当夜だけ残す。scheduled_at があるものは、その営業夜の画面だけに出す。
 */
export function filterOrdersForDispatchNight(orders, nightDate, { isCurrentNight } = {}) {
  if (!nightDate) return []
  return (orders || []).filter((order) => {
    if (!order?.scheduled_at) return Boolean(isCurrentNight)
    return getBusinessDayKey(order.scheduled_at) === nightDate
  })
}
