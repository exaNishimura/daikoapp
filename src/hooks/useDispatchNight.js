import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addDaysToWorkDateKey,
  formatWorkDateKey,
  getBusinessDayBoundaries,
  resolveDispatchNightKey,
} from '@/utils/businessDayUtils'

/**
 * 配車画面の営業夜。?date=YYYY-MM-DD。当日より前は当夜に丸める。
 */
export function useDispatchNight() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const currentNight = formatWorkDateKey(getBusinessDayBoundaries().businessDay)
  const nightDate = useMemo(
    () => resolveDispatchNightKey(dateParam),
    [dateParam, currentNight]
  )
  const isCurrentNight = nightDate === currentNight
  const isFutureNight = nightDate > currentNight

  const setNightDate = useCallback(
    (next) => {
      const resolved = resolveDispatchNightKey(next)
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (!resolved || resolved === currentNight) params.delete('date')
          else params.set('date', resolved)
          return params
        },
        { replace: true }
      )
    },
    [currentNight, setSearchParams]
  )

  const goPrev = useCallback(() => {
    if (isCurrentNight) return
    setNightDate(addDaysToWorkDateKey(nightDate, -1))
  }, [isCurrentNight, nightDate, setNightDate])

  const goNext = useCallback(() => {
    setNightDate(addDaysToWorkDateKey(nightDate, 1))
  }, [nightDate, setNightDate])

  const goToday = useCallback(() => {
    setNightDate(currentNight)
  }, [currentNight, setNightDate])

  return {
    nightDate,
    currentNight,
    isCurrentNight,
    isFutureNight,
    setNightDate,
    goPrev,
    goNext,
    goToday,
  }
}
