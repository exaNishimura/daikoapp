import { describe, expect, it } from 'vitest'
import { applyPinAttempt, hashPin, isValidPinFormat, verifyPin } from './pin.js'

describe('isValidPinFormat', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidPinFormat('123456')).toBe(true)
    expect(isValidPinFormat('12')).toBe(false)
    expect(isValidPinFormat('abcdef')).toBe(false)
  })
})

describe('hashPin / verifyPin', () => {
  it('hashes without storing plaintext and verifies', async () => {
    const stored = await hashPin('654321')
    expect(stored.startsWith('v1:')).toBe(true)
    expect(stored.includes('654321')).toBe(false)
    expect(await verifyPin('654321', stored)).toBe(true)
    expect(await verifyPin('000000', stored)).toBe(false)
  })
})

describe('applyPinAttempt', () => {
  it('locks after max failures and blocks until unlock', () => {
    let state = { failures: 4, lockedUntil: null }
    const now = new Date('2026-08-11T00:00:00.000Z')
    const locked = applyPinAttempt(state, false, now)
    expect(locked.ok).toBe(false)
    expect(locked.reason).toBe('INVALID_PIN_LOCKED')
    expect(locked.lockedUntil).toBeTruthy()

    const blocked = applyPinAttempt(
      { failures: locked.failures, lockedUntil: locked.lockedUntil },
      true,
      now
    )
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('LOCKED')
  })

  it('resets on success', () => {
    const result = applyPinAttempt({ failures: 2, lockedUntil: null }, true)
    expect(result).toEqual({ ok: true, failures: 0, lockedUntil: null })
  })
})
