import { supabase } from '@/lib/supabase'
import { getEmployeeShiftSession } from '@/lib/employeeShift/employeeShiftSession'

const FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : ''

/**
 * Edge Function employee-shift-api を呼ぶ
 * @param {object} body
 * @param {{ employeeSession?: boolean }} [options]
 */
export async function callEmployeeShiftApi(body, options = {}) {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!FUNCTIONS_BASE) {
    return { data: null, error: new Error('VITE_SUPABASE_URL not configured') }
  }

  try {
    const {
      data: { session },
    } = supabase ? await supabase.auth.getSession() : { data: { session: null } }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || anon}`,
      apikey: anon,
    }

    if (options.employeeSession) {
      const empSession = getEmployeeShiftSession()
      if (empSession?.token) {
        headers['X-Employee-Session'] = empSession.token
      }
    }

    const res = await fetch(`${FUNCTIONS_BASE}/employee-shift-api`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        data: null,
        error: new Error(data.error || `HTTP ${res.status}`),
        status: res.status,
        raw: data,
      }
    }
    return { data, error: null }
  } catch (error) {
    console.error('employeeShiftApi error:', error)
    return { data: null, error }
  }
}

export async function verifyShiftPin(pin) {
  return callEmployeeShiftApi({ action: 'verify_shift_pin', pin })
}

export async function setEmployeeShiftPin(employeeId, pin) {
  return callEmployeeShiftApi({
    action: 'set_shift_pin',
    employee_id: employeeId,
    ...(pin ? { pin } : {}),
  })
}

export async function clearEmployeeShiftPin(employeeId) {
  return callEmployeeShiftApi({ action: 'clear_shift_pin', employee_id: employeeId })
}

export async function getShiftAvailabilityRequest(month) {
  return callEmployeeShiftApi(
    { action: 'get_request', month },
    { employeeSession: true }
  )
}

export async function saveShiftAvailabilityRequest(month, payload) {
  return callEmployeeShiftApi(
    { action: 'save_request', month, payload },
    { employeeSession: true }
  )
}

export async function listShiftAvailabilityRequests(month) {
  return callEmployeeShiftApi({ action: 'list_requests', month })
}
