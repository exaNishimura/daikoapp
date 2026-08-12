/**
 * LINE 仮受付ホールド期限切れ処理（cron）
 * Authorization: Bearer CRON_SECRET
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildHoldExpiredCustomerMessage,
  buildHoldExpiredGroupMessage,
  pushTextWithRetry,
} from '../../../shared/lineIntake/messaging.js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function authorize(req) {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return Boolean(cronSecret && token === cronSecret)
}

async function notify(to, text) {
  const accessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  if (!accessToken || !to) return { ok: false }
  return pushTextWithRetry({ to, text, accessToken })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!authorize(req)) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )
  const nowIso = new Date().toISOString()

  const { data: expired, error } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('status', 'HOLDING')
    .lte('hold_until', nowIso)
    .limit(50)

  if (error) return json({ error: error.message }, 500)

  const results = []
  const groupId = Deno.env.get('LINE_GROUP_ID')

  for (const unit of expired || []) {
    const dedupeKey = `hold_expire:${unit.id}`
    const { error: logErr } = await supabase.from('line_notification_logs').insert([
      { kind: 'hold_expire', dedupe_key: dedupeKey, target: unit.id, status: 'processing' },
    ])
    if (logErr) {
      results.push({ id: unit.id, skipped: true, reason: 'already_processed' })
      continue
    }

    await supabase
      .from('line_booking_units')
      .update({ status: 'EXPIRED', hold_until: null })
      .eq('id', unit.id)

    if (unit.order_id) {
      await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', unit.order_id)
    }
    if (unit.reservation_id) {
      await supabase.from('reservations').delete().eq('id', unit.reservation_id)
    }

    const pickupLabel = new Date(unit.pickup_at).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
    })
    const booking = unit.line_bookings
    await notify(
      booking.line_user_id,
      buildHoldExpiredCustomerMessage({ pickupAtLabel: pickupLabel })
    )
    await notify(
      groupId,
      buildHoldExpiredGroupMessage({ bookingId: booking.id, pickupAtLabel: pickupLabel })
    )

    await supabase
      .from('line_notification_logs')
      .update({ status: 'sent' })
      .eq('kind', 'hold_expire')
      .eq('dedupe_key', dedupeKey)

    results.push({ id: unit.id, expired: true })
  }

  return json({ ok: true, count: results.length, results })
})
