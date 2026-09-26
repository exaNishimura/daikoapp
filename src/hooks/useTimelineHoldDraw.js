import { useCallback, useEffect, useRef, useState } from 'react'
import { buildTimelinePlacementBands } from '@/utils/operationStatusUtils'
import {
  getLastRowIndex,
  pixelsToRowIndex,
  rowIndexToPixels,
  TIMELINE_ROW_HEIGHT_PX,
} from '@/utils/rowUtils'
import { parseWorkDateKey } from '@/utils/businessDayUtils'
import {
  DRAW_SLOP_PX,
  LONG_PRESS_MS,
  assessHoldRange,
  formatHoldRangeLabel,
  resolveDrawRange,
} from '@/lib/holdSlot'

function contentY(scroller, clientY) {
  const rect = scroller.getBoundingClientRect()
  return clientY - rect.top + scroller.scrollTop
}

/**
 * 車両列の空きを長押しして仮枠を作る。
 * 長押し前の移動はスクロールのまま。長押し後は縦ドラッグで長さを変える。
 * 既存スロット上の pointerdown は呼び出し側で無視する。
 */
export function useTimelineHoldDraw({
  scrollerRef,
  slots,
  operationStatuses,
  nightDate,
  enabled = true,
  onHoldRange,
  onHoldReject,
}) {
  const [preview, setPreview] = useState(null)
  const gestureRef = useRef(null)
  const creatingRef = useRef(false)
  const slotsRef = useRef(slots)
  const operationStatusesRef = useRef(operationStatuses)
  const nightDateRef = useRef(nightDate)
  const enabledRef = useRef(enabled)
  const onHoldRangeRef = useRef(onHoldRange)
  const onHoldRejectRef = useRef(onHoldReject)

  useEffect(() => {
    slotsRef.current = slots
    operationStatusesRef.current = operationStatuses
    nightDateRef.current = nightDate
    enabledRef.current = enabled
    onHoldRangeRef.current = onHoldRange
    onHoldRejectRef.current = onHoldReject
  }, [slots, operationStatuses, nightDate, enabled, onHoldRange, onHoldReject])

  const clearGesture = useCallback(() => {
    const gesture = gestureRef.current
    if (!gesture) return
    window.clearTimeout(gesture.timer)
    window.removeEventListener('pointermove', gesture.onMove)
    window.removeEventListener('pointerup', gesture.onUp)
    window.removeEventListener('pointercancel', gesture.onUp)
    gesture.column?.removeEventListener('contextmenu', gesture.onContextMenu)
    if (gesture.scroller && gesture.onTouchMove) {
      gesture.scroller.removeEventListener('touchmove', gesture.onTouchMove)
    }
    gesture.scroller?.classList.remove('is-range-drawing')
    try {
      if (gesture.column?.hasPointerCapture?.(gesture.pointerId)) {
        gesture.column.releasePointerCapture(gesture.pointerId)
      }
    } catch {
      // 指が既に離れている
    }
    gestureRef.current = null
  }, [])

  useEffect(() => () => clearGesture(), [clearGesture])

  const previewFor = (vehicleId, anchorRow, currentRow, drawing) => {
    const businessDay = parseWorkDateKey(nightDateRef.current)
    if (!businessDay) return null
    const lastRow = getLastRowIndex()
    const range = resolveDrawRange(anchorRow, currentRow, drawing, lastRow)
    const statuses = operationStatusesRef.current?.[vehicleId] || []
    const { blockedBands } = buildTimelinePlacementBands(statuses)
    const vehicleSlots = slotsRef.current.filter((slot) => slot.vehicle_id === vehicleId)
    const assessment = assessHoldRange({
      ...range,
      vehicleSlots,
      blockedBands,
      businessDay,
    })
    return {
      vehicleId,
      top: rowIndexToPixels(range.startRow),
      height: (range.endRow - range.startRow) * TIMELINE_ROW_HEIGHT_PX,
      invalid: !assessment.ok,
      label: formatHoldRangeLabel(assessment.startAt, assessment.endAt),
      assessment,
    }
  }

  const beginPointerDown = (event, vehicleId) => {
    if (!enabledRef.current || creatingRef.current || gestureRef.current) return
    if (event.button != null && event.button !== 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const anchorRow = pixelsToRowIndex(contentY(scroller, event.clientY))
    const gesture = {
      pointerId: event.pointerId,
      vehicleId,
      anchorRow,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollTop: scroller.scrollTop,
      armed: false,
      resized: false,
      timer: 0,
      column: event.currentTarget,
      scroller,
      onMove: null,
      onUp: null,
      onTouchMove: null,
      onContextMenu: null,
    }

    const armDraw = () => {
      const current = gestureRef.current
      if (!current || current.armed || current.pointerId !== gesture.pointerId) return
      current.armed = true
      current.scroller.scrollTop = current.startScrollTop
      current.scroller.classList.add('is-range-drawing')
      try {
        current.column?.setPointerCapture?.(current.pointerId)
      } catch {
        // この指ではキャプチャできない
      }
      current.scroller.addEventListener('touchmove', current.onTouchMove, { passive: false })
      setPreview(previewFor(current.vehicleId, current.anchorRow, current.anchorRow, false))
    }

    gesture.onContextMenu = (menuEvent) => {
      menuEvent.preventDefault()
    }
    gesture.onTouchMove = (touchEvent) => {
      if (gestureRef.current?.armed) touchEvent.preventDefault()
    }
    gesture.onMove = (moveEvent) => {
      const current = gestureRef.current
      if (!current || moveEvent.pointerId !== current.pointerId) return
      if (!enabledRef.current) {
        clearGesture()
        setPreview(null)
        return
      }
      const dx = moveEvent.clientX - current.startClientX
      const dy = moveEvent.clientY - current.startClientY
      const moved = Math.hypot(dx, dy) >= DRAW_SLOP_PX
      if (!current.armed) {
        if (!moved) return
        clearGesture()
        setPreview(null)
        return
      }
      if (!moved) return
      current.resized = true
      current.scroller.scrollTop = current.startScrollTop
      const row = pixelsToRowIndex(contentY(current.scroller, moveEvent.clientY))
      setPreview(previewFor(current.vehicleId, current.anchorRow, row, true))
    }
    gesture.onUp = (upEvent) => {
      const current = gestureRef.current
      if (!current || upEvent.pointerId !== current.pointerId) return
      const armed = current.armed
      const resized = current.resized
      const row = pixelsToRowIndex(contentY(current.scroller, upEvent.clientY))
      const heldVehicleId = current.vehicleId
      const anchor = current.anchorRow
      clearGesture()
      setPreview(null)
      if (!armed || upEvent.type === 'pointercancel') return
      const next = previewFor(heldVehicleId, anchor, resized ? row : anchor, resized)
      if (!next) {
        onHoldRejectRef.current?.('この日付には枠を作れません')
        return
      }
      if (!next.assessment.ok) {
        onHoldRejectRef.current?.(next.assessment.reason)
        return
      }
      creatingRef.current = true
      Promise.resolve(
        onHoldRangeRef.current?.({
          vehicleId: heldVehicleId,
          startAt: next.assessment.startAt,
          endAt: next.assessment.endAt,
        })
      ).finally(() => {
        creatingRef.current = false
      })
    }

    gesture.timer = window.setTimeout(armDraw, LONG_PRESS_MS)
    gestureRef.current = gesture
    gesture.column?.addEventListener('contextmenu', gesture.onContextMenu)
    window.addEventListener('pointermove', gesture.onMove)
    window.addEventListener('pointerup', gesture.onUp)
    window.addEventListener('pointercancel', gesture.onUp)
  }

  return { preview, beginPointerDown }
}
