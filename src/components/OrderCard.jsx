import { useDraggable } from '@dnd-kit/core'
import { shortenAddress } from '@/utils/addressUtils'
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
  IN_TRANSIT: 'blue',
  COMPLETED: 'green',
}

const STATUS_LABEL = {
  UNASSIGNED: '未割当',
  TENTATIVE: '仮配置',
  CONFIRMED: '確定',
  ARRIVED: '現地到着',
  PICKING_UP: '客車引取',
  IN_TRANSIT: '送客中',
  COMPLETED: '送客完了',
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

  const statusLabel = STATUS_LABEL[order.status] || '確定'
  const statusColor = STATUS_TOKEN_COLOR[order.status] || 'gray'
  const routeSummary = formatRouteSummary(order)

  const className = ['order-card', isSelected ? 'selected' : '', isDragging ? 'dragging' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <Card
      ref={setNodeRef}
      data-order-id={order.id}
      className={className}
      padding={1}
      elevation="low"
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
      <VStack className="order-card-body" gap={0.5}>
        <HStack className="order-card-header" gap={1} vAlign="center" hAlign="between">
          <HStack gap={1} vAlign="center">
            <Token className="status-badge" size="sm" color={statusColor} label={statusLabel} />
            <Text className="order-type" size="2xs" weight="semibold">
              {orderTypeText}
            </Text>
            <Text className="duration-info" size="2xs" color="secondary">
              {totalDuration}分
            </Text>
          </HStack>
          {order.parking_note ? (
            <Text className="note-icon" size="2xs">
              📝
            </Text>
          ) : null}
        </HStack>
        {order.pickup_location ? (
          <Text className="pickup" size="2xs" color="secondary" maxLines={1}>
            {order.pickup_location}
          </Text>
        ) : null}
        {carInfoText ? (
          <Text className="car-info" size="2xs" color="secondary" maxLines={1}>
            {carInfoText}
          </Text>
        ) : null}
        <Text className="route-info" size="2xs" maxLines={1}>
          {routeSummary}
        </Text>
      </VStack>
    </Card>
  )
}
