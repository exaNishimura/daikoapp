const STORAGE_KEY = 'employeeShiftSession:v1'

/**
 * @returns {{ token: string, employee: { id: string, name: string } } | null}
 */
export function getEmployeeShiftSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.employee?.id) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * @param {{ token: string, employee: { id: string, name: string } }} session
 */
export function setEmployeeShiftSession(session) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // private mode / quota
  }
}

export function clearEmployeeShiftSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
