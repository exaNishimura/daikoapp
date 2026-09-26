import { getBusinessDayKey } from '@/utils/businessDayUtils'

/**
 * 当夜は全件。翌日以降は scheduled_at がその営業夜の依頼だけ。
 */
export function filterOrdersForDispatchNight(orders, nightDate, { isCurrentNight } = {}) {
  if (isCurrentNight) return orders || []
  if (!nightDate) return []
  return (orders || []).filter((order) => {
    if (!order?.scheduled_at) return false
    return getBusinessDayKey(order.scheduled_at) === nightDate
  })
}
