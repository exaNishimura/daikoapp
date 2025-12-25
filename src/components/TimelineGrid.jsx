import { useDroppable } from '@dnd-kit/core'
import { SlotComponent } from './SlotComponent'
import { checkSlotConflict } from '@/services/conflictDetectionService'
import { useState, useEffect, useRef } from 'react'
import { dateToRowIndex, rowIndexToPixels } from '@/utils/rowUtils'
import './TimelineGrid.css'

export function TimelineGrid({ vehicles, orders, slots: propsSlots, dragOverPosition, draggingSlotVehicleId, onOrderSelect, onOrderUpdate, onSlotsUpdate }) {
  const [conflicts, setConflicts] = useState(new Set())
  const [currentTime, setCurrentTime] = useState(new Date())
  const headerScrollRef = useRef(null)
  const bodyScrollRef = useRef(null)
  const timelineBodyRef = useRef(null) // タイムラインボディのref
  const isScrollingRef = useRef(false)

  // スロットデータの取得（propsから取得、なければ内部で管理）
  const slots = propsSlots || []

  // 現在時刻を1分ごとに更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // 1分ごとに更新

    return () => clearInterval(interval)
  }, [])

  // 競合検出
  useEffect(() => {
    if (slots.length > 0) {
      detectConflicts(slots)
    }
  }, [slots])

  // スクロール同期
  useEffect(() => {
    const headerEl = headerScrollRef.current
    const bodyEl = bodyScrollRef.current

    if (!headerEl || !bodyEl) return

    const handleHeaderScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        bodyEl.scrollLeft = headerEl.scrollLeft
        requestAnimationFrame(() => {
          isScrollingRef.current = false
        })
      }
    }

    const handleBodyScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        headerEl.scrollLeft = bodyEl.scrollLeft
        requestAnimationFrame(() => {
          isScrollingRef.current = false
        })
      }
    }

    headerEl.addEventListener('scroll', handleHeaderScroll)
    bodyEl.addEventListener('scroll', handleBodyScroll)

    return () => {
      headerEl.removeEventListener('scroll', handleHeaderScroll)
      bodyEl.removeEventListener('scroll', handleBodyScroll)
    }
  }, [vehicles])

  const detectConflicts = (slotList) => {
    const conflictIds = new Set()
    for (let i = 0; i < slotList.length; i++) {
      for (let j = i + 1; j < slotList.length; j++) {
        if (checkSlotConflict(slotList[i], slotList[j])) {
          conflictIds.add(slotList[i].id)
          conflictIds.add(slotList[j].id)
        }
      }
    }
    setConflicts(conflictIds)
  }

  // 時間軸の生成（18:00〜翌06:00、15分刻み）
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 18; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({ hour, minute })
      }
    }
    for (let hour = 0; hour <= 6; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 6 && minute > 0) break
        slots.push({ hour, minute })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const totalHeight = timeSlots.length * 20 // 15分 = 20px

  // 現在時刻の位置を計算（営業時間内の場合のみ）
  const getCurrentTimePosition = () => {
    const now = new Date(currentTime)
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const totalMinutes = hours * 60 + minutes

    // 営業時間は18:00〜翌06:00
    // 18:00 = 1080分、06:00 = 360分
    // 営業時間外: 06:00 < 時刻 < 18:00
    if (totalMinutes > 360 && totalMinutes < 1080) {
      return null
    }

    // 営業時間内の場合、行番号を計算
    try {
      const rowIndex = dateToRowIndex(now)
      
      // 行番号からピクセル位置に変換
      const position = rowIndexToPixels(rowIndex)
      
      // タイムラインの範囲内かチェック（0〜totalHeight）
      // totalHeight = 48行 * 20px = 960px
      if (position < 0 || position > totalHeight) {
        return null
      }
      
      return position
    } catch (error) {
      // 行番号が範囲外の場合はnullを返す
      return null
    }
  }

  const currentTimePosition = getCurrentTimePosition()

  // 現在時刻の位置まで自動スクロール（初回表示時のみ）
  useEffect(() => {
    // timeline-bodyまたはtimeline-content-wrapperのどちらかがスクロールコンテナ
    const scrollContainer = timelineBodyRef.current || bodyScrollRef.current
    
    if (currentTimePosition !== null && scrollContainer) {
      // DOMが完全にレンダリングされるまで少し待つ
      const timeoutId = setTimeout(() => {
        if (!scrollContainer) return
        
        // 現在時刻の位置を中央付近に表示するようにスクロール
        const containerHeight = scrollContainer.clientHeight
        const scrollPosition = currentTimePosition - containerHeight / 2
        
        // スクロール位置を設定（負の値にならないように）
        scrollContainer.scrollTop = Math.max(0, scrollPosition)
      }, 200) // 200ms待ってからスクロール
      
      return () => clearTimeout(timeoutId)
    }
  }, [currentTimePosition, vehicles.length]) // vehicles.lengthが変わったときも再スクロール

  // 車両ごとのスロットを取得
  const getSlotsForVehicle = (vehicleId) => {
    return slots.filter((slot) => slot.vehicle_id === vehicleId)
  }

  return (
    <div className="timeline-grid">
      <div className="timeline-header-wrapper" ref={headerScrollRef}>
        <div className="timeline-header">
          <div className="time-axis-label" style={{ padding: '12px 16px' }}>時間</div>
          <div className="vehicles-header">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="vehicle-header-label" style={{ padding: '12px 16px' }}>
                {vehicle.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="timeline-body" ref={timelineBodyRef}>
        {vehicles.length === 0 ? (
          <div className="empty-timeline">
            <p>車両が登録されていません</p>
          </div>
        ) : (
          <div className="timeline-content-wrapper" ref={bodyScrollRef}>
            {/* 時間軸ラベル */}
            <div className="time-axis-column">
              {timeSlots.map((ts, index) => {
                // 15分刻みで表示（0, 15, 30, 45分）
                const showMarker = ts.minute === 0 || ts.minute === 15 || ts.minute === 30 || ts.minute === 45
                const isHourMark = ts.minute === 0
                return (
                  <div key={index} className="time-marker-row" style={{ height: '20px' }}>
                    {showMarker && (
                      <span className={isHourMark ? 'time-hour' : 'time-minute'}>
                        {isHourMark ? (
                          <>
                            {ts.hour.toString().padStart(2, '0')}:
                            {ts.minute.toString().padStart(2, '0')}
                          </>
                        ) : (
                          ts.minute.toString()
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 車両列 */}
            <div className="vehicles-columns">
              {vehicles.map((vehicle) => (
                <VehicleColumn
                  key={vehicle.id}
                  vehicle={vehicle}
                  slots={getSlotsForVehicle(vehicle.id)}
                  conflicts={conflicts}
                  orders={orders}
                  timeSlots={timeSlots}
                  totalHeight={totalHeight}
                  dragOverPosition={dragOverPosition?.vehicleId === vehicle.id ? dragOverPosition : null}
                  draggingSlotVehicleId={draggingSlotVehicleId}
                  onSlotSelect={onOrderSelect}
                />
              ))}
            </div>

            {/* 現在時刻ライン */}
            {currentTimePosition !== null && (
              <div
                className="current-time-line"
                style={{
                  position: 'absolute',
                  top: `${currentTimePosition}px`,
                  left: '60px',
                  right: 0,
                  height: '2px',
                  backgroundColor: '#ff4444',
                  zIndex: 0, /* 依頼カードの下に表示 */
                  pointerEvents: 'none',
                  boxShadow: '0 0 4px rgba(255, 68, 68, 0.8)',
                }}
              >
                {/* 左側の三角マーカー */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    top: '-4px',
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid #ff4444',
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VehicleColumn({ vehicle, slots, conflicts, orders, timeSlots, totalHeight, dragOverPosition, onSlotSelect, draggingSlotVehicleId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `vehicle-${vehicle.id}`,
    data: {
      type: 'vehicle',
      vehicleId: vehicle.id,
    },
  })

  // 同じ車両列内での移動の場合はハイライトしない
  const shouldHighlight = isOver && draggingSlotVehicleId !== vehicle.id

  return (
    <div
      ref={setNodeRef}
      data-vehicle-id={vehicle.id}
      className={`vehicle-column ${shouldHighlight ? 'drag-over' : ''}`}
      style={{ height: `${totalHeight}px` }}
    >
      {/* 時間行の区切り線 */}
      {timeSlots.map((ts, index) => (
        <div key={index} className="time-cell-divider" style={{ top: `${index * 20}px` }} />
      ))}

      {/* ドロップ予定位置のハイライト（行全体） */}
      {dragOverPosition && dragOverPosition.top >= 0 && (
        <div
          className="drop-preview-row"
          style={{
            top: `${dragOverPosition.top}px`,
            height: '20px', // 15分 = 20px
          }}
        />
      )}

      {/* スロット */}
      {slots.map((slot) => {
        const order = orders.find((o) => o.id === slot.order_id)
        if (!order) return null

        return (
          <SlotComponent
            key={slot.id}
            slot={slot}
            order={order}
            isConflict={conflicts.has(slot.id)}
            onClick={() => onSlotSelect(order)}
          />
        )
      })}
    </div>
  )
}
