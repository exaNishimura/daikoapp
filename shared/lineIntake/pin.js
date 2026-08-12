/**
 * 共有 6 桁 PIN のハッシュ化・検証（Web Crypto）
 * 保存形式: `v1:<saltHex>:<hashHex>`
 */

const PIN_RE = /^\d{6}$/
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

/**
 * @param {string} pin
 * @returns {boolean}
 */
export function isValidPinFormat(pin) {
  return PIN_RE.test(String(pin ?? ''))
}

/**
 * @returns {string}
 */
function randomSaltHex(bytes = 16) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const clean = String(hex)
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
function bufferToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {string} pin
 * @param {string} saltHex
 * @returns {Promise<string>}
 */
async function deriveHashHex(pin, saltHex) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return bufferToHex(bits)
}

/**
 * @param {string} pin
 * @returns {Promise<string>} stored hash string
 */
export async function hashPin(pin) {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be exactly 6 digits')
  }
  const salt = randomSaltHex()
  const hash = await deriveHashHex(pin, salt)
  return `v1:${salt}:${hash}`
}

/**
 * @param {string} pin
 * @param {string|null|undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin, stored) {
  if (!isValidPinFormat(pin) || !stored) return false
  const parts = String(stored).split(':')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const [, salt, expected] = parts
  const actual = await deriveHashHex(pin, salt)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/**
 * 失敗回数制限の状態遷移（純粋関数）
 * @param {{ failures: number, lockedUntil: string|null }} state
 * @param {boolean} success
 * @param {Date} [now]
 * @returns {{ ok: boolean, failures: number, lockedUntil: string|null, reason?: string }}
 */
export function applyPinAttempt(state, success, now = new Date()) {
  const lockedUntilMs = state.lockedUntil ? new Date(state.lockedUntil).getTime() : 0
  if (lockedUntilMs && lockedUntilMs > now.getTime()) {
    return {
      ok: false,
      failures: state.failures,
      lockedUntil: state.lockedUntil,
      reason: 'LOCKED',
    }
  }

  if (success) {
    return { ok: true, failures: 0, lockedUntil: null }
  }

  const failures = (state.failures || 0) + 1
  if (failures >= MAX_FAILURES) {
    return {
      ok: false,
      failures,
      lockedUntil: new Date(now.getTime() + LOCK_MS).toISOString(),
      reason: 'INVALID_PIN_LOCKED',
    }
  }
  return { ok: false, failures, lockedUntil: null, reason: 'INVALID_PIN' }
}

export const PIN_MAX_FAILURES = MAX_FAILURES
