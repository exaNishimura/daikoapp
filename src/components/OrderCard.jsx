import { useDraggable } from '@dnd-kit/core'
import { shortenAddress } from '@/utils/addressUtils'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export function OrderCard({ order, isSelected, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
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

  // ドラッグ中はクリックイベントを無視
  const handleClick = (e) => {
    if (!isDragging && onClick) {
      onClick(e)
    }
  }

  // 予約種別の表示
  const orderTypeText =
    order.order_type === 'NOW'
      ? '今すぐ'
      : order.scheduled_at
      ? new Date(order.scheduled_at).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '日時指定'


  // 所要時間の表示
  const totalDuration =
    (order.base_duration_min || 30) + (order.buffer_min || 0)

  // 車情報の表示
  const carInfo = []
  if (order.car_plate) {
    carInfo.push(order.car_plate.slice(-4))
  }
  if (order.car_color) {
    carInfo.push(order.car_color)
  }

  const statusColor = {
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

  return (
    <Card
      ref={setNodeRef}
      data-order-id={order.id}
      style={{
        ...style,
        marginBottom: '8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : order.status === 'COMPLETED' ? 0.5 : 1,
        border: isSelected ? '2px solid #646cff' : 'none',
        touchAction: 'none',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      sx={{
        backgroundColor: '#2a2a2a',
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      <CardHeader
        sx={{ px: 2, py: 1.5, pb: 1 }}
        title={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip label={statusLabel} color={statusColor} size="small" />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              {orderTypeText}
            </Typography>
          </Box>
        }
      />
      <CardContent sx={{ px: 2, py: 1.5, pt: 0 }}>
        <Stack spacing={1}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
              {shortenAddress(order.pickup_address)}
            </Typography>
            {order.waypoints && order.waypoints.length > 0 && (
              <>
                {order.waypoints.map((wp, idx) => (
                  <Box key={idx}>
                    <Typography variant="body2" sx={{ my: 0.25, color: 'rgba(255, 255, 255, 0.6)' }}>
                      ↓
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#646cff' }}>
                      {shortenAddress(wp)} (経由地{idx + 1})
                    </Typography>
                  </Box>
                ))}
              </>
            )}
            <Typography variant="body2" sx={{ my: 0.25, color: 'rgba(255, 255, 255, 0.6)' }}>
              ↓
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
              {shortenAddress(order.dropoff_address)}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            所要時間: {totalDuration}分
          </Typography>
          {carInfo.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {carInfo.join(' ')}
              </Typography>
              {order.parking_note && (
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} title="メモあり">
                  📝
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
