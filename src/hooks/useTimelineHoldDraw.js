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
  assessHoldRange,
  formatHoldRangeLabel,
  resolveDrawRange,
} from '@/lib/holdSlot'

function contentY(scroller, clientY) {
  const rect = scroller.getBoundingClientRect()
  return clientY - rect.top + scroller.scrollTop
}

/**
 * 車両列の空きをタップまたは縦ドラッグして仮枠を作る。
 * 数px動いたらスクロール位置を固定し、プレビューを出す。
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
    window.removeEventListener('pointermove', gesture.onMove)
    window.removeEventListener('pointerup', gesture.onUp)
    window.removeEventListener('pointercancel', gesture.onUp)
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
    if (event.pointerType === 'mouse') event.preventDefault()

    const anchorRow = pixelsToRowIndex(contentY(scroller, event.clientY))
    const gesture = {
      pointerId: event.pointerId,
      vehicleId,
      anchorRow,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollTop: scroller.scrollTop,
      drawing: false,
      column: event.currentTarget,
      scroller,
      onMove: null,
      onUp: null,
      onTouchMove: null,
    }

    gesture.onTouchMove = (touchEvent) => {
      if (gestureRef.current?.drawing) touchEvent.preventDefault()
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
      if (!current.drawing && Math.hypot(dx, dy) < DRAW_SLOP_PX) return
      if (!current.drawing) {
        current.drawing = true
        current.scroller.scrollTop = current.startScrollTop
        current.scroller.classList.add('is-range-drawing')
        try {
          current.column?.setPointerCapture?.(moveEvent.pointerId)
        } catch {
          // この指ではキャプチャできない
        }
      }
      current.scroller.scrollTop = current.startScrollTop
      const row = pixelsToRowIndex(contentY(current.scroller, moveEvent.clientY))
      setPreview(previewFor(current.vehicleId, current.anchorRow, row, true))
    }
    gesture.onUp = (upEvent) => {
      const current = gestureRef.current
      if (!current || upEvent.pointerId !== current.pointerId) return
      const drawing = current.drawing
      const row = pixelsToRowIndex(contentY(current.scroller, upEvent.clientY))
      const next = previewFor(
        current.vehicleId,
        current.anchorRow,
        drawing ? row : current.anchorRow,
        drawing
      )
      const vehicleId = current.vehicleId
      clearGesture()
      setPreview(null)
      if (upEvent.type === 'pointercancel') return
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
          vehicleId,
          startAt: next.assessment.startAt,
          endAt: next.assessment.endAt,
        })
      ).finally(() => {
        creatingRef.current = false
      })
    }

    gestureRef.current = gesture
    window.addEventListener('pointermove', gesture.onMove)
    window.addEventListener('pointerup', gesture.onUp)
    window.addEventListener('pointercancel', gesture.onUp)
    scroller.addEventListener('touchmove', gesture.onTouchMove, { passive: false })
  }

  return { preview, beginPointerDown }
}
