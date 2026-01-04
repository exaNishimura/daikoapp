import { useState, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { dateToRowIndex, rowIndexToPixels, minutesToRows, rowsToMinutes } from '@/utils/rowUtils'
import './SlotComponent.css'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'

export function SlotComponent({ slot, order, isConflict, onClick }) {
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const longPressTimer = useRef(null)
  const longPressStartTime = useRef(null)
  
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `slot-${slot.id}`,
      data: {
        type: 'slot',
        slot,
        order,
      },
      disabled: slot.status === 'CONFIRMED', // 確定済みはドラッグ不可
    })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  // 位置計算（行番号ベース）
  const startDate = new Date(slot.start_at)
  const endDate = new Date(slot.end_at)
  
  // 依頼の所要時間（base_duration_min + buffer_min）を取得
  const orderDuration = (order.base_duration_min || 30) + (order.buffer_min || 0)
  
  // 開始行番号を計算
  const startRowIndex = dateToRowIndex(startDate)
  
  // 終了行番号を計算
  const endRowIndex = dateToRowIndex(endDate)
  
  // 実際の行数
  const actualRows = Math.max(1, endRowIndex - startRowIndex)
  
  // 依頼の所要時間から必要な行数を計算
  const requiredRows = minutesToRows(orderDuration)
  
  // 実際の行数と必要な行数のどちらか大きい方を使用
  const rowsToUse = Math.max(actualRows, requiredRows)
  
  // 開始位置を計算（行番号からピクセルに変換）
  const top = rowIndexToPixels(startRowIndex)
  
  // 高さを計算（行数からピクセルに変換）
  const height = rowIndexToPixels(rowsToUse)
  
  // 最小高さを確保（1行 = 20px）
  const minHeight = 20
  const finalHeight = Math.max(height, minHeight)

  // 時刻表示
  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

  // 住所の超短縮表示（市以降、最大10文字）
  const shortenAddress = (address) => {
    const addressFromCity = getAddressFromCity(address)
    if (addressFromCity.length <= 10) return addressFromCity
    return addressFromCity.substring(0, 10) + '...'
  }

  // ドラッグ中はクリックイベントを無視
  const handleClick = (e) => {
    if (!isDragging && onClick) {
      onClick(e)
    }
  }

  // 長押し開始
  const handleLongPressStart = (e) => {
    // ドラッグ可能な場合は長押しを無効化（ドラッグと競合するため）
    if (isDraggable) return
    
    longPressStartTime.current = Date.now()
    longPressTimer.current = setTimeout(() => {
      setShowInfoDialog(true)
    }, 500) // 500msで長押しと判定
  }

  // 長押し終了
  const handleLongPressEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressStartTime.current = null
  }

  // 情報ダイアログを閉じる
  const handleCloseInfoDialog = () => {
    setShowInfoDialog(false)
  }

  // TENTATIVEの場合はドラッグ可能
  const isDraggable = slot.status === 'TENTATIVE'

  if (!order) return null

  return (
    <div
      ref={setNodeRef}
      data-slot-id={slot.id}
      style={{
        ...style,
        top: `${top}px`,
        height: `${finalHeight}px`,
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: isDraggable ? 'none' : 'auto',
        userSelect: isDraggable ? 'none' : 'auto',
      }}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      className={`slot-component ${(order?.status || slot.status).toLowerCase()} ${
        isConflict ? 'conflict' : ''
      } ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
    >
      <div className="slot-header">
        <span className={`status-badge ${(order?.status || slot.status).toLowerCase()}`}>
          {(() => {
            const status = order?.status || slot.status
            switch (status) {
              case 'TENTATIVE':
                return '仮'
              case 'CONFIRMED':
                return '確定'
              case 'ARRIVED':
                return '現地到着'
              case 'PICKING_UP':
                return '客車引取'
              case 'IN_TRANSIT':
                return '送客中'
              case 'COMPLETED':
                return '送客完了'
              default:
                return '確定'
            }
          })()}
        </span>
        <span className="slot-time">
          {formatTime(startDate)}-{formatTime(endDate)}
        </span>
      </div>
      <div className="slot-body">
        <div className="slot-route">
          {shortenAddress(order.pickup_address)}
          {order.waypoints && order.waypoints.length > 0 && (
            <>
              {' → '}
              {order.waypoints.map((wp, idx) => (
                <span key={idx}>
                  {shortenAddress(wp)}
                  {idx < order.waypoints.length - 1 ? ' → ' : ''}
                </span>
              ))}
              {' → '}
            </>
          )}
          {shortenAddress(order.dropoff_address)}
        </div>
        {/* アイコンは非表示（長押しで情報を表示） */}
      </div>
      {isConflict && <div className="conflict-warning">⚠</div>}
      
      {/* 情報ダイアログ */}
      <Dialog open={showInfoDialog} onClose={handleCloseInfoDialog} maxWidth="sm" fullWidth>
        <DialogTitle>依頼詳細情報</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {order.contact_phone && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  電話番号
                </Typography>
                <Typography
                  variant="body2"
                  component="a"
                  href={`tel:${order.contact_phone}`}
                  sx={{
                    color: 'primary.main',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  📞 {order.contact_phone}
                </Typography>
              </Box>
            )}
            {order.parking_note && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  駐車メモ
                </Typography>
                <Typography variant="body2">📝 {order.parking_note}</Typography>
              </Box>
            )}
            {order.buffer_manual && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  手動調整
                </Typography>
                <Typography variant="body2">✋ 所要時間が手動で調整されています</Typography>
              </Box>
            )}
            {!order.contact_phone && !order.parking_note && !order.buffer_manual && (
              <Typography variant="body2" color="text.secondary">
                追加情報はありません
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInfoDialog}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
