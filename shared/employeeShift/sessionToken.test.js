import { describe, expect, it } from 'vitest'
import {
  EMPLOYEE_SESSION_TTL_MS,
  signEmployeeSession,
  verifyEmployeeSession,
} from './sessionToken.js'

describe('employee session token', () => {
  const secret = 'test-secret-key-for-hmac'

  it('signs and verifies a valid token', async () => {
    const token = await signEmployeeSession({
      employeeId: 'emp-1',
      name: '西村',
      secret,
      now: 1_000_000,
    })
    const payload = await verifyEmployeeSession(token, secret, 1_000_000)
    expect(payload).toEqual({
      employee_id: 'emp-1',
      name: '西村',
      exp: 1_000_000 + EMPLOYEE_SESSION_TTL_MS,
    })
  })

  it('rejects expired token', async () => {
    const token = await signEmployeeSession({
      employeeId: 'emp-1',
      name: '西村',
      secret,
      now: 1_000_000,
    })
    const payload = await verifyEmployeeSession(
      token,
      secret,
      1_000_000 + EMPLOYEE_SESSION_TTL_MS + 1
    )
    expect(payload).toBeNull()
  })

  it('rejects tampered token', async () => {
    const token = await signEmployeeSession({
      employeeId: 'emp-1',
      name: '西村',
      secret,
    })
    const tampered = `${token}x`
    expect(await verifyEmployeeSession(tampered, secret)).toBeNull()
  })
})
