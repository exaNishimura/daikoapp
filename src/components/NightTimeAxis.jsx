import { useOperatingHours } from '@/contexts/OperatingHoursProvider'
import {
  minutesToPixels,
  timeToMinutes,
  timelineEndHour,
  timelineStartHour,
} from '@/lib/shiftEditUtils'

/**
 * 深夜帯の時間軸。1時間の主目盛り、30分の副目盛り、23:00〜02:00 のピーク帯。
 * 見た目は各画面の .time-axis CSS に任せる。
 */
export function NightTimeAxis() {
  useOperatingHours()
  const markers = []
  const startHour = timelineStartHour()
  const endHour = timelineEndHour()
  const peakStart = minutesToPixels(timeToMinutes('23:00'))
  const peakEnd = minutesToPixels(timeToMinutes('02:00'))

  for (let hour = startHour; hour <= 23; hour += 1) {
    markers.push({
      type: 'major',
      left: minutesToPixels((hour - startHour) * 60),
      label: `${String(hour).padStart(2, '0')}:00`,
    })
  }
  for (let hour = 0; hour <= endHour; hour += 1) {
    markers.push({
      type: 'major',
      left: minutesToPixels((24 - startHour + hour) * 60),
      label: `${String(hour).padStart(2, '0')}:00`,
    })
  }
  for (let hour = startHour; hour <= 23; hour += 1) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((hour - startHour) * 60 + 30),
      label: '',
    })
  }
  for (let hour = 0; hour <= endHour; hour += 1) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((24 - startHour + hour) * 60 + 30),
      label: '',
    })
  }

  return (
    <div className="time-axis">
      <div
        className="peak-zone"
        style={{
          left: `${peakStart}px`,
          width: `${peakEnd - peakStart}px`,
        }}
      />
      {markers.map((marker, idx) => (
        <div
          key={`${marker.type}-${idx}`}
          className={`time-marker ${marker.type}`}
          style={{ left: `${marker.left}px` }}
        >
          {marker.label}
        </div>
      ))}
    </div>
  )
}
