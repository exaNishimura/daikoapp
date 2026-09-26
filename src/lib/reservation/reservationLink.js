const RESERVATION_MARK_RE = /\[RESERVATION:([0-9a-f-]{36})\]/i

export function reservationIdFromOrder(order) {
  const match = String(order?.parking_note || '').match(RESERVATION_MARK_RE)
  return match?.[1] || null
}

export function visibleParkingNote(parkingNote) {
  return String(parkingNote || '')
    .replace(RESERVATION_MARK_RE, '')
    .replace(/^\n+/, '')
    .trim()
}

export function withReservationMark(parkingNote, reservationId) {
  const mark = `[RESERVATION:${reservationId}]`
  const rest = visibleParkingNote(parkingNote)
  return rest ? `${mark}\n${rest}` : mark
}

export function isReservationLinked(reservation, orders = []) {
  if (reservation?.order_id) return true
  if (!reservation?.id) return false
  return orders.some((order) => reservationIdFromOrder(order) === reservation.id)
}
