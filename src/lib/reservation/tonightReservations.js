import {
  getReceptionNightWindow,
  parseJstDateString,
} from '@/lib/reservation/reservationWindowUtils'

const STORAGE_VERSION = 'v1'

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function addJstCalendarDays(dateStr, days) {
  const { y, month, d } = parseJstDateString(dateStr)
  const utc = new Date(Date.UTC(y, month - 1, d + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * 営業夜をカバーする listReservations 用フィルタ（暦日 D と D+1）
 * @param {string} workDateStr YYYY-MM-DD
 */
export function getTonightListFilters(workDateStr) {
  return {
    dateFrom: workDateStr,
    dateTo: addJstCalendarDays(workDateStr, 1),
  }
}

/**
 * @param {Array<{ reserved_at?: string }>} reservations
 * @param {string} workDateStr YYYY-MM-DD
 */
export function filterReservationsInReceptionNight(reservations, workDateStr) {
  if (!workDateStr) return []
  const { start, end } = getReceptionNightWindow(workDateStr)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return [...(reservations ?? [])]
    .filter((row) => {
      const t = new Date(row?.reserved_at).getTime()
      return Number.isFinite(t) && t >= startMs && t < endMs
    })
    .sort((a, b) => new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime())
}

export function tonightDismissStorageKey(workDateStr) {
  return `reservationTonightDismissed:${STORAGE_VERSION}:${workDateStr}`
}

export function wasTonightDialogDismissed(workDateStr) {
  if (!workDateStr) return false
  try {
    return localStorage.getItem(tonightDismissStorageKey(workDateStr)) === '1'
  } catch {
    return false
  }
}

export function markTonightDialogDismissed(workDateStr) {
  if (!workDateStr) return
  try {
    localStorage.setItem(tonightDismissStorageKey(workDateStr), '1')
  } catch {
    // private mode / quota
  }
}
