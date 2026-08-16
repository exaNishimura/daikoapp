import { describe, expect, it, vi } from 'vitest'
import {
  buildApprovalRequestGroupMessage,
  buildHoldExpiredCustomerMessage,
  buildPushBody,
  buildTentativeCustomerMessage,
  pushTextWithRetry,
} from './messaging.js'

describe('messaging builders', () => {
  it('builds push body', () => {
    expect(buildPushBody('Uxxx', 'hello')).toEqual({
      to: 'Uxxx',
      messages: [{ type: 'text', text: 'hello' }],
    })
  })

  it('includes 要手配 when extra capacity', () => {
    const text = buildApprovalRequestGroupMessage({
      bookingId: 'b1',
      unitCount: 1,
      pickupAtLabel: '8/12 20:00',
      usesExtraCapacity: true,
      customerPhone: '090',
    })
    expect(text).toContain('要手配')
  })

  it('customer tentative and expire messages', () => {
    expect(buildTentativeCustomerMessage({ pickupAtLabel: 'x', holdUntilLabel: 'y' })).toContain(
      '仮受付完了'
    )
    expect(buildHoldExpiredCustomerMessage({ pickupAtLabel: 'x' })).toContain('埋まっている可能性')
  })
})

describe('pushTextWithRetry', () => {
  it('retries then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{}' })
    const sleep = vi.fn(async () => {})
    const result = await pushTextWithRetry({
      to: 'U1',
      text: 'hi',
      accessToken: 'tok',
      fetchImpl,
      sleep,
      maxRetries: 3,
    })
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
