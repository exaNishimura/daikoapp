import { useDraggable } from '@dnd-kit/core'
import { shortenAddress } from '@/utils/addressUtils'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

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

  const statusColor =
    {
      UNASSIGNED: 'default',
      TENTATIVE: 'warning',
      CONFIRMED: 'success',
      ARRIVED: 'info',
      PICKING_UP: 'info',
      IN_TRANSIT: 'primary',
      COMPLETED: 'success',
    }[order.status] || 'default'

  const statusLabel =
    order.status === 'UNASSIGNED'
      ? '未割当'
      : order.status === 'TENTATIVE'
        ? '仮配置'
        : order.status === 'CONFIRMED'
          ? '確定'
          : order.status === 'ARRIVED'
            ? '現地到着'
            : order.status === 'PICKING_UP'
              ? '客車引取'
              : order.status === 'IN_TRANSIT'
                ? '送客中'
                : order.status === 'COMPLETED'
                  ? '送客完了'
                  : '確定'

  const routeSummary = formatRouteSummary(order)

  return (
    <Card
      ref={setNodeRef}
      data-order-id={order.id}
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
      sx={{
        backgroundColor: 'background.paper',
        border: isSelected ? '1px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderLeft: isSelected ? '4px solid' : '4px solid',
        borderLeftColor: isSelected ? 'primary.main' : 'divider',
        borderRadius: 0,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 4px 12px rgba(16, 24, 40, 0.1)',
        },
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
          }}
        >
          <Chip
            label={statusLabel}
            color={statusColor}
            size="small"
            sx={{
              height: 18,
              flexShrink: 0,
              fontSize: '0.65rem',
              '& .MuiChip-label': { px: 0.75, py: 0 },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              fontSize: '0.7rem',
              flexShrink: 0,
            }}
          >
            {orderTypeText}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
              flexShrink: 0,
            }}
          >
            {totalDuration}分
          </Typography>
          {order.parking_note && (
            <Typography
              component="span"
              variant="caption"
              sx={{ fontSize: '0.7rem', flexShrink: 0, ml: 'auto' }}
              title="メモあり"
            >
              📝
            </Typography>
          )}
        </Box>
        {order.pickup_location && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={order.pickup_location}
          >
            {order.pickup_location}
          </Typography>
        )}
        {carInfoText && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.65rem',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={carInfoText}
          >
            {carInfoText}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{
            color: 'text.primary',
            fontSize: '0.7rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={routeSummary}
        >
          {routeSummary}
        </Typography>
      </Box>
    </Card>
  )
}
