import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  formatDateInJst,
  getReceptionNightWindow,
} from '../../../shared/reservation/windowUtils.js'
import { buildReservationLineMessage } from '../../../shared/reservation/buildLineMessage.js'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const RESEND_URL = 'https://api.resend.com/emails'
const MAX_LINE_RETRIES = 3
const RETRY_DELAY_MS = 2000

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function authorizeRequest(req) {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return Boolean(cronSecret && token === cronSecret)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendLineMessage(groupId, text, accessToken) {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }],
    }),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

async function sendFailureEmail({ notifyDate, errorMessage, attemptCount }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('ALERT_EMAIL_FROM')
  const to = Deno.env.get('ALERT_EMAIL_TO')
  if (!apiKey || !from || !to) {
    console.error('Email alert skipped: RESEND_API_KEY / ALERT_EMAIL_FROM / ALERT_EMAIL_TO missing')
    return { ok: false, skipped: true }
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[daikoapp] 予約当日 LINE送信失敗 (${notifyDate})`,
      text: [
        '予約当日通知の LINE 送信に失敗しました。',
        '',
        `対象日: ${notifyDate}`,
        `試行回数: ${attemptCount}`,
        '',
        'エラー:',
        errorMessage,
        '',
        'Edge Function reservation-day-notify を手動再実行してください。',
      ].join('\n'),
    }),
  })

  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (!authorizeRequest(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  const lineGroupId = Deno.env.get('LINE_GROUP_ID')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase env' }, 500)
  }
  if (!lineToken || !lineGroupId) {
    return jsonResponse({ error: 'Missing LINE env' }, 500)
  }

  let body = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const notifyDate = body.notify_date || formatDateInJst(new Date())
  const force = Boolean(body.force)
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: existing } = await supabase
    .from('reservation_day_notifications')
    .select('notify_date, sent_at, skipped')
    .eq('notify_date', notifyDate)
    .maybeSingle()

  if (existing?.sent_at && !force) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'already_sent',
      notify_date: notifyDate,
    })
  }
  if (existing?.skipped && !existing?.sent_at && !force) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'already_skipped_empty',
      notify_date: notifyDate,
    })
  }

  const { startIso, endIso } = getReceptionNightWindow(notifyDate)
  const { data: rows, error: listError } = await supabase
    .from('reservations')
    .select('id, reserved_at, customer_name, phone, memo')
    .gte('reserved_at', startIso)
    .lt('reserved_at', endIso)
    .order('reserved_at', { ascending: true })

  if (listError) {
    return jsonResponse({ error: listError.message }, 500)
  }

  const reservations = rows ?? []
  if (reservations.length === 0) {
    await supabase.from('reservation_day_notifications').upsert(
      {
        notify_date: notifyDate,
        sent_at: null,
        skipped: true,
        line_status: null,
        message_body: null,
        error_message: null,
        retry_count: 0,
      },
      { onConflict: 'notify_date' }
    )
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'no_reservations',
      notify_date: notifyDate,
    })
  }

  const message = buildReservationLineMessage({
    notifyDate,
    reservations: reservations.map((r) => ({
      reservedAt: r.reserved_at,
      customerName: r.customer_name,
      phone: r.phone,
      memo: r.memo,
    })),
  })

  let lineStatus = null
  let lineError = null
  let retryCount = 0

  for (let attempt = 1; attempt <= MAX_LINE_RETRIES; attempt++) {
    retryCount = attempt
    const result = await sendLineMessage(lineGroupId, message, lineToken)
    lineStatus = result.status
    if (result.ok) {
      lineError = null
      break
    }
    lineError = `HTTP ${result.status}: ${result.body}`
    if (attempt < MAX_LINE_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  if (lineError) {
    await sendFailureEmail({
      notifyDate,
      errorMessage: lineError,
      attemptCount: retryCount,
    })
    await supabase.from('reservation_day_notifications').upsert(
      {
        notify_date: notifyDate,
        sent_at: null,
        skipped: false,
        line_status: lineStatus,
        message_body: message,
        error_message: lineError,
        retry_count: retryCount,
      },
      { onConflict: 'notify_date' }
    )
    return jsonResponse(
      { ok: false, notify_date: notifyDate, error: lineError, email_sent: true },
      502
    )
  }

  const sentAt = new Date().toISOString()
  await supabase.from('reservation_day_notifications').upsert(
    {
      notify_date: notifyDate,
      sent_at: sentAt,
      skipped: false,
      line_status: lineStatus,
      message_body: message,
      error_message: null,
      retry_count: retryCount,
    },
    { onConflict: 'notify_date' }
  )

  return jsonResponse({
    ok: true,
    notify_date: notifyDate,
    line_status: lineStatus,
    message_length: message.length,
    reservation_count: reservations.length,
  })
})
