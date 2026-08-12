import { describe, expect, it } from 'vitest'
import { shouldIgnoreWebhookEvent, verifyLineSignature } from './webhookSignature.js'

describe('verifyLineSignature', () => {
  it('validates HMAC-SHA256 base64 signature', async () => {
    const secret = 'channel-secret'
    const body = '{"events":[]}'
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body))
    const sig = btoa(String.fromCharCode(...new Uint8Array(mac)))
    expect(await verifyLineSignature(body, secret, sig)).toBe(true)
    expect(await verifyLineSignature(body, secret, 'bad')).toBe(false)
  })
})

describe('shouldIgnoreWebhookEvent', () => {
  it('ignores group/room and message events', () => {
    expect(shouldIgnoreWebhookEvent({ type: 'message', source: { type: 'user' } })).toBe(true)
    expect(shouldIgnoreWebhookEvent({ type: 'follow', source: { type: 'group' } })).toBe(true)
    expect(shouldIgnoreWebhookEvent({ type: 'follow', source: { type: 'user' } })).toBe(false)
  })
})
