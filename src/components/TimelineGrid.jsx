import { useDroppable } from '@dnd-kit/core'
import { SlotComponent } from './SlotComponent'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  isVehicleOperational,
  buildTimelinePlacementBands,
  getOperationalVehicles,
} from '@/utils/operationStatusUtils'
import { detectAllConflicts, getSlotConflictTooltip } from '@/lib/slotConflictUtils'
import { TIMELINE_ROW_HEIGHT_PX } from '@/utils/rowUtils'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Maximize2, Minimize2 } from 'lucide-react'
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
  const [focusedVehicleId, setFocusedVehicleId] = useState(null)
  const userOverrideFocusRef = useRef(false)
  const prevSoleOperationalIdRef = useRef(null)
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

  const defaultVehicleColumnWidth = 'min(40vw, 300px)'

  const operationalVehicles = useMemo(
    () => getOperationalVehicles(vehicles, currentTime, operationStatuses),
    [vehicles, currentTime, operationStatuses]
  )

  const soleOperationalVehicleId =
    operationalVehicles.length === 1 ? operationalVehicles[0].id : null

  // 稼働中が1台だけのときはデフォルトでその列を全幅表示
  useEffect(() => {
    if (soleOperationalVehicleId) {
      if (prevSoleOperationalIdRef.current !== soleOperationalVehicleId) {
        userOverrideFocusRef.current = false
        prevSoleOperationalIdRef.current = soleOperationalVehicleId
      }
      if (!userOverrideFocusRef.current) {
        setFocusedVehicleId(soleOperationalVehicleId)
      }
      return
    }

    prevSoleOperationalIdRef.current = null
    if (!userOverrideFocusRef.current) {
      setFocusedVehicleId(null)
    }
  }, [soleOperationalVehicleId])

  const displayVehicles = useMemo(
    () =>
      focusedVehicleId ? vehicles.filter((vehicle) => vehicle.id === focusedVehicleId) : vehicles,
    [vehicles, focusedVehicleId]
  )

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
  const totalHeight = timeSlots.length * TIMELINE_ROW_HEIGHT_PX

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
      const pixelsPerSecond = TIMELINE_ROW_HEIGHT_PX / 15 / 60 // 1秒あたりのピクセル数
      const position = totalSeconds * pixelsPerSecond

      // タイムラインの範囲内かチェック（0〜totalHeight）
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

  const toggleVehicleFocus = (vehicleId) => {
    userOverrideFocusRef.current = true
    setFocusedVehicleId((prev) => (prev === vehicleId ? null : vehicleId))
  }

  return (
    <div
      className={`timeline-grid${focusedVehicleId ? ' timeline-grid--vehicle-focused' : ''}`}
      style={{ '--timeline-row-height': `${TIMELINE_ROW_HEIGHT_PX}px` }}
    >
      <div className="timeline-header-wrapper" ref={headerScrollRef}>
        <div className="timeline-header">
          <div className="time-axis-label">時間</div>
          <div className={`vehicles-header${focusedVehicleId ? ' vehicles-header--focused' : ''}`}>
            {displayVehicles.map((vehicle) => {
              // 稼働状況を判定（現在時刻で判定）
              const statuses = operationStatuses[vehicle.id] || []
              const now = new Date()
              const isOperational = isVehicleOperational(vehicle.id, now, statuses)
              const isFocused = focusedVehicleId === vehicle.id

              return (
                <div
                  key={vehicle.id}
                  className={`vehicle-header-label${isFocused ? ' vehicle-header-label--focused' : ''}`}
                  style={isFocused ? undefined : { width: defaultVehicleColumnWidth }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <span
                      className={`vehicle-status-dot${isOperational ? ' vehicle-status-dot--on' : ''}`}
                      title={isOperational ? '稼働中' : '非稼働中'}
                      aria-label={isOperational ? '稼働中' : '非稼働中'}
                    />
                    <span>{vehicle.name}</span>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label={isFocused ? '全号車表示に戻す' : '号車列を全幅表示'}
                      tooltip={isFocused ? '全号車表示に戻す' : 'この号車を全幅表示'}
                      icon={
                        isFocused ? <Minimize2 size={14} /> : <Maximize2 size={14} />
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleVehicleFocus(vehicle.id)
                      }}
                    />
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
                  <div key={index} className="time-marker-row">
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
            <div
              className={`vehicles-columns${focusedVehicleId ? ' vehicles-columns--focused' : ''}`}
            >
              {displayVehicles.map((vehicle) => {
                const isFocused = focusedVehicleId === vehicle.id

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
                    columnWidth={isFocused ? '100%' : defaultVehicleColumnWidth}
                    isFocused={isFocused}
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
  isFocused = false,
}) {
  const { blockedBands, shiftStartTime } = useMemo(
    () => buildTimelinePlacementBands(operationStatuses),
    [operationStatuses]
  )

  const { setNodeRef, isOver } = useDroppable({
    id: `vehicle-${vehicle.id}`,
    data: {
      type: 'vehicle',
      vehicleId: vehicle.id,
    },
  })

  const shouldHighlight = isOver && draggingSlotVehicleId !== vehicle.id
  const isDragPreviewInvalid =
    dragOverPosition &&
    dragOverPosition.vehicleId === vehicle.id &&
    dragOverPosition.isPlacementAllowed === false

  const renderBand = (band, className, options = {}) => {
    const heightPx = (band.endRow - band.startRow) * TIMELINE_ROW_HEIGHT_PX
    if (heightPx <= 0) return null

    return (
      <div
        key={`${className}-${band.startRow}-${band.endRow}`}
        className={className}
        style={{
          top: `${band.startRow * TIMELINE_ROW_HEIGHT_PX}px`,
          height: `${heightPx}px`,
        }}
        title={options.title}
        aria-hidden={options.ariaHidden ?? true}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      data-vehicle-id={vehicle.id}
      className={`vehicle-column ${isFocused ? 'vehicle-column--focused' : ''} ${shouldHighlight ? 'drag-over' : ''} ${
        isDragPreviewInvalid ? 'drag-over-invalid' : ''
      }`}
      style={{ height: `${totalHeight}px`, width: columnWidth }}
    >
      {timeSlots.map((ts, index) => (
        <div
          key={`divider-${index}`}
          className={`time-cell-divider${ts.minute === 0 ? ' time-cell-divider--hour' : ''}`}
          style={{ top: `${index * TIMELINE_ROW_HEIGHT_PX}px` }}
        />
      ))}

      {blockedBands.map((band) =>
        renderBand(band, 'placement-blocked-band', {
          title: shiftStartTime ? `配置不可（出勤 ${shiftStartTime} 以降に配置可）` : '配置不可',
        })
      )}

      {dragOverPosition && dragOverPosition.top >= 0 && (
        <div
          className={`drop-preview-card${
            dragOverPosition.snapGuide === 'top'
              ? ' drop-preview-card--snap-top'
              : dragOverPosition.snapGuide === 'bottom'
                ? ' drop-preview-card--snap-bottom'
                : ''
          }${dragOverPosition.isPlacementAllowed === false ? ' drop-preview-card--invalid' : ''}`}
          style={{
            top: `${dragOverPosition.top}px`,
            height: `${dragOverPosition.height ?? TIMELINE_ROW_HEIGHT_PX}px`,
          }}
        />
      )}

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
