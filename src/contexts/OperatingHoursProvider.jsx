import { createContext, useContext, useMemo } from 'react'
import { useCompanyProfile } from '@/hooks/billing/useCompanyProfile'
import {
  getOperatingHours,
  resolveOperatingHours,
  setOperatingHours,
} from '@/lib/operatingHours'

const OperatingHoursContext = createContext(getOperatingHours())

export function OperatingHoursProvider({ children }) {
  const profileQuery = useCompanyProfile()
  const hours = useMemo(() => resolveOperatingHours(profileQuery.data), [profileQuery.data])
  setOperatingHours(hours)

  return <OperatingHoursContext.Provider value={hours}>{children}</OperatingHoursContext.Provider>
}

export function useOperatingHours() {
  return useContext(OperatingHoursContext)
}
