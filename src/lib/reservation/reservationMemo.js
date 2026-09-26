/**
 * 依頼フォーム由来の予約メモ（出発/目的/経由/車/駐車）を分解する。
 */
export function parseReservationMemo(memo) {
  const picked = { pickup: '', dropoff: '', via: '', car: '', parking: '', rest: [] }
  const lines = String(memo ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line.startsWith('出発:')) picked.pickup = line.slice(3).trim()
    else if (line.startsWith('目的:')) picked.dropoff = line.slice(3).trim()
    else if (line.startsWith('経由:')) picked.via = line.slice(3).trim()
    else if (line.startsWith('車:')) picked.car = line.slice(2).trim()
    else if (line.startsWith('駐車:')) picked.parking = line.slice(3).trim()
    else picked.rest.push(line)
  }
  return picked
}

export function waypointListFromMemo(parsed) {
  if (!parsed?.via) return null
  const hops = parsed.via.split(' → ').map((part) => part.trim()).filter(Boolean)
  return hops.length ? hops : null
}
