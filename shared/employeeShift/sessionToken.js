/** 従業員シフト希望セッション TTL（8時間） */
export const EMPLOYEE_SESSION_TTL_MS = 8 * 60 * 60 * 1000

const SESSION_VERSION = 1

function base64UrlEncode(input) {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
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
 * @param {string} secret
 * @param {string} payloadB64
 * @returns {Promise<string>}
 */
async function signPayloadB64(secret, payloadB64) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  return base64UrlEncode(new Uint8Array(sig))
}

/**
 * @param {{ employeeId: string, name: string, secret: string, now?: number }} input
 * @returns {Promise<string>}
 */
export async function signEmployeeSession({ employeeId, name, secret, now = Date.now() }) {
  if (!secret) throw new Error('Session secret is required')
  const payload = {
    v: SESSION_VERSION,
    employee_id: employeeId,
    name,
    exp: now + EMPLOYEE_SESSION_TTL_MS,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = await signPayloadB64(secret, payloadB64)
  return `${payloadB64}.${sigB64}`
}

/**
 * @param {string} token
 * @param {string} secret
 * @param {number} [now]
 * @returns {Promise<{ employee_id: string, name: string, exp: number }|null>}
 */
export async function verifyEmployeeSession(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expectedSig = await signPayloadB64(secret, payloadB64)
  if (!timingSafeEqual(expectedSig, sigB64)) return null

  let payload
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64))
  } catch {
    return null
  }

  if (payload?.v !== SESSION_VERSION) return null
  if (!payload?.employee_id || !payload?.name) return null
  if (typeof payload.exp !== 'number' || payload.exp < now) return null

  return {
    employee_id: payload.employee_id,
    name: payload.name,
    exp: payload.exp,
  }
}
