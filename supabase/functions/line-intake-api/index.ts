/**
 * LINE 受注 API（受付・承認・キャンセル・管理者変更・再投影）
 *
 * Secrets:
 * - LINE_CHANNEL_ACCESS_TOKEN（顧客 userId push のみ。スタッフ通知はアプリ内ポップアップ）
 * - LINE_CHANNEL_SECRET, LINE_LIFF_ID（参照用・Webhook 側で主利用）
 * - GOOGLE_MAPS_API_KEY
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - CRON_SECRET（管理者系の補助認可にも可）
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { checkAvailability } from '../../../shared/lineIntake/availability.js'
import { calculateLineBuffer } from '../../../shared/lineIntake/buffer.js'
import { snapshotDiscount } from '../../../shared/lineIntake/discount.js'
import { computeHoldUntil } from '../../../shared/lineIntake/holdDeadline.js'
import { fetchDirectionsDurationMinutes } from '../../../shared/lineIntake/mapsDirections.js'
import {
  buildConfirmedCustomerMessage,
  buildTentativeCustomerMessage,
  pushTextWithRetry,
} from '../../../shared/lineIntake/messaging.js'
import { applyPinAttempt, hashPin, verifyPin } from '../../../shared/lineIntake/pin.js'
import {
  buildLineChannelMarkers,
  resolveProjectionTarget,
} from '../../../shared/lineIntake/projector.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key)
}

async function loadSettings(supabase) {
  const { data, error } = await supabase.from('line_intake_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

async function loadOccupiedIntervals(supabase, pickupAt, durationMin) {
  const start = new Date(pickupAt)
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  const padStart = new Date(start.getTime() - 6 * 60 * 60 * 1000).toISOString()
  const padEnd = new Date(end.getTime() + 6 * 60 * 60 * 1000).toISOString()

  const [{ data: units }, { data: slots }, { data: reservations }] = await Promise.all([
    supabase
      .from('line_booking_units')
      .select('pickup_at, base_duration_min, buffer_min, status')
      .in('status', ['HOLDING', 'CONFIRMED'])
      .gte('pickup_at', padStart)
      .lte('pickup_at', padEnd),
    supabase
      .from('dispatch_slots')
      .select('start_at, end_at')
      .gte('start_at', padStart)
      .lte('start_at', padEnd),
    supabase
      .from('reservations')
      .select('reserved_at')
      .gte('reserved_at', padStart)
      .lte('reserved_at', padEnd),
  ])

  const occupied = []
  for (const u of units || []) {
    const dur = (u.base_duration_min || 20) + (u.buffer_min ?? calculateLineBuffer(u.base_duration_min))
    const s = new Date(u.pickup_at)
    occupied.push({ start: s, end: new Date(s.getTime() + dur * 60 * 1000) })
  }
  for (const s of slots || []) {
    occupied.push({ start: s.start_at, end: s.end_at })
  }
  for (const r of reservations || []) {
    const s = new Date(r.reserved_at)
    occupied.push({ start: s, end: new Date(s.getTime() + 30 * 60 * 1000) })
  }
  return occupied
}

async function loadPhoneLocks(supabase, pickupAt) {
  const start = new Date(pickupAt)
  const padStart = new Date(start.getTime() - 12 * 60 * 60 * 1000).toISOString()
  const padEnd = new Date(start.getTime() + 12 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('phone_priority_locks')
    .select('start_at, end_at')
    .lte('start_at', padEnd)
    .gte('end_at', padStart)
  return data || []
}

async function projectUnit(supabase, booking, unit, statusForOrder = 'TENTATIVE') {
  const markers = buildLineChannelMarkers({
    lineUserId: booking.line_user_id,
    unitId: unit.id,
    discountLabel: booking.discount_snapshot?.label,
  })
  const target = resolveProjectionTarget(unit.pickup_at, new Date())
  try {
    if (target === 'BOARD') {
      const orderPayload = {
        order_type: 'SCHEDULED',
        scheduled_at: unit.pickup_at,
        pickup_address: unit.pickup_address,
        dropoff_address: unit.dropoff_address,
        contact_phone: booking.contact_phone,
        car_model: unit.vehicle_info || null,
        parking_note: markers.memo_prefix,
        base_duration_min: unit.base_duration_min,
        buffer_min: unit.buffer_min,
        status: statusForOrder === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE',
      }
      let orderId = unit.order_id
      if (orderId) {
        await supabase.from('orders').update(orderPayload).eq('id', orderId)
      } else {
        const { data, error } = await supabase.from('orders').insert([orderPayload]).select('id').single()
        if (error) throw error
        orderId = data.id
      }
      await supabase
        .from('line_booking_units')
        .update({ order_id: orderId, reservation_id: null, projection_error: null })
        .eq('id', unit.id)
      return { target, orderId }
    }

    const reservationPayload = {
      reserved_at: unit.pickup_at,
      customer_name: `LINE:${booking.line_user_id.slice(0, 8)}`,
      phone: booking.contact_phone,
      memo: `${markers.memo_prefix}\n${unit.pickup_address} → ${unit.dropoff_address}\n${unit.vehicle_info || ''}`,
    }
    let reservationId = unit.reservation_id
    if (reservationId) {
      await supabase.from('reservations').update(reservationPayload).eq('id', reservationId)
    } else {
      const { data, error } = await supabase
        .from('reservations')
        .insert([reservationPayload])
        .select('id')
        .single()
      if (error) throw error
      reservationId = data.id
    }
    await supabase
      .from('line_booking_units')
      .update({ reservation_id: reservationId, order_id: null, projection_error: null })
      .eq('id', unit.id)
    return { target, reservationId }
  } catch (e) {
    await supabase
      .from('line_booking_units')
      .update({ projection_error: e?.message || 'projection failed' })
      .eq('id', unit.id)
    return { target, error: e?.message || 'projection failed' }
  }
}

async function notify(to, text) {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  if (!token || !to) return { ok: false, skipped: true }
  return pushTextWithRetry({ to, text, accessToken: token })
}

async function handleCheck(supabase, body) {
  const settings = await loadSettings(supabase)
  const mapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')
  let baseDuration = body.base_duration_min ?? null
  if (baseDuration == null && body.pickup_address && body.dropoff_address) {
    const dir = await fetchDirectionsDurationMinutes({
      origin: body.pickup_address,
      destination: body.dropoff_address,
      apiKey: mapsKey,
    })
    baseDuration = dir.duration
  }
  const pickupAt = body.pickup_at ? new Date(body.pickup_at) : new Date()
  const durationMin = (baseDuration || 20) + calculateLineBuffer(baseDuration)
  const occupiedIntervals = await loadOccupiedIntervals(supabase, pickupAt, durationMin)
  const phoneLocks = await loadPhoneLocks(supabase, pickupAt)
  const result = checkAvailability({
    now: new Date(),
    desiredPickupAt: pickupAt,
    orderType: body.order_type || 'SCHEDULED',
    unitCount: body.unit_count || 1,
    baseDurationMin: baseDuration,
    occupiedIntervals,
    phoneLocks,
    settings,
  })
  return json({
    ...result,
    discount: snapshotDiscount(settings.discount_config),
    base_duration_min: baseDuration,
    buffer_min: calculateLineBuffer(baseDuration),
    secrets_ref: {
      LINE_CHANNEL_SECRET: Boolean(Deno.env.get('LINE_CHANNEL_SECRET')),
      LINE_LIFF_ID: Deno.env.get('LINE_LIFF_ID') || null,
    },
  })
}

async function handleSubmit(supabase, body) {
  const lineUserId = body.line_user_id
  const contactPhone = body.contact_phone
  const unitsInput = Array.isArray(body.units) ? body.units : null
  if (!lineUserId || !contactPhone || !unitsInput?.length) {
    return json({ error: 'line_user_id, contact_phone, units required' }, 400)
  }

  const settings = await loadSettings(supabase)
  const mapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')
  const discount = snapshotDiscount(settings.discount_config)
  const orderType = body.order_type || 'SCHEDULED'
  const now = new Date()

  // 代表ユニットで可否（複数台は同一枠想定）
  const first = unitsInput[0]
  let baseDuration = first.base_duration_min ?? null
  if (baseDuration == null) {
    const dir = await fetchDirectionsDurationMinutes({
      origin: first.pickup_address,
      destination: first.dropoff_address,
      apiKey: mapsKey,
    })
    baseDuration = dir.duration
  }
  const pickupAt = orderType === 'NOW' ? now : new Date(first.pickup_at)
  const durationMin = (baseDuration || 20) + calculateLineBuffer(baseDuration)
  const occupiedIntervals = await loadOccupiedIntervals(supabase, pickupAt, durationMin)
  const phoneLocks = await loadPhoneLocks(supabase, pickupAt)
  const availability = checkAvailability({
    now,
    desiredPickupAt: pickupAt,
    orderType,
    unitCount: unitsInput.length,
    baseDurationMin: baseDuration,
    occupiedIntervals,
    phoneLocks,
    settings,
  })

  if (!availability.ok) {
    return json({ ok: false, ...availability, discount })
  }

  const holdUntil = computeHoldUntil(now)
  const bufferMin = calculateLineBuffer(baseDuration)

  const { data: booking, error: bookingError } = await supabase
    .from('line_bookings')
    .insert([
      {
        line_user_id: lineUserId,
        contact_phone: contactPhone,
        channel: 'LINE',
        discount_snapshot: discount,
        status: 'PENDING',
      },
    ])
    .select('*')
    .single()
  if (bookingError) return json({ error: bookingError.message }, 500)

  const unitRows = unitsInput.map((u, i) => ({
    booking_id: booking.id,
    sequence: i + 1,
    pickup_at: (orderType === 'NOW' ? now : new Date(u.pickup_at || first.pickup_at)).toISOString(),
    pickup_address: u.pickup_address,
    dropoff_address: u.dropoff_address,
    vehicle_info: u.vehicle_info || '',
    status: 'HOLDING',
    hold_until: holdUntil.toISOString(),
    uses_extra_capacity: availability.usesExtraCapacity,
    base_duration_min: baseDuration,
    buffer_min: bufferMin,
  }))

  const { data: units, error: unitsError } = await supabase
    .from('line_booking_units')
    .insert(unitRows)
    .select('*')
  if (unitsError) return json({ error: unitsError.message }, 500)

  for (const unit of units) {
    await projectUnit(supabase, booking, unit, 'TENTATIVE')
  }

  const pickupLabel = new Date(units[0].pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const holdLabel = holdUntil.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

  await notify(
    lineUserId,
    buildTentativeCustomerMessage({
      pickupAtLabel: pickupLabel,
      holdUntilLabel: holdLabel,
      discountLabel: discount.applied ? discount.label : null,
    })
  )

  return json({
    ok: true,
    booking,
    units,
    hold_until: holdUntil.toISOString(),
    uses_extra_capacity: availability.usesExtraCapacity,
    discount,
  })
}

async function handleApprove(supabase, body) {
  const unitId = body.unit_id
  const pin = body.pin
  if (!unitId || !pin) return json({ error: 'unit_id and pin required' }, 400)

  const settings = await loadSettings(supabase)
  const pinState = {
    failures: settings.pin_failure_count || 0,
    lockedUntil: settings.pin_locked_until,
  }
  const lockCheck = applyPinAttempt(pinState, true)
  if (!lockCheck.ok && lockCheck.reason === 'LOCKED') {
    return json({ error: 'PIN temporarily locked', reason: 'LOCKED' }, 423)
  }

  const valid = await verifyPin(pin, settings.approval_pin_hash)
  const after = applyPinAttempt(
    { failures: settings.pin_failure_count || 0, lockedUntil: settings.pin_locked_until },
    valid
  )
  await supabase
    .from('line_intake_settings')
    .update({
      pin_failure_count: after.failures,
      pin_locked_until: after.lockedUntil,
    })
    .eq('id', 1)

  if (!valid) {
    return json({ error: 'Invalid PIN', reason: after.reason }, 400)
  }

  const { data: unit, error } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('id', unitId)
    .single()
  if (error || !unit) return json({ error: 'Unit not found' }, 404)
  if (unit.status !== 'HOLDING') return json({ error: 'Unit not in HOLDING' }, 409)

  const booking = unit.line_bookings
  const nowIso = new Date().toISOString()
  await supabase
    .from('line_booking_units')
    .update({ status: 'CONFIRMED', confirmed_at: nowIso, hold_until: null })
    .eq('id', unitId)

  const updatedUnit = { ...unit, status: 'CONFIRMED', confirmed_at: nowIso }
  await projectUnit(supabase, booking, updatedUnit, 'CONFIRMED')

  const { data: siblings } = await supabase
    .from('line_booking_units')
    .select('status')
    .eq('booking_id', booking.id)
  const allConfirmed = (siblings || []).every((s) => s.status === 'CONFIRMED' || s.id === unitId)
  const anyHolding = (siblings || []).some((s) => s.status === 'HOLDING' && s.id !== unitId)
  await supabase
    .from('line_bookings')
    .update({ status: anyHolding ? 'PARTIAL' : allConfirmed ? 'CONFIRMED' : 'PARTIAL' })
    .eq('id', booking.id)

  const pickupLabel = new Date(unit.pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  await notify(
    booking.line_user_id,
    buildConfirmedCustomerMessage({ pickupAtLabel: pickupLabel, sequence: unit.sequence })
  )

  return json({ ok: true, unit_id: unitId })
}

async function handleCancel(supabase, body) {
  const unitId = body.unit_id
  const lineUserId = body.line_user_id
  if (!unitId || !lineUserId) return json({ error: 'unit_id and line_user_id required' }, 400)

  const { data: unit } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('id', unitId)
    .single()
  if (!unit) return json({ error: 'Not found' }, 404)
  if (unit.line_bookings.line_user_id !== lineUserId) return json({ error: 'Forbidden' }, 403)
  if (!['HOLDING', 'CONFIRMED'].includes(unit.status)) {
    return json({ error: 'Cannot cancel' }, 409)
  }

  await supabase
    .from('line_booking_units')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
    .eq('id', unitId)

  if (unit.order_id) {
    await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', unit.order_id)
  }
  if (unit.reservation_id) {
    await supabase.from('reservations').delete().eq('id', unit.reservation_id)
  }

  return json({ ok: true })
}

async function handleAdminUpdate(supabase, body) {
  const unitId = body.unit_id
  const pin = body.pin
  if (!unitId || !pin) return json({ error: 'unit_id and pin required' }, 400)

  const settings = await loadSettings(supabase)
  if (!(await verifyPin(pin, settings.approval_pin_hash))) {
    return json({ error: 'Invalid PIN' }, 400)
  }

  const { data: unit } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('id', unitId)
    .single()
  if (!unit) return json({ error: 'Not found' }, 404)
  const booking = unit.line_bookings

  if (body.action === 'admin_delete') {
    await supabase
      .from('line_booking_units')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
      .eq('id', unitId)
    if (unit.order_id) await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', unit.order_id)
    if (unit.reservation_id) await supabase.from('reservations').delete().eq('id', unit.reservation_id)
    await notify(
      booking.line_user_id,
      `【予約取消】\n運営により予約が取り消されました。\nお迎え予定: ${new Date(unit.pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
    )
    return json({ ok: true })
  }

  if (body.action === 'admin_reschedule' && body.pickup_at) {
    const newPickup = new Date(body.pickup_at)
    await supabase
      .from('line_booking_units')
      .update({ pickup_at: newPickup.toISOString() })
      .eq('id', unitId)
    const refreshed = { ...unit, pickup_at: newPickup.toISOString() }
    await projectUnit(supabase, booking, refreshed, unit.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE')
    await notify(
      booking.line_user_id,
      `【時間変更】\nお迎え時間が変更されました。\n新日時: ${newPickup.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
    )
    return json({ ok: true })
  }

  return json({ error: 'Unknown admin action' }, 400)
}

async function handleSetPin(supabase, body) {
  const pin = body.pin
  const { hashPin: hp, isValidPinFormat } = await import('../../../shared/lineIntake/pin.js')
  if (!isValidPinFormat(pin)) return json({ error: 'PIN must be 6 digits' }, 400)
  const hashed = await hp(pin)
  await supabase
    .from('line_intake_settings')
    .update({
      approval_pin_hash: hashed,
      pin_failure_count: 0,
      pin_locked_until: null,
    })
    .eq('id', 1)
  return json({ ok: true })
}

async function handleUpdateSettings(supabase, body) {
  const patch = {}
  for (const key of [
    'weekday_fleet_count',
    'weekend_fleet_count',
    'max_fleet_count',
    'extra_capacity_max',
    'discount_config',
    'reminder_customer_minutes',
    'phone_intake_start_hour',
  ]) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (body.pin) {
    const hashed = await hashPin(body.pin)
    patch.approval_pin_hash = hashed
    patch.pin_failure_count = 0
    patch.pin_locked_until = null
  }
  const { data, error } = await supabase
    .from('line_intake_settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .single()
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, settings: data })
}

async function handleReproject(supabase, body) {
  const unitId = body.unit_id
  const { data: unit } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('id', unitId)
    .single()
  if (!unit) return json({ error: 'Not found' }, 404)
  const result = await projectUnit(
    supabase,
    unit.line_bookings,
    unit,
    unit.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE'
  )
  return json({ ok: !result.error, ...result })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Secrets 参照可能性（コード側で読めることを保証）
  const _secretsProbe = {
    LINE_CHANNEL_SECRET: Deno.env.get('LINE_CHANNEL_SECRET'),
    LINE_LIFF_ID: Deno.env.get('LINE_LIFF_ID'),
  }
  void _secretsProbe

  try {
    const supabase = getSupabase()
    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
    const action = body.action || new URL(req.url).searchParams.get('action')

    if (action === 'check' || action === 'availability') return await handleCheck(supabase, body)
    if (action === 'submit') return await handleSubmit(supabase, body)
    if (action === 'approve') return await handleApprove(supabase, body)
    if (action === 'cancel') return await handleCancel(supabase, body)
    if (action === 'admin_delete' || action === 'admin_reschedule') {
      return await handleAdminUpdate(supabase, { ...body, action })
    }
    if (action === 'set_pin') return await handleSetPin(supabase, body)
    if (action === 'update_settings') return await handleUpdateSettings(supabase, body)
    if (action === 'reproject') return await handleReproject(supabase, body)
    if (action === 'list_holding') {
      const { data, error } = await supabase
        .from('line_booking_units')
        .select('*, line_bookings(*)')
        .in('status', ['HOLDING', 'CONFIRMED'])
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) return json({ error: error.message }, 500)
      return json({ data })
    }

    return json({ error: 'Unknown action', hint: 'submit|check|approve|cancel|...' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: e?.message || 'Internal error' }, 500)
  }
})
