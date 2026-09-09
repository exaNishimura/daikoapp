import { afterEach, describe, expect, it } from 'vitest'
import {
  DEV_AUTH_BYPASS_KEY,
  DEV_AUTH_LOGGED_OUT_KEY,
  canUseDevAuthBypass,
  clearDevAuthBypass,
  isDevAuthBypassAutoEnabled,
  isLocalHostname,
  markDevAuthBypass,
  shouldActivateDevAuthBypass,
} from './devAuth'

describe('devAuth', () => {
  afterEach(() => {
    sessionStorage.removeItem(DEV_AUTH_BYPASS_KEY)
    sessionStorage.removeItem(DEV_AUTH_LOGGED_OUT_KEY)
  })

  it('allows only localhost-like hosts', () => {
    expect(isLocalHostname('localhost')).toBe(true)
    expect(isLocalHostname('127.0.0.1')).toBe(true)
    expect(isLocalHostname('[::1]')).toBe(true)
    expect(isLocalHostname('192.168.1.10')).toBe(false)
    expect(isLocalHostname('example.com')).toBe(false)
  })

  it('blocks bypass outside Vite dev', () => {
    expect(canUseDevAuthBypass({ isDev: false, hostname: 'localhost' })).toBe(false)
    expect(canUseDevAuthBypass({ isDev: true, hostname: 'localhost' })).toBe(true)
    expect(canUseDevAuthBypass({ isDev: true, hostname: '192.168.1.10' })).toBe(false)
  })

  it('auto-enables only when env flag is the string true', () => {
    expect(isDevAuthBypassAutoEnabled('true')).toBe(true)
    expect(isDevAuthBypassAutoEnabled('1')).toBe(false)
    expect(isDevAuthBypassAutoEnabled(undefined)).toBe(false)
  })

  it('activates from sessionStorage on localhost dev', () => {
    markDevAuthBypass()
    expect(
      shouldActivateDevAuthBypass({ isDev: true, hostname: 'localhost' }),
    ).toBe(true)
    clearDevAuthBypass()
    expect(
      shouldActivateDevAuthBypass({ isDev: true, hostname: 'localhost' }),
    ).toBe(false)
  })

  it('does not activate stored bypass in production', () => {
    markDevAuthBypass()
    expect(
      shouldActivateDevAuthBypass({ isDev: false, hostname: 'localhost' }),
    ).toBe(false)
  })

  it('activates from env flag on localhost dev', () => {
    expect(
      shouldActivateDevAuthBypass({
        isDev: true,
        hostname: 'localhost',
        flag: 'true',
      }),
    ).toBe(true)
  })

  it('keeps logout for the current tab even when env auto-bypass is on', () => {
    clearDevAuthBypass()
    expect(
      shouldActivateDevAuthBypass({
        isDev: true,
        hostname: 'localhost',
        flag: 'true',
      }),
    ).toBe(false)
  })
})
