import {
  resolveOperatingHours,
  timelineStartHour as timelineStartHourOf,
} from '../../shared/operatingHours.js'

export {
  BUSINESS_END_HOUR,
  DEFAULT_BUSINESS_START_HOUR,
  DEFAULT_RESERVATION_START_HOUR,
  MAX_START_HOUR,
  MIN_START_HOUR,
  buildOvernightHours,
  clampStartHour,
  formatHourClock,
  isHourInWindow,
  resolveOperatingHours,
  timelineRowCount,
} from '../../shared/operatingHours.js'

let current = resolveOperatingHours(null)

export function getOperatingHours() {
  return current
}

export function setOperatingHours(source) {
  current = resolveOperatingHours(source)
  return current
}

export function resetOperatingHours() {
  current = resolveOperatingHours(null)
  return current
}

export function getTimelineStartHour() {
  return timelineStartHourOf(current)
}
