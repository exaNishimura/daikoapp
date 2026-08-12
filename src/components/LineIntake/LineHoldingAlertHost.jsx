import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLineQueue } from '@/hooks/useLineIntake'
import {
  findUnseenHoldingUnits,
  loadSeenHoldingIds,
  saveSeenHoldingIds,
} from '@/lib/lineIntake/holdingAlertStorage'
import { LineHoldingAlertDialog } from './LineHoldingAlertDialog'

const POLL_MS = 15000

export function LineHoldingAlertHost() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const isLiff = location.pathname.startsWith('/liff')
  const onQueuePage = location.pathname.startsWith('/line-queue')
  const enabled = Boolean(isAuthenticated) && !isLiff

  const query = useLineQueue({
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  })

  const holding = useMemo(
    () => (query.data || []).filter((unit) => unit.status === 'HOLDING'),
    [query.data]
  )

  const [open, setOpen] = useState(false)
  const seenRef = useRef(null)
  if (seenRef.current == null) {
    seenRef.current = loadSeenHoldingIds()
  }

  useEffect(() => {
    if (!enabled || query.isLoading || query.isError) return

    if (onQueuePage) {
      for (const unit of holding) {
        if (unit.id) seenRef.current.add(unit.id)
      }
      saveSeenHoldingIds(seenRef.current)
      setOpen(false)
      return
    }

    const unseen = findUnseenHoldingUnits(holding, seenRef.current)
    if (unseen.length > 0) setOpen(true)
  }, [enabled, onQueuePage, query.isLoading, query.isError, holding])

  const handleClose = () => {
    for (const unit of holding) {
      if (unit.id) seenRef.current.add(unit.id)
    }
    saveSeenHoldingIds(seenRef.current)
    setOpen(false)
  }

  if (!enabled || onQueuePage) return null

  return (
    <LineHoldingAlertDialog open={open && holding.length > 0} units={holding} onClose={handleClose} />
  )
}
