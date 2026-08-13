const STORAGE_VERSION = 'v1'
export const DISPATCH_PIN_UNLOCKED_KEY = `dispatchPinUnlocked:${STORAGE_VERSION}`

export function isDispatchPinUnlocked() {
  try {
    return sessionStorage.getItem(DISPATCH_PIN_UNLOCKED_KEY) === '1'
  } catch {
    return false
  }
}

export function markDispatchPinUnlocked() {
  try {
    sessionStorage.setItem(DISPATCH_PIN_UNLOCKED_KEY, '1')
  } catch {
    // private mode / quota
  }
}
