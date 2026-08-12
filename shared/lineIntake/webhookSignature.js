/**
 * LINE Webhook 署名検証 (HMAC-SHA256, Base64)
 * @see https://developers.line.biz/ja/docs/messaging-api/receiving-messages/
 */

/**
 * @param {string} body raw request body
 * @param {string} channelSecret
 * @param {string} signatureHeader x-line-signature
 * @returns {Promise<boolean>}
 */
export async function verifyLineSignature(body, channelSecret, signatureHeader) {
  if (!channelSecret || !signatureHeader) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return timingSafeEqual(expected, signatureHeader)
}

/**
 * @param {string} a
 * @param {string} b
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * グループ発言を顧客受付として扱わない
 * @param {{ type?: string, source?: { type?: string } }} event
 */
export function shouldIgnoreWebhookEvent(event) {
  if (!event) return true
  const sourceType = event.source?.type
  if (sourceType === 'group' || sourceType === 'room') return true
  // 承認は管理画面のみ — メッセージ返信による承認は無視
  if (event.type === 'message') return true
  return false
}
