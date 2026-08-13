import { afterEach, describe, expect, it } from 'vitest'
import {
  DISPATCH_PIN_UNLOCKED_KEY,
  isDispatchPinUnlocked,
  markDispatchPinUnlocked,
} from './dispatchPinSession'

describe('dispatchPinSession', () => {
  afterEach(() => {
    sessionStorage.removeItem(DISPATCH_PIN_UNLOCKED_KEY)
  })

  it('is locked by default', () => {
    expect(isDispatchPinUnlocked()).toBe(false)
  })

  it('unlocks once per tab session', () => {
    markDispatchPinUnlocked()
    expect(isDispatchPinUnlocked()).toBe(true)
    expect(sessionStorage.getItem(DISPATCH_PIN_UNLOCKED_KEY)).toBe('1')
  })
})
