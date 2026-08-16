import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildDailyCloseMessage,
  formatJstDateTime,
  getCloseTargetWorkDate,
  shouldSkipDailyClose,
} from '../../../shared/dailyClose/buildMessage.js'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const RESEND_URL = 'https://api.resend.com/emails'
const MAX_LINE_RETRIES = 3
const RETRY_DELAY_MS = 2000

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })
}

function authorizeCron(req) {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!cronSecret || token !== cronSecret) {
    return false
  }
  return true
}

async function getStaffUser(req, supabase) {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (anon && token === anon) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
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

async function sendFailureEmail({ workDate, errorMessage, attemptCount }) {
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
      subject: `[daikoapp] 日次締め LINE送信失敗 (${workDate})`,
      text: [
        '日次締めの LINE 送信に失敗しました。',
        '',
        `対象日: ${workDate}`,
        `試行回数: ${attemptCount}`,
        '',
        'エラー:',
        errorMessage,
        '',
        'Edge Function daily-close を手動再実行してください。',
      ].join('\n'),
    }),
  })

  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

function buildCompanyLookup(companies) {
  const map = {}
  for (const company of companies ?? []) {
    if (company?.id) map[company.id] = company.name ?? ''
  }
  return map
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const isCron = authorizeCron(req)
  const staffUser = isCron ? null : await getStaffUser(req, supabase)
  if (!isCron && !staffUser) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const workDate = body.work_date || getCloseTargetWorkDate(new Date())
  const force = Boolean(body.force)
  // スタッフ手動は再送専用（初回締めは cron のみ）
  if (staffUser && !force) {
    return jsonResponse({ error: 'Staff may only resend with force=true' }, 400)
  }

  const { data: existingClosure } = await supabase
    .from('daily_day_closures')
    .select('work_date')
    .eq('work_date', workDate)
    .maybeSingle()

  if (existingClosure && !force) {
    return jsonResponse({ ok: true, skipped: true, reason: 'already_closed', work_date: workDate })
  }
  if (staffUser && force && !existingClosure) {
    return jsonResponse(
      { error: 'まだ締められていません。初回締めは自動実行を待ってください', work_date: workDate },
      409
    )
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('*')
    .eq('date', workDate)

  if (shiftsError) {
    return jsonResponse({ error: shiftsError.message }, 500)
  }

  const dayStatusRow = (shifts ?? []).find((row) => row.status)
  const dayStatus = dayStatusRow?.status ?? ''
  if (shouldSkipDailyClose(dayStatus)) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'holiday_or_closed_day',
      work_date: workDate,
      status: dayStatus,
    })
  }

  const activeShifts = (shifts ?? []).filter((row) => !row.status && row.car)

  const [
    { data: salesRow },
    { data: receivables },
    { data: employees },
    { data: companies },
  ] = await Promise.all([
    supabase.from('daily_sales').select('*').eq('work_date', workDate).maybeSingle(),
    supabase.from('accounts_receivable').select('*, company:companies(name)').eq('work_date', workDate),
    supabase.from('employees').select('*'),
    supabase.from('companies').select('id, name'),
  ])

  const dow = activeShifts[0]?.dow ?? dayStatusRow?.dow ?? ''
  const closedAtLabel = formatJstDateTime(new Date())
  const isResend = Boolean(existingClosure && force)
  const closedBy =
    body.closed_by ??
    (staffUser ? `staff:${staffUser.email || staffUser.id}` : 'system')
  const message = buildDailyCloseMessage({
    workDate,
    dow,
    dayStatus,
    salesRow,
    shifts: activeShifts,
    employees: employees ?? [],
    receivables: receivables ?? [],
    companyLookup: buildCompanyLookup(companies),
    closedAtLabel,
    isResend,
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
      workDate,
      errorMessage: lineError,
      attemptCount: retryCount,
    })

    await supabase.from('daily_close_notifications').upsert(
      {
        work_date: workDate,
        line_status: lineStatus,
        message_body: message,
        error_message: lineError,
        retry_count: retryCount,
      },
      { onConflict: 'work_date' }
    )

    return jsonResponse(
      {
        ok: false,
        work_date: workDate,
        error: lineError,
        email_sent: true,
      },
      502
    )
  }

  const closedAt = new Date().toISOString()

  await supabase.from('daily_day_closures').upsert(
    {
      work_date: workDate,
      closed_at: closedAt,
      closed_by: closedBy,
    },
    { onConflict: 'work_date' }
  )

  await supabase.from('daily_close_notifications').upsert(
    {
      work_date: workDate,
      sent_at: closedAt,
      line_status: lineStatus,
      message_body: message,
      error_message: null,
      retry_count: retryCount,
    },
    { onConflict: 'work_date' }
  )

  if (salesRow) {
    await supabase
      .from('daily_sales')
      .update({ closed_at: closedAt, closed_by: closedBy })
      .eq('work_date', workDate)
  }

  return jsonResponse({
    ok: true,
    work_date: workDate,
    line_status: lineStatus,
    message_length: message.length,
    resent: isResend,
  })
})
