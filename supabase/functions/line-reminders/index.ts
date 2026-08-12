/**
 * LINE リマインド
 * - 顧客: 確定分のお迎え 60 分前（1通・冪等）
 * - 管理者: 当日営業開始前の確定一覧（1通）
 *
 * Authorization: Bearer CRON_SECRET
 * body: { mode?: 'customer'|'admin'|'both', business_day?: 'YYYY-MM-DD' }
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getLineBusinessDayKey } from '../../../shared/lineIntake/availability.js'
import {
  buildAdminDayListMessage,
  buildCustomerReminderMessage,
  pushTextWithRetry,
} from '../../../shared/lineIntake/messaging.js'
import { getReceptionNightWindow } from '../../../shared/reservation/windowUtils.js'

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

async function tryDedupe(supabase, kind, dedupeKey) {
  const { error } = await supabase
    .from('line_notification_logs')
    .insert([{ kind, dedupe_key: dedupeKey, status: 'sent' }])
  return !error
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!authorize(req)) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  let body = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const mode = body.mode || 'both'
  const now = new Date()
  const settingsRow = await supabase.from('line_intake_settings').select('*').eq('id', 1).single()
  const leadMin = settingsRow.data?.reminder_customer_minutes ?? 60
  const results = { customer: [], admin: null }

  if (mode === 'customer' || mode === 'both') {
    const windowStart = new Date(now.getTime() + (leadMin - 2) * 60 * 1000)
    const windowEnd = new Date(now.getTime() + (leadMin + 2) * 60 * 1000)

    const { data: units } = await supabase
      .from('line_booking_units')
      .select('*, line_bookings(*)')
      .eq('status', 'CONFIRMED')
      .gte('pickup_at', windowStart.toISOString())
      .lte('pickup_at', windowEnd.toISOString())

    for (const unit of units || []) {
      const dedupeKey = `customer_reminder:${unit.id}`
      if (!(await tryDedupe(supabase, 'customer_reminder', dedupeKey))) {
        results.customer.push({ id: unit.id, skipped: true })
        continue
      }
      const label = new Date(unit.pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      await notify(unit.line_bookings.line_user_id, buildCustomerReminderMessage({ pickupAtLabel: label }))
      results.customer.push({ id: unit.id, sent: true })
    }
  }

  if (mode === 'admin' || mode === 'both') {
    const businessDay = body.business_day || getLineBusinessDayKey(now)
    const dedupeKey = `admin_day_list:${businessDay}`
    if (await tryDedupe(supabase, 'admin_day_list', dedupeKey)) {
      const { startIso, endIso } = getReceptionNightWindow(businessDay)
      const { data: units } = await supabase
        .from('line_booking_units')
        .select('*, line_bookings(*)')
        .eq('status', 'CONFIRMED')
        .gte('pickup_at', startIso)
        .lt('pickup_at', endIso)
        .order('pickup_at', { ascending: true })

      const lines = (units || []).map((u) => {
        const t = new Date(u.pickup_at).toLocaleTimeString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
        })
        const extra = u.uses_extra_capacity ? ' [要手配]' : ''
        return `${t} ${u.pickup_address} → ${u.dropoff_address}${extra}`
      })

      const text = buildAdminDayListMessage({ businessDayLabel: businessDay, lines })
      await notify(Deno.env.get('LINE_GROUP_ID'), text)
      results.admin = { sent: true, business_day: businessDay, count: lines.length }
    } else {
      results.admin = { skipped: true, business_day: businessDay }
    }
  }

  return json({ ok: true, results })
})
