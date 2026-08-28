import { useState, useRef, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import {
  dateToRowIndex,
  rowIndexToPixels,
  minutesToRows,
  TIMELINE_ROW_HEIGHT_PX,
} from '@/utils/rowUtils'
import { getAddressFromCity } from '@/utils/addressUtils'
import './SlotComponent.css'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'

export function SlotComponent({ slot, order, isConflict, isSelected, conflictTooltip, onClick }) {
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const longPressTimer = useRef(null)
  const longPressStartTime = useRef(null)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
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

  // 最小高さを確保（1行 = TIMELINE_ROW_HEIGHT_PX）
  const minHeight = TIMELINE_ROW_HEIGHT_PX
  const finalHeight = Math.max(height, minHeight)

  // 時刻表示
  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ルートテキスト（出発 > 経由 > 目的地）。マーキーで全文表示する
  const routeText = useMemo(() => {
    const parts = [order.pickup_address]
    if (Array.isArray(order.waypoints) && order.waypoints.length > 0) {
      parts.push(...order.waypoints)
    }
    parts.push(order.dropoff_address)
    return parts
      .map((p) => getAddressFromCity(p))
      .filter(Boolean)
      .join(' > ')
  }, [order.pickup_address, order.waypoints, order.dropoff_address])

  // 文字数に比例した duration を設定（およそ 5 文字/秒 で流す）
  // 短すぎても 6 秒、長すぎても 30 秒に丸める
  const marqueeDuration = useMemo(() => {
    const charsPerSec = 5
    const seconds = Math.max(6, Math.min(30, routeText.length / charsPerSec))
    return `${seconds}s`
  }, [routeText])

  // ドラッグ中はクリックイベントを無視
  const handleClick = (e) => {
    if (!isDragging && onClick) {
      onClick(e)
    }
  }

  // 長押し開始
  const handleLongPressStart = () => {
    // ドラッグ可能な場合は長押しを無効化（ドラッグと競合するため）
    if (isDraggable) return

    longPressStartTime.current = Date.now()
    longPressTimer.current = setTimeout(() => {
      setShowInfoDialog(true)
    }, 500) // 500msで長押しと判定
  }

  // 長押し終了
  const handleLongPressEnd = () => {
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
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        touchAction: isDraggable ? 'none' : 'auto',
        userSelect: isDraggable ? 'none' : 'auto',
      }}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      className={`slot-component ${(order?.status || slot.status).toLowerCase()} ${
        isConflict ? 'conflict' : ''
      } ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick(e)
        }
      }}
      aria-label={
        order.pickup_location
          ? `${order.pickup_location}、${order.pickup_address}から${order.dropoff_address}、${formatTime(startDate)}から${formatTime(endDate)}`
          : `${order.pickup_address}から${order.dropoff_address}、${formatTime(startDate)}から${formatTime(endDate)}`
      }
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
        {order.pickup_location && (
          <div className="slot-pickup-location" title={order.pickup_location}>
            {order.pickup_location}
          </div>
        )}
        <div
          className="slot-route"
          aria-label={`ルート: ${routeText}`}
          style={{ '--marquee-duration': marqueeDuration }}
        >
          <div className="slot-route-track">
            <span className="slot-route-content">{routeText}</span>
            <span className="slot-route-content" aria-hidden="true">
              {routeText}
            </span>
          </div>
        </div>
      </div>
      {isConflict && (
        <div
          className="conflict-warning"
          aria-label="時間が重複しています"
          title={conflictTooltip || '時間が重複しています'}
        >
          ⚠
        </div>
      )}

      <Dialog
        isOpen={showInfoDialog}
        onOpenChange={(next) => {
          if (!next) handleCloseInfoDialog()
        }}
        purpose="info"
      >
        <Layout
          height="auto"
          padding={4}
          header={
            <DialogHeader
              title="依頼詳細情報"
              onOpenChange={(next) => {
                if (!next) handleCloseInfoDialog()
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={3}>
                {order.pickup_location ? (
                  <VStack gap={1}>
                    <Text color="secondary">お迎え場所</Text>
                    <Text>{order.pickup_location}</Text>
                  </VStack>
                ) : null}
                {order.contact_phone ? (
                  <VStack gap={1}>
                    <Text color="secondary">電話番号</Text>
                    <Link href={`tel:${order.contact_phone}`}>📞 {order.contact_phone}</Link>
                  </VStack>
                ) : null}
                {order.parking_note ? (
                  <VStack gap={1}>
                    <Text color="secondary">駐車メモ</Text>
                    <Text>📝 {order.parking_note}</Text>
                  </VStack>
                ) : null}
                {order.buffer_manual ? (
                  <VStack gap={1}>
                    <Text color="secondary">手動調整</Text>
                    <Text>✋ 所要時間が手動で調整されています</Text>
                  </VStack>
                ) : null}
                {!order.pickup_location &&
                !order.contact_phone &&
                !order.parking_note &&
                !order.buffer_manual ? (
                  <Text color="secondary">追加情報はありません</Text>
                ) : null}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack hAlign="end">
                <Button label="閉じる" variant="secondary" onClick={handleCloseInfoDialog} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </div>
  )
}
