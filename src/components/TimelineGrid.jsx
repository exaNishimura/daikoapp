import { useDroppable } from '@dnd-kit/core'
import { SlotComponent } from './SlotComponent'
import { useState, useEffect, useRef } from 'react'
import { rowIndexToDate } from '@/utils/rowUtils'
import { isVehicleOperational } from '@/utils/operationStatusUtils'
import { detectAllConflicts, getSlotConflictTooltip } from '@/lib/slotConflictUtils'
import IconButton from '@mui/material/IconButton'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import Tooltip from '@mui/material/Tooltip'
import './TimelineGrid.css'

export function TimelineGrid({
  vehicles,
  orders,
  slots: propsSlots,
  dragOverPosition,
  draggingSlotVehicleId,
  selectedOrderId,
  onOrderSelect,
  onOrderUpdate,
  onSlotsUpdate,
  operationStatuses = {},
}) {
  const [conflicts, setConflicts] = useState(new Set())
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedVehicles, setExpandedVehicles] = useState(new Set())
  const hasAutoScrolledRef = useRef(false)
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
      const { conflictIds } = detectAllConflicts(slots)
      setConflicts(conflictIds)
    } else {
      setConflicts(new Set())
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

  const getVehicleColumnWidth = (isExpanded) =>
    isExpanded ? 'min(60vw, 420px)' : 'min(40vw, 300px)'

  // 時間軸の生成（18:00〜翌06:00、15分刻み）
  // 営業時間は18:00〜翌06:00なので、06:00は含まない（06:00は営業時間外）
  const generateTimeSlots = () => {
    const slots = []
    // 18:00〜23:45（24個）
    for (let hour = 18; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({ hour, minute })
      }
    }
    // 00:00〜05:45（24個）
    for (let hour = 0; hour < 6; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({ hour, minute })
      }
    }
    // 合計48個（0-47）
    return slots
  }

  const timeSlots = generateTimeSlots()
  const totalHeight = timeSlots.length * 20 // 15分 = 20px

  // 現在時刻の位置を計算（営業時間内の場合のみ、1分単位で正確に計算）
  const getCurrentTimePosition = () => {
    const now = new Date(currentTime)
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const seconds = now.getSeconds()
    const totalMinutes = hours * 60 + minutes

    // 営業時間は18:00〜翌06:00
    // 18:00 = 1080分、06:00 = 360分
    // 営業時間外: 06:00 < 時刻 < 18:00
    if (totalMinutes > 360 && totalMinutes < 1080) {
      return null
    }

    // 営業時間内の場合、18:00を基準に1分単位で正確な位置を計算
    try {
      let minutesFromStart = 0

      if (hours >= 18) {
        // 18:00以降（当日）
        // 例: 20:30 = (20-18)*60 + 30 = 150分
        minutesFromStart = (hours - 18) * 60 + minutes
      } else {
        // 06:00未満（翌日）
        // 例: 02:30 = (24-18)*60 + 2*60 + 30 = 360 + 120 + 30 = 510分
        minutesFromStart = (24 - 18) * 60 + hours * 60 + minutes
      }

      // 秒も考慮（1分 = 20/15 = 4/3 px、1秒 = (4/3)/60 px）
      const totalSeconds = minutesFromStart * 60 + seconds
      const pixelsPerSecond = 20 / 15 / 60 // 1秒あたりのピクセル数
      const position = totalSeconds * pixelsPerSecond

      // タイムラインの範囲内かチェック（0〜totalHeight）
      // totalHeight = 48行 * 20px = 960px
      if (position < 0 || position > totalHeight) {
        return null
      }

      return position
    } catch (error) {
      // エラーの場合はnullを返す
      return null
    }
  }

  const currentTimePosition = getCurrentTimePosition()

  // 現在時刻の位置まで自動スクロール（初回表示時のみ）
  useEffect(() => {
    const scrollContainer = timelineBodyRef.current || bodyScrollRef.current

    if (hasAutoScrolledRef.current || currentTimePosition === null || !scrollContainer) {
      return
    }

    const timeoutId = setTimeout(() => {
      if (!scrollContainer || hasAutoScrolledRef.current) return

      const containerHeight = scrollContainer.clientHeight
      const scrollPosition = currentTimePosition - containerHeight / 2
      scrollContainer.scrollTop = Math.max(0, scrollPosition)
      hasAutoScrolledRef.current = true
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [currentTimePosition])

  // 車両ごとのスロットを取得
  const getSlotsForVehicle = (vehicleId) => {
    return slots.filter((slot) => slot.vehicle_id === vehicleId)
  }

  // 号車列の拡大/縮小を切り替える関数
  const toggleVehicleExpand = (vehicleId) => {
    setExpandedVehicles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId)
      } else {
        newSet.add(vehicleId)
      }
      return newSet
    })
  }

  return (
    <div className="timeline-grid">
      <div className="timeline-header-wrapper" ref={headerScrollRef}>
        <div className="timeline-header">
          <div className="time-axis-label">時間</div>
          <div className="vehicles-header">
            {vehicles.map((vehicle) => {
              // 稼働状況を判定（現在時刻で判定）
              const statuses = operationStatuses[vehicle.id] || []
              const now = new Date()
              const isOperational = isVehicleOperational(vehicle.id, now, statuses)
              const isExpanded = expandedVehicles.has(vehicle.id)
              const vehicleHeaderWidth = getVehicleColumnWidth(isExpanded)

              return (
                <div
                  key={vehicle.id}
                  className="vehicle-header-label"
                  style={{ width: vehicleHeaderWidth }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{vehicle.name}</span>
                    {!isOperational && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#999',
                          flexShrink: 0,
                        }}
                        title="非稼働中"
                        aria-label="非稼働中"
                      />
                    )}
                    <Tooltip title={isExpanded ? '列を縮小' : '列を拡大'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleVehicleExpand(vehicle.id)
                        }}
                        aria-label={isExpanded ? '号車列を縮小' : '号車列を拡大'}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          p: 0.25,
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          },
                        }}
                      >
                        {isExpanded ? (
                          <CloseFullscreenIcon fontSize="small" />
                        ) : (
                          <OpenInFullIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
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
                const showMarker =
                  ts.minute === 0 || ts.minute === 15 || ts.minute === 30 || ts.minute === 45
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
              {vehicles.map((vehicle) => {
                const isExpanded = expandedVehicles.has(vehicle.id)
                const vehicleColumnWidth = getVehicleColumnWidth(isExpanded)

                return (
                  <VehicleColumn
                    key={vehicle.id}
                    vehicle={vehicle}
                    slots={getSlotsForVehicle(vehicle.id)}
                    conflicts={conflicts}
                    orders={orders}
                    allSlots={slots}
                    vehicles={vehicles}
                    timeSlots={timeSlots}
                    totalHeight={totalHeight}
                    dragOverPosition={
                      dragOverPosition?.vehicleId === vehicle.id ? dragOverPosition : null
                    }
                    draggingSlotVehicleId={draggingSlotVehicleId}
                    selectedOrderId={selectedOrderId}
                    onSlotSelect={onOrderSelect}
                    operationStatuses={operationStatuses[vehicle.id] || []}
                    columnWidth={vehicleColumnWidth}
                  />
                )
              })}
            </div>

            {/* 現在時刻ライン */}
            {currentTimePosition !== null && (
              <div
                className="current-time-line"
                style={{
                  top: `${currentTimePosition}px`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VehicleColumn({
  vehicle,
  slots,
  conflicts,
  orders,
  allSlots,
  vehicles,
  timeSlots,
  totalHeight,
  dragOverPosition,
  onSlotSelect,
  draggingSlotVehicleId,
  selectedOrderId,
  operationStatuses = [],
  columnWidth = 'min(40vw, 300px)',
}) {
  // 営業日の基準日を計算
  const now = new Date()
  const localHours = now.getHours()
  let businessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (localHours < 6) {
    // 06:00未満の場合は前日の営業日として扱う
    businessDay.setDate(businessDay.getDate() - 1)
  }

  // 各行（15分刻み）の稼働状況を判定
  const getOperationalStatusForRow = (rowIndex) => {
    // rowIndexが有効な範囲（0-47）内かチェック
    if (rowIndex < 0 || rowIndex > 47) {
      // 範囲外の場合はデフォルトで稼働（エラーを避けるため）
      return true
    }
    try {
      const rowDate = rowIndexToDate(rowIndex, businessDay)
      return isVehicleOperational(vehicle.id, rowDate, operationStatuses)
    } catch (error) {
      // エラーが発生した場合はデフォルトで稼働
      console.warn('Error checking operational status for row:', rowIndex, error)
      return true
    }
  }
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
      style={{ height: `${totalHeight}px`, width: columnWidth }}
    >
      {/* 時間行の区切り線と非稼働時間帯の表示 */}
      {timeSlots.map((ts, index) => {
        const isOperational = getOperationalStatusForRow(index)
        return (
          <div key={index}>
            <div className="time-cell-divider" style={{ top: `${index * 20}px` }} />
            {!isOperational && (
              <div
                className="non-operational-time"
                style={{
                  position: 'absolute',
                  top: `${index * 20}px`,
                  left: 0,
                  right: 0,
                  height: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0, 0, 0, 0.1) 4px, rgba(0, 0, 0, 0.1) 8px)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
                title="非稼働時間帯"
              />
            )}
          </div>
        )
      })}

      {/* ドロップ予定位置のプレビュー */}
      {dragOverPosition && dragOverPosition.top >= 0 && (
        <div
          className={`drop-preview-card${
            dragOverPosition.snapGuide === 'top'
              ? ' drop-preview-card--snap-top'
              : dragOverPosition.snapGuide === 'bottom'
                ? ' drop-preview-card--snap-bottom'
                : ''
          }`}
          style={{
            top: `${dragOverPosition.top}px`,
            height: `${dragOverPosition.height ?? 20}px`,
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
            isSelected={selectedOrderId === order.id}
            conflictTooltip={
              conflicts.has(slot.id) ? getSlotConflictTooltip(slot.id, allSlots, vehicles) : ''
            }
            onClick={() => onSlotSelect(order)}
          />
        )
      })}
    </div>
  )
}
