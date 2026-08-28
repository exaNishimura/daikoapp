const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

/** シフト希望画面向け: 9月1日（火） */
export function formatShiftRequestDate(date) {
  const [y, m, d] = String(date).split('-').map(Number)
  const weekday = WEEKDAYS_JA[new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日（${weekday}）`
}

/** shifts 行から日付 → status（休業|定休日）の Map を作る */
export function indexDayStatusByDate(shifts) {
  const map = {}
  for (const row of shifts || []) {
    if (row?.date && row?.status) {
      map[row.date] = row.status
    }
  }
  return map
}

export function isRegularClosedDay(status) {
  return status === '定休日'
}

/** 定休日の available を false に揃える */
export function sanitizeShiftRequestPayload(payload, dayStatusByDate) {
  const days = { ...(payload?.days || {}) }
  for (const [date, status] of Object.entries(dayStatusByDate || {})) {
    if (isRegularClosedDay(status) && days[date]) {
      days[date] = { ...days[date], available: false }
    }
  }
  return { ...payload, days }
}
