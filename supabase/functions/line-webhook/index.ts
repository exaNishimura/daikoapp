/**
 * LINE Webhook — 署名検証。グループ発言は顧客受付にしない。
 * Secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_LIFF_ID
 */

import {
  shouldIgnoreWebhookEvent,
  verifyLineSignature,
} from '../../../shared/lineIntake/webhookSignature.js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')
  const liffId = Deno.env.get('LINE_LIFF_ID')
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  const valid = await verifyLineSignature(rawBody, channelSecret || '', signature)
  if (!valid) {
    return json({ error: 'Invalid signature' }, 401)
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const events = payload.events || []
  const handled = []
  for (const event of events) {
    if (shouldIgnoreWebhookEvent(event)) {
      handled.push({ type: event.type, ignored: true, reason: 'group_or_message' })
      continue
    }
    // follow 等: LIFF 起動はリッチメニュー側。ここではログのみ
    handled.push({
      type: event.type,
      ignored: false,
      liffIdConfigured: Boolean(liffId),
    })
  }

  return json({ ok: true, handled })
})
