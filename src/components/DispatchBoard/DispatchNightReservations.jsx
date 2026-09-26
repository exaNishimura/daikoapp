import { useDraggable } from '@dnd-kit/core'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { shortenAddress } from '@/utils/addressUtils'
import { parseReservationMemo } from '@/lib/reservation/reservationMemo'
import '@/components/OrderCard.css'

function formatReservationRoute(parsed) {
  if (parsed.pickup || parsed.dropoff) {
    const pickup = shortenAddress(parsed.pickup, 14)
    const dropoff = shortenAddress(parsed.dropoff, 14)
    if (parsed.via) {
      const hops = parsed.via.split(' → ').filter(Boolean)
      if (hops.length === 1) {
        return `${pickup} → ${shortenAddress(hops[0], 10)} → ${dropoff}`
      }
      return `${pickup} → 経由${hops.length} → ${dropoff}`
    }
    return `${pickup} → ${dropoff}`
  }
  return parsed.rest.join(' ')
}

function formatReservedTime(reservedAt) {
  if (!reservedAt) return '日時指定'
  const date = new Date(reservedAt)
  if (Number.isNaN(date.getTime())) return '日時指定'
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReservationOrderCard({ reservation }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `reservation-${reservation.id}`,
    data: {
      type: 'reservation',
      reservation,
    },
  })
  const parsed = parseReservationMemo(reservation.memo)
  const routeSummary = formatReservationRoute(parsed)
  const phone = String(reservation.phone ?? '').trim()
  const showPhone = phone && phone !== '未入力'
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <Card
      ref={setNodeRef}
      data-status="RESERVED"
      className={['order-card', isDragging ? 'dragging' : ''].filter(Boolean).join(' ')}
      padding={2}
      elevation="none"
      variant="default"
      style={{
        ...style,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <VStack gap={1}>
        <HStack gap={1} vAlign="center" hAlign="between">
          <HStack gap={1} vAlign="center" wrap="wrap">
            <Token size="lg" color="blue" label="予約" />
            <Text size="base" weight="semibold" hasTabularNumbers>
              {formatReservedTime(reservation.reserved_at)}
            </Text>
          </HStack>
          {parsed.parking ? (
            <Text size="base" aria-label="駐車場メモあり">
              📝
            </Text>
          ) : null}
        </HStack>
        {reservation.customer_name ? (
          <Text size="base" weight="semibold" maxLines={1}>
            {reservation.customer_name}
          </Text>
        ) : null}
        {showPhone ? (
          <Text size="sm" color="secondary" maxLines={1}>
            {phone}
          </Text>
        ) : null}
        {parsed.car ? (
          <Text size="sm" color="secondary" maxLines={1}>
            {parsed.car}
          </Text>
        ) : null}
        {routeSummary ? (
          <Text size="sm" color="secondary" maxLines={1}>
            {routeSummary}
          </Text>
        ) : null}
      </VStack>
    </Card>
  )
}

/**
 * 未配置の予約。タイムラインへドラッグして仮配置できる。
 */
export function DispatchNightReservations({ reservations, nightDate }) {
  if (!reservations?.length) return null

  return (
    <VStack className="order-card-list" minHeight={0} style={{ overflow: 'hidden', flexShrink: 0 }}>
      <HStack
        className="order-list-title"
        padding={1}
        paddingBlock={0.5}
        gap={1}
        vAlign="center"
        hAlign="between"
        style={{ flexShrink: 0 }}
      >
        <HStack gap={1} vAlign="center">
          <Text size="xsm" weight="semibold">
            この夜の予約
          </Text>
          <Token size="sm" color="blue" label={String(reservations.length)} />
        </HStack>
        <Button size="sm" variant="ghost" label="台帳" href={`/reservations?date=${nightDate}`} />
      </HStack>
      <VStack className="order-cards" gap={0.5} padding={1}>
        {reservations.map((row) => (
          <ReservationOrderCard key={row.id} reservation={row} />
        ))}
      </VStack>
    </VStack>
  )
}
