import { useDraggable } from '@dnd-kit/core'
import { shortenAddress } from '@/utils/addressUtils'
import { getStatusLabel } from '@/utils/orderStatusUtils'
import { Card } from '@astryxdesign/core/Card'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

const STATUS_TOKEN_COLOR = {
  UNASSIGNED: 'gray',
  TENTATIVE: 'yellow',
  CONFIRMED: 'green',
  ARRIVED: 'cyan',
  PICKING_UP: 'cyan',
  IN_TRANSIT: 'purple',
  COMPLETED: 'green',
}

function formatRouteSummary(order) {
  const pickup = shortenAddress(order.pickup_address, 14)
  const dropoff = shortenAddress(order.dropoff_address, 14)
  const waypoints = order.waypoints || []

  if (waypoints.length === 0) {
    return `${pickup} → ${dropoff}`
  }
  if (waypoints.length === 1) {
    return `${pickup} → ${shortenAddress(waypoints[0], 10)} → ${dropoff}`
  }
  return `${pickup} → 経由${waypoints.length} → ${dropoff}`
}

export function OrderCard({ order, isSelected, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: {
      type: 'order',
      order,
    },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  const handleClick = (e) => {
    if (!isDragging && onClick) {
      onClick(e)
    }
  }

  const orderTypeText =
    order.order_type === 'NOW'
      ? '今すぐ'
      : order.scheduled_at
        ? new Date(order.scheduled_at).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '日時指定'

  const totalDuration = (order.base_duration_min || 30) + (order.buffer_min || 0)

  const carInfoParts = []
  if (order.car_model) carInfoParts.push(order.car_model)
  if (order.car_color) carInfoParts.push(order.car_color)
  if (order.car_plate) carInfoParts.push(order.car_plate.slice(-4))
  const carInfoText = carInfoParts.join(' ')

  const statusLabel = getStatusLabel(order.status)
  const statusColor = STATUS_TOKEN_COLOR[order.status] || 'gray'
  const routeSummary = formatRouteSummary(order)

  const className = ['order-card', isSelected ? 'selected' : '', isDragging ? 'dragging' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <Card
      ref={setNodeRef}
      data-order-id={order.id}
      data-status={order.status}
      className={className}
      padding={2}
      elevation="none"
      variant={isSelected ? 'blue' : 'default'}
      style={{
        ...style,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : order.status === 'COMPLETED' ? 0.5 : 1,
        touchAction: 'none',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      <VStack gap={1}>
        <HStack gap={1} vAlign="center" hAlign="between">
          <HStack gap={1} vAlign="center" wrap="wrap">
            <Token size="lg" color={statusColor} label={statusLabel} />
            <Text size="base" weight="semibold" hasTabularNumbers>
              {orderTypeText}
            </Text>
            <Text size="base" color="secondary" hasTabularNumbers>
              {totalDuration}分
            </Text>
          </HStack>
          {order.parking_note ? (
            <Text size="base" aria-label="駐車場メモあり">
              📝
            </Text>
          ) : null}
        </HStack>
        {order.pickup_location ? (
          <Text size="base" weight="semibold" maxLines={1}>
            {order.pickup_location}
          </Text>
        ) : null}
        {carInfoText ? (
          <Text size="sm" color="secondary" maxLines={1}>
            {carInfoText}
          </Text>
        ) : null}
        <Text size="sm" color="secondary" maxLines={1}>
          {routeSummary}
        </Text>
      </VStack>
    </Card>
  )
}
