import { useDraggable } from '@dnd-kit/core'
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

  // 都道府県と郵便番号を削除して市以降を取得
  const getAddressFromCity = (address) => {
    if (!address) return ''
    
    let result = address
    
    // 「日本、」を削除
    if (result.startsWith('日本、')) {
      result = result.substring(3) // 「日本、」は3文字
    } else if (result.startsWith('日本')) {
      result = result.substring(2) // 「日本」は2文字
    }
    
    // 郵便番号を削除（〒123-4567 または 123-4567 の形式）
    result = result.replace(/^〒?\d{3}-?\d{4}\s*/, '') // 郵便番号パターンを削除
    
    // 都道府県のリスト
    const prefectures = [
      '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
      '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
      '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
      '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
      '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
      '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
      '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
    ]
    
    // 都道府県を削除
    for (const prefecture of prefectures) {
      if (result.startsWith(prefecture)) {
        result = result.substring(prefecture.length)
        break
      }
    }
    
    // 先頭の区切り文字（、やスペース）を削除
    result = result.replace(/^[、\s]+/, '')
    
    return result.trim()
  }

  // 住所の短縮表示（市以降、最大20文字）
  const shortenAddress = (address) => {
    const addressFromCity = getAddressFromCity(address)
    if (addressFromCity.length <= 20) return addressFromCity
    return addressFromCity.substring(0, 20) + '...'
  }

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
