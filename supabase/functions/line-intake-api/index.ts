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
import {
  checkAvailability,
  isPhoneIntakeOpen,
  nextLiffPickupAt,
} from '../../../shared/lineIntake/availability.js'
import { calculateLineBuffer } from '../../../shared/lineIntake/buffer.js'
import { snapshotDiscount } from '../../../shared/lineIntake/discount.js'
import { computeHoldUntil } from '../../../shared/lineIntake/holdDeadline.js'
import { fetchDirectionsDurationMinutes } from '../../../shared/lineIntake/mapsDirections.js'
import {
  buildConfirmedCustomerMessage,
  buildTentativeCustomerMessage,
  pushTextWithRetry,
} from '../../../shared/lineIntake/messaging.js'
import { applyPinAttempt, hashPin, isValidPinFormat, verifyPin } from '../../../shared/lineIntake/pin.js'
import {
  buildLineChannelMarkers,
  resolveProjectionTarget,
  toBoardRouteFields,
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

async function getStaffUser(req, supabase) {
  const header = req.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (anon && token === anon) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

async function consumePinAttempt(supabase, pin) {
  const settings = await loadSettings(supabase)
  const pinState = {
    failures: settings.pin_failure_count || 0,
    lockedUntil: settings.pin_locked_until,
  }
  const lockCheck = applyPinAttempt(pinState, true)
  if (!lockCheck.ok && lockCheck.reason === 'LOCKED') {
    return { ok: false, status: 423, error: 'PIN temporarily locked', reason: 'LOCKED' }
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
    return { ok: false, status: 400, error: 'Invalid PIN', reason: after.reason || 'INVALID_PIN' }
  }
  return { ok: true }
}

async function loadSettings(supabase) {
  const { data, error } = await supabase.from('line_intake_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

async function loadWaitingLocation(supabase) {
  const { data } = await supabase
    .from('vehicles')
    .select('waiting_location_address')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.waiting_location_address || null
}

function mapsApiKey() {
  return Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')
}

async function resolveMapsDuration(pickupAddress, dropoffAddress, options = {}) {
  if (options.baseOverride != null && Number(options.baseOverride) > 0) {
    return Number(options.baseOverride)
  }
  const dir = await fetchDirectionsDurationMinutes({
    origin: pickupAddress,
    destination: dropoffAddress,
    waitingLocationAddress: options.waitingLocationAddress,
    apiKey: mapsApiKey(),
  })
  return dir.duration
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

function clipDbText(value, max) {
  const text = String(value || '').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

/**
 * 配車ボードは CONFIRMED の未割当 order を出さない。スロットが無いとタイムラインにも出ない。
 * LINE 承認後は UNASSIGNED → 空き号車へ TENTATIVE スロット。
 */
async function ensureBoardSlot(supabase, orderId, unit, route) {
  const { data: existing } = await supabase
    .from('dispatch_slots')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)
  if (existing?.length) return { placed: true, existing: true }

  const start = new Date(unit.pickup_at)
  if (Number.isNaN(start.getTime())) return { placed: false, reason: 'invalid pickup_at' }
  const durMin = Math.max(15, Number(route.base_duration_min) || 30)
  const end = new Date(start.getTime() + durMin * 60 * 1000)

  const { data: vehicles, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (vehicleError) throw vehicleError
  if (!vehicles?.length) return { placed: false, reason: 'no vehicles' }

  const { data: overlaps } = await supabase
    .from('dispatch_slots')
    .select('vehicle_id')
    .lt('start_at', end.toISOString())
    .gt('end_at', start.toISOString())
  const busy = new Set((overlaps || []).map((slot) => slot.vehicle_id))
  const vehicle = vehicles.find((row) => !busy.has(row.id))
  if (!vehicle) return { placed: false, reason: 'no free vehicle' }

  const { error: slotError } = await supabase.from('dispatch_slots').insert([
    {
      order_id: orderId,
      vehicle_id: vehicle.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: 'TENTATIVE',
    },
  ])
  if (slotError) throw slotError
  await supabase.from('orders').update({ status: 'TENTATIVE' }).eq('id', orderId)
  return { placed: true }
}

async function projectUnit(supabase, booking, unit, statusForOrder = 'TENTATIVE') {
  const markers = buildLineChannelMarkers({
    lineUserId: booking.line_user_id,
    unitId: unit.id,
    discountLabel: booking.discount_snapshot?.label,
  })
  const target = resolveProjectionTarget(unit.pickup_at, new Date())
  const approved = statusForOrder === 'CONFIRMED'
  try {
    if (target === 'BOARD') {
      if (!unit.order_id && !approved) {
        return { target, skipped: true }
      }
      const route = toBoardRouteFields(unit)
      const orderPayload = {
        order_type: 'SCHEDULED',
        scheduled_at: unit.pickup_at,
        pickup_address: unit.pickup_address,
        dropoff_address: unit.dropoff_address,
        contact_phone: clipDbText(booking.contact_phone, 20),
        car_model: clipDbText(unit.vehicle_info, 50),
        parking_note: markers.memo_prefix,
        base_duration_min: route.base_duration_min,
        buffer_min: route.buffer_min,
      }
      let orderId = unit.order_id
      if (orderId) {
        const { error } = await supabase.from('orders').update(orderPayload).eq('id', orderId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('orders')
          .insert([{ ...orderPayload, status: 'UNASSIGNED' }])
          .select('id')
          .single()
        if (error) throw error
        orderId = data.id
      }
      if (approved) {
        const slotResult = await ensureBoardSlot(supabase, orderId, unit, route)
        if (!slotResult.placed) {
          await supabase.from('orders').update({ status: 'UNASSIGNED' }).eq('id', orderId)
        }
      }
      await supabase
        .from('line_booking_units')
        .update({ order_id: orderId, reservation_id: null, projection_error: null })
        .eq('id', unit.id)
      return { target, orderId }
    }

    if (!unit.reservation_id && !approved) {
      return { target, skipped: true }
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
  try {
    return await pushTextWithRetry({ to, text, accessToken: token })
  } catch (error) {
    console.error('LINE notify failed:', error)
    return { ok: false, error: error?.message || 'notify failed' }
  }
}

/** 投影先の枠を解放（スロット削除・依頼キャンセル・予約台帳削除） */
async function releaseUnitCapacity(supabase, unit) {
  if (unit.order_id) {
    await supabase.from('dispatch_slots').delete().eq('order_id', unit.order_id)
    await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', unit.order_id)
  }
  if (unit.reservation_id) {
    await supabase.from('reservations').delete().eq('id', unit.reservation_id)
  }
}

async function markUnitCancelled(supabase, unitId) {
  const { error } = await supabase
    .from('line_booking_units')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), hold_until: null })
    .eq('id', unitId)
  if (error) throw error
}

async function syncBookingStatus(supabase, bookingId) {
  if (!bookingId) return
  const { data: siblings } = await supabase
    .from('line_booking_units')
    .select('status')
    .eq('booking_id', bookingId)
  const statuses = (siblings || []).map((row) => row.status)
  const anyHolding = statuses.includes('HOLDING')
  const anyConfirmed = statuses.includes('CONFIRMED')
  const next = anyHolding
    ? anyConfirmed
      ? 'PARTIAL'
      : 'PENDING'
    : anyConfirmed
      ? 'CONFIRMED'
      : 'CANCELLED'
  await supabase.from('line_bookings').update({ status: next }).eq('id', bookingId)
}

async function handleCheck(supabase, body) {
  const settings = await loadSettings(supabase)
  const waitingLocationAddress = await loadWaitingLocation(supabase)
  const baseDuration = await resolveMapsDuration(body.pickup_address, body.dropoff_address, {
    baseOverride: body.base_duration_min,
    waitingLocationAddress,
  })
  const now = new Date()
  const orderType = body.order_type || 'SCHEDULED'
  let pickupAt = body.pickup_at ? new Date(body.pickup_at) : now
  if (orderType === 'NOW' && !isPhoneIntakeOpen(now)) {
    pickupAt = nextLiffPickupAt(now)
  }
  const durationMin = (baseDuration || 20) + calculateLineBuffer(baseDuration)
  const occupiedIntervals = await loadOccupiedIntervals(supabase, pickupAt, durationMin)
  const phoneLocks = await loadPhoneLocks(supabase, pickupAt)
  const result = checkAvailability({
    now,
    desiredPickupAt: pickupAt,
    orderType,
    unitCount: 1,
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
  if (unitsInput.length !== 1) {
    return json(
      { error: '1回の予約は1台までです。他の車は持ち主がそれぞれLINE予約してください' },
      400
    )
  }

  const settings = await loadSettings(supabase)
  const discount = snapshotDiscount(settings.discount_config)
  const orderType = body.order_type || 'SCHEDULED'
  const now = new Date()
  const waitingLocationAddress = await loadWaitingLocation(supabase)
  const u = unitsInput[0]
  const unitBase = await resolveMapsDuration(u.pickup_address, u.dropoff_address, {
    baseOverride: u.base_duration_min,
    waitingLocationAddress,
  })
  const pickupAt = orderType === 'NOW' ? now : new Date(u.pickup_at)
  if (Number.isNaN(pickupAt.getTime())) {
    return json({ ok: false, reason: 'INVALID_PICKUP', discount })
  }
  const durationMin = (unitBase || 20) + calculateLineBuffer(unitBase)
  const occupiedIntervals = await loadOccupiedIntervals(supabase, pickupAt, durationMin)
  const phoneLocks = await loadPhoneLocks(supabase, pickupAt)
  const availability = checkAvailability({
    now,
    desiredPickupAt: pickupAt,
    orderType,
    unitCount: 1,
    baseDurationMin: unitBase,
    occupiedIntervals,
    phoneLocks,
    settings,
  })
  if (!availability.ok) {
    return json({ ok: false, ...availability, discount })
  }
  const usesExtraCapacity = Boolean(availability.usesExtraCapacity)

  const holdUntil = computeHoldUntil(now)
  const holdUntilIso = holdUntil.toISOString()

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

  const unitRows = [
    {
      booking_id: booking.id,
      sequence: 1,
      pickup_at: pickupAt.toISOString(),
      pickup_address: u.pickup_address,
      dropoff_address: u.dropoff_address,
      vehicle_info: u.vehicle_info || '',
      status: 'HOLDING',
      confirmed_at: null,
      hold_until: holdUntilIso,
      uses_extra_capacity: usesExtraCapacity,
      base_duration_min: unitBase,
      buffer_min: calculateLineBuffer(unitBase),
    },
  ]

  const { data: units, error: unitsError } = await supabase
    .from('line_booking_units')
    .insert(unitRows)
    .select('*')
  if (unitsError) return json({ error: unitsError.message }, 500)

  const pickupLabel = new Date(units[0].pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const holdUntilLabel = holdUntil.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  await notify(
    lineUserId,
    buildTentativeCustomerMessage({
      pickupAtLabel: pickupLabel,
      holdUntilLabel,
      discountLabel: discount?.applied ? discount.label : null,
    })
  )

  return json({
    ok: true,
    booking,
    units,
    uses_extra_capacity: usesExtraCapacity,
    discount,
  })
}

async function handleVerifyPin(supabase, body) {
  const pin = body.pin
  if (!isValidPinFormat(pin)) return json({ error: 'PIN must be 6 digits' }, 400)
  const result = await consumePinAttempt(supabase, pin)
  if (!result.ok) return json({ error: result.error, reason: result.reason }, result.status)
  return json({ ok: true })
}

async function handleApprove(supabase, body, staffUser = null) {
  const unitId = body.unit_id
  if (!unitId) return json({ error: 'unit_id required' }, 400)
  if (!staffUser) {
    if (!isValidPinFormat(body.pin)) return json({ error: 'unit_id and pin required' }, 400)
    const pinResult = await consumePinAttempt(supabase, body.pin)
    if (!pinResult.ok) return json({ error: pinResult.error, reason: pinResult.reason }, pinResult.status)
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
    buildConfirmedCustomerMessage({ pickupAtLabel: pickupLabel })
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

  await markUnitCancelled(supabase, unitId)
  await releaseUnitCapacity(supabase, unit)
  await syncBookingStatus(supabase, unit.booking_id)

  return json({ ok: true })
}

async function handleAdminUpdate(supabase, body, staffUser = null) {
  const unitId = body.unit_id
  if (!unitId) return json({ error: 'unit_id required' }, 400)
  if (!staffUser) {
    if (!isValidPinFormat(body.pin)) {
      return json({ error: 'ログインし直すか、PIN を入力してください' }, 401)
    }
    const pinResult = await consumePinAttempt(supabase, body.pin)
    if (!pinResult.ok) return json({ error: pinResult.error, reason: pinResult.reason }, pinResult.status)
  }

  const { data: unit } = await supabase
    .from('line_booking_units')
    .select('*, line_bookings(*)')
    .eq('id', unitId)
    .single()
  if (!unit) return json({ error: 'Not found' }, 404)
  const booking = unit.line_bookings

  if (body.action === 'admin_delete') {
    if (['CANCELLED', 'EXPIRED'].includes(unit.status)) {
      await releaseUnitCapacity(supabase, unit)
      await syncBookingStatus(supabase, unit.booking_id)
      return json({ ok: true })
    }
    await markUnitCancelled(supabase, unitId)
    await releaseUnitCapacity(supabase, unit)
    await syncBookingStatus(supabase, unit.booking_id)
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
    const staffUser = await getStaffUser(req, supabase)

    if (action === 'check' || action === 'availability') return await handleCheck(supabase, body)
    if (action === 'submit') return await handleSubmit(supabase, body)
    if (action === 'verify_pin') return await handleVerifyPin(supabase, body)
    if (action === 'approve') return await handleApprove(supabase, body, staffUser)
    if (action === 'cancel') return await handleCancel(supabase, body)
    if (action === 'admin_delete' || action === 'admin_reschedule') {
      return await handleAdminUpdate(supabase, { ...body, action }, staffUser)
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
