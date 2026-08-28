/**
 * 従業員シフト希望 API（配車 PIN とは別系統）
 *
 * Actions:
 * - verify_shift_pin: PIN → employee 特定 + セッショントークン
 * - set_shift_pin: 管理者が従業員 PIN を発行/再発行
 * - clear_shift_pin: 管理者が PIN 解除
 * - get_request / save_request: 従業員セッションで希望 CRUD
 * - list_requests: 管理者が月次希望一覧
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMPLOYEE_SHIFT_SESSION_SECRET (推奨)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateRandomPin } from '../../../shared/employeeShift/generatePin.js'
import {
  signEmployeeSession,
  verifyEmployeeSession,
} from '../../../shared/employeeShift/sessionToken.js'
import { applyPinAttempt, hashPin, isValidPinFormat, verifyPin } from '../../../shared/lineIntake/pin.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-employee-session',
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

function getSessionSecret() {
  return (
    Deno.env.get('EMPLOYEE_SHIFT_SESSION_SECRET') ||
    Deno.env.get('CRON_SECRET') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 32) ||
    ''
  )
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

async function getEmployeeSession(req) {
  const secret = getSessionSecret()
  if (!secret) return null
  const headerToken = req.headers.get('X-Employee-Session')?.trim()
  if (headerToken) {
    return verifyEmployeeSession(headerToken, secret)
  }
  return null
}

function normalizeMonth(month) {
  const s = String(month ?? '').trim()
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return null
  const [y, m] = s.split('-')
  return `${y}-${m}-01`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pin
 * @param {string|null} excludeEmployeeId
 */
async function isPinUsedByOtherEmployee(supabase, pin, excludeEmployeeId = null) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, shift_pin_hash')
    .eq('is_active', true)
    .eq('shift_pin_configured', true)
  if (error) throw error
  for (const emp of data || []) {
    if (excludeEmployeeId && emp.id === excludeEmployeeId) continue
    if (emp.shift_pin_hash && (await verifyPin(pin, emp.shift_pin_hash))) {
      return true
    }
  }
  return false
}

async function handleVerifyShiftPin(supabase, body) {
  const pin = body.pin
  if (!isValidPinFormat(pin)) {
    return json({ error: 'PINは6桁の数字で入力してください', reason: 'INVALID_FORMAT' }, 400)
  }

  const { data: candidates, error } = await supabase
    .from('employees')
    .select('id, name, shift_pin_hash, shift_pin_failures, shift_pin_locked_until')
    .eq('is_active', true)
    .eq('shift_pin_configured', true)

  if (error) return json({ error: error.message }, 500)

  const nowMs = Date.now()

  for (const emp of candidates || []) {
    if (!emp.shift_pin_hash) continue
    const lockedUntilMs = emp.shift_pin_locked_until
      ? new Date(emp.shift_pin_locked_until).getTime()
      : 0
    const isLocked = lockedUntilMs > nowMs

    const valid = await verifyPin(pin, emp.shift_pin_hash)
    if (!valid) continue

    if (isLocked) {
      return json(
        { error: 'PINがロックされています。しばらく待ってください', reason: 'LOCKED' },
        423
      )
    }

    const after = applyPinAttempt(
      {
        failures: emp.shift_pin_failures || 0,
        lockedUntil: emp.shift_pin_locked_until,
      },
      true
    )
    await supabase
      .from('employees')
      .update({
        shift_pin_failures: after.failures,
        shift_pin_locked_until: after.lockedUntil,
      })
      .eq('id', emp.id)

    const secret = getSessionSecret()
    if (!secret) return json({ error: 'Server misconfigured' }, 500)
    const token = await signEmployeeSession({
      employeeId: emp.id,
      name: emp.name,
      secret,
    })

    return json({
      ok: true,
      token,
      employee: { id: emp.id, name: emp.name },
    })
  }

  return json({ error: 'PINが正しくありません', reason: 'INVALID_PIN' }, 400)
}

async function handleSetShiftPin(supabase, body, staffUser) {
  if (!staffUser) return json({ error: '管理者ログインが必要です' }, 401)

  const employeeId = body.employee_id
  if (!employeeId) return json({ error: 'employee_id required' }, 400)

  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, name')
    .eq('id', employeeId)
    .single()
  if (empErr || !employee) return json({ error: '従業員が見つかりません' }, 404)

  let pin = body.pin
  if (pin != null && pin !== '') {
    if (!isValidPinFormat(pin)) {
      return json({ error: 'PINは6桁の数字で入力してください' }, 400)
    }
  } else {
    pin = generateRandomPin()
  }

  if (await isPinUsedByOtherEmployee(supabase, pin, employeeId)) {
    return json({ error: '他の従業員と同じPINは設定できません' }, 409)
  }

  const hashed = await hashPin(pin)
  const { error: updErr } = await supabase
    .from('employees')
    .update({
      shift_pin_hash: hashed,
      shift_pin_configured: true,
      shift_pin_failures: 0,
      shift_pin_locked_until: null,
    })
    .eq('id', employeeId)

  if (updErr) return json({ error: updErr.message }, 500)

  return json({
    ok: true,
    employee_id: employeeId,
    employee_name: employee.name,
    pin,
  })
}

async function handleClearShiftPin(supabase, body, staffUser) {
  if (!staffUser) return json({ error: '管理者ログインが必要です' }, 401)
  const employeeId = body.employee_id
  if (!employeeId) return json({ error: 'employee_id required' }, 400)

  const { error } = await supabase
    .from('employees')
    .update({
      shift_pin_hash: null,
      shift_pin_configured: false,
      shift_pin_failures: 0,
      shift_pin_locked_until: null,
    })
    .eq('id', employeeId)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}

async function handleGetRequest(supabase, body, employeeSession) {
  if (!employeeSession) return json({ error: '従業員セッションが必要です' }, 401)
  const month = normalizeMonth(body.month)
  if (!month) return json({ error: 'month (YYYY-MM) required' }, 400)

  const { data, error } = await supabase
    .from('shift_availability_requests')
    .select('*')
    .eq('employee_id', employeeSession.employee_id)
    .eq('month', month)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)

  return json({
    ok: true,
    month,
    payload: data?.payload ?? { days: {}, notes: '' },
    submitted_at: data?.submitted_at ?? null,
    updated_at: data?.updated_at ?? null,
  })
}

async function handleSaveRequest(supabase, body, employeeSession) {
  if (!employeeSession) return json({ error: '従業員セッションが必要です' }, 401)
  const month = normalizeMonth(body.month)
  if (!month) return json({ error: 'month (YYYY-MM) required' }, 400)

  const payload = body.payload
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'payload required' }, 400)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('shift_availability_requests')
    .upsert(
      {
        employee_id: employeeSession.employee_id,
        month,
        payload,
        updated_at: now,
        submitted_at: now,
      },
      { onConflict: 'employee_id,month' }
    )
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, data })
}

async function handleListRequests(supabase, body, staffUser) {
  if (!staffUser) return json({ error: '管理者ログインが必要です' }, 401)
  const month = normalizeMonth(body.month)
  if (!month) return json({ error: 'month (YYYY-MM) required' }, 400)

  const [{ data: requests, error: reqErr }, { data: employees, error: empErr }] = await Promise.all([
    supabase
      .from('shift_availability_requests')
      .select('*')
      .eq('month', month)
      .order('updated_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id, name, license_type, color, is_active, shift_pin_configured')
      .order('sort_order', { ascending: true }),
  ])

  if (reqErr) return json({ error: reqErr.message }, 500)
  if (empErr) return json({ error: empErr.message }, 500)

  const byEmployee = new Map((requests || []).map((r) => [r.employee_id, r]))

  const rows = (employees || [])
    .filter((e) => e.is_active !== false)
    .map((emp) => {
      const req = byEmployee.get(emp.id)
      const days = req?.payload?.days ?? {}
      const availableCount = Object.values(days).filter((d) => d?.available).length
      return {
        employee_id: emp.id,
        employee_name: emp.name,
        license_type: emp.license_type,
        shift_pin_configured: emp.shift_pin_configured,
        has_request: Boolean(req),
        available_days: availableCount,
        payload: req?.payload ?? null,
        submitted_at: req?.submitted_at ?? null,
        updated_at: req?.updated_at ?? null,
      }
    })

  return json({ ok: true, month, rows })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = getSupabase()
    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
    const action = body.action || new URL(req.url).searchParams.get('action')
    const staffUser = await getStaffUser(req, supabase)
    const employeeSession = await getEmployeeSession(req)

    if (action === 'verify_shift_pin') return await handleVerifyShiftPin(supabase, body)
    if (action === 'set_shift_pin') return await handleSetShiftPin(supabase, body, staffUser)
    if (action === 'clear_shift_pin') return await handleClearShiftPin(supabase, body, staffUser)
    if (action === 'get_request') return await handleGetRequest(supabase, body, employeeSession)
    if (action === 'save_request') return await handleSaveRequest(supabase, body, employeeSession)
    if (action === 'list_requests') return await handleListRequests(supabase, body, staffUser)

    return json(
      {
        error: 'Unknown action',
        hint: 'verify_shift_pin|set_shift_pin|clear_shift_pin|get_request|save_request|list_requests',
      },
      400
    )
  } catch (e) {
    console.error(e)
    return json({ error: e?.message || 'Internal error' }, 500)
  }
})
