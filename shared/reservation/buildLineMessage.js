/**
 * スタッフ向け予約 LINE 本文（Edge / SPA 共用）
 */

/** LINE text 上限 5000 に余裕を持たせる */
export const MAX_LINE_MESSAGE_CHARS = 4800
export const MAX_MEMO_CHARS = 40
export const MAX_RESERVATIONS_IN_MESSAGE = 40

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']

/**
 * @param {string} notifyDate YYYY-MM-DD
 */
function formatHeader(notifyDate) {
  const [ys, ms, ds] = notifyDate.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  // 曜日は JST 暦日として UTC 正午相当で判定（日付ずれ回避）
  const dow = DOW_JA[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]
  return `【予約】${m}/${d}（${dow}）受付分`
}

/**
 * @param {string} iso
 * @returns {string} HH:mm in Asia/Tokyo
 */
function formatJstHm(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/**
 * @param {string} memo
 * @returns {string}
 */
function summarizeMemo(memo) {
  const t = String(memo ?? '').trim()
  if (!t) return ''
  if (t.length <= MAX_MEMO_CHARS) return t
  return `${t.slice(0, MAX_MEMO_CHARS)}…`
}

/**
 * @typedef {{ reservedAt: string, customerName: string, phone: string, memo?: string }} ReservationLineInput
 */

/**
 * @param {{ notifyDate: string, reservations: ReservationLineInput[] }} params
 * @returns {string}
 */
export function buildReservationLineMessage({ notifyDate, reservations }) {
  if (!Array.isArray(reservations) || reservations.length === 0) {
    throw new Error('reservations must be a non-empty array')
  }

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime()
  )

  const listed = sorted.slice(0, MAX_RESERVATIONS_IN_MESSAGE)
  const remainder = sorted.length - listed.length

  const lines = [formatHeader(notifyDate)]
  for (const r of listed) {
    const time = formatJstHm(r.reservedAt)
    const name = String(r.customerName ?? '').trim() || '（無名）'
    const phone = String(r.phone ?? '').trim() || '—'
    lines.push(`${time} ${name} ${phone}`)
    const memo = summarizeMemo(r.memo)
    if (memo) {
      lines.push(`メモ: ${memo}`)
    }
  }

  if (remainder > 0) {
    lines.push(`他 ${remainder} 件は台帳で確認`)
  }

  let text = lines.join('\n')
  if (text.length > MAX_LINE_MESSAGE_CHARS) {
    text = `${text.slice(0, MAX_LINE_MESSAGE_CHARS - 1)}…`
  }
  return text
}
