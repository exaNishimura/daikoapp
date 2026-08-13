/**
 * LINE Messaging ペイロードビルダー & 送信ヘルパ契約
 */

/**
 * @param {string} to userId or groupId
 * @param {string} text
 */
export function buildPushBody(to, text) {
  return {
    to,
    messages: [{ type: 'text', text }],
  }
}

export function buildTentativeCustomerMessage({ pickupAtLabel, holdUntilLabel, discountLabel }) {
  const lines = [
    '【仮受付完了】',
    `お迎え希望: ${pickupAtLabel}`,
    '運営の承認待ちです。',
    holdUntilLabel ? `ホールド期限: ${holdUntilLabel}` : null,
    discountLabel ? `LINE割引: ${discountLabel}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

export function buildApprovalRequestGroupMessage({
  bookingId,
  unitCount,
  pickupAtLabel,
  usesExtraCapacity,
  customerPhone,
}) {
  const lines = [
    '【LINE仮受付・承認依頼】',
    `申込ID: ${bookingId}`,
    `台数: ${unitCount}`,
    `お迎え: ${pickupAtLabel}`,
    customerPhone ? `電話: ${customerPhone}` : null,
    usesExtraCapacity ? '⚠ 要手配（仮想余裕枠）' : null,
    '配車画面を確認してください。',
  ].filter(Boolean)
  return lines.join('\n')
}

export function buildConfirmedCustomerMessage({ pickupAtLabel, sequence }) {
  return [
    '【予約完了】',
    sequence != null ? `${sequence}台目の予約が確定しました。` : '予約が確定しました。',
    `お迎え: ${pickupAtLabel}`,
  ].join('\n')
}

export function buildHoldExpiredCustomerMessage({ pickupAtLabel }) {
  return [
    '【仮受付期限切れ】',
    '申し訳ありません。承認期限までに確定できなかったため、仮受付を解除しました。',
    '指定のお時間が埋まっている可能性があります。',
    pickupAtLabel ? `希望時刻: ${pickupAtLabel}` : null,
    'お手数ですが再度お申し込みください。',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildHoldExpiredGroupMessage({ bookingId, pickupAtLabel }) {
  return [
    '【LINE仮受付・期限切れ】',
    `申込ID: ${bookingId}`,
    pickupAtLabel ? `希望: ${pickupAtLabel}` : null,
    'ホールドを解放しました。',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildCustomerReminderMessage({ pickupAtLabel }) {
  return ['【リマインド】', `まもなくお迎え予定です。`, `お迎え: ${pickupAtLabel}`].join('\n')
}

export function buildAdminDayListMessage({ businessDayLabel, lines }) {
  if (!lines?.length) {
    return [`【LINE確定分 ${businessDayLabel}】`, '本日の確定予約はありません。'].join('\n')
  }
  return [`【LINE確定分 ${businessDayLabel}】`, ...lines].join('\n')
}

/**
 * リトライ付き push（fetch 注入）
 * @param {{ to: string, text: string, accessToken: string, fetchImpl?: typeof fetch, maxRetries?: number, sleep?: (ms:number)=>Promise<void> }} opts
 */
export async function pushTextWithRetry(opts) {
  const fetchImpl = opts.fetchImpl || fetch
  const maxRetries = opts.maxRetries ?? 3
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)))
  let last = { ok: false, status: 0, body: '' }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetchImpl('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPushBody(opts.to, opts.text)),
    })
    const body = await res.text()
    last = { ok: res.ok, status: res.status, body, attempt }
    if (res.ok) return last
    if (attempt < maxRetries) await sleep(2000)
  }
  return last
}
