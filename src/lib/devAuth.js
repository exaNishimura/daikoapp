const STORAGE_VERSION = 'v1'
export const DEV_AUTH_BYPASS_KEY = `devAuthBypass:${STORAGE_VERSION}`
export const DEV_AUTH_LOGGED_OUT_KEY = `devAuthLoggedOut:${STORAGE_VERSION}`

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export const DEV_BYPASS_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@localhost',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'dev-bypass' },
  user_metadata: { name: 'Local Dev' },
}

export function isLocalHostname(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
) {
  return LOCAL_HOSTS.has(hostname)
}

/**
 * Vite の開発サーバーかつ localhost のみ。本番ビルドでは import.meta.env.DEV が false。
 */
export function canUseDevAuthBypass({
  isDev = import.meta.env.DEV === true,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
} = {}) {
  return isDev && isLocalHostname(hostname)
}

export function isDevAuthBypassAutoEnabled(
  flag = import.meta.env.VITE_DEV_AUTH_BYPASS,
) {
  return flag === 'true'
}

export function createDevBypassSession() {
  return {
    access_token: 'dev-bypass',
    refresh_token: 'dev-bypass',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: DEV_BYPASS_USER,
  }
}

export function isDevAuthBypassStored() {
  try {
    return sessionStorage.getItem(DEV_AUTH_BYPASS_KEY) === '1'
  } catch {
    return false
  }
}

export function isDevAuthLoggedOut() {
  try {
    return sessionStorage.getItem(DEV_AUTH_LOGGED_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function markDevAuthBypass() {
  try {
    sessionStorage.setItem(DEV_AUTH_BYPASS_KEY, '1')
    sessionStorage.removeItem(DEV_AUTH_LOGGED_OUT_KEY)
  } catch {
    // private mode / quota
  }
}

export function clearDevAuthBypass() {
  try {
    sessionStorage.removeItem(DEV_AUTH_BYPASS_KEY)
    sessionStorage.setItem(DEV_AUTH_LOGGED_OUT_KEY, '1')
  } catch {
    // private mode / quota
  }
}

export function shouldActivateDevAuthBypass(options) {
  if (!canUseDevAuthBypass(options)) return false
  if (isDevAuthLoggedOut()) return false
  return isDevAuthBypassAutoEnabled(options?.flag) || isDevAuthBypassStored()
}
