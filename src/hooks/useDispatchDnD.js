import { useEffect, useRef, useState } from 'react'
import { getOrderById } from '@/services/orderService'
import { createSlot, updateSlot } from '@/services/slotService'
import { calculateBuffer } from '@/services/routeService'
import { exceedsBusinessHours } from '@/utils/timeUtils'
import { useToast } from '@/contexts/ToastContext'
import {
  rowIndexToDate,
  snapToRowIndex,
  dateToRowIndex,
  rowIndexToPixels,
  pixelsToRowIndex,
} from '@/utils/rowUtils'
import { isVehicleOperational, getEarliestOperationalStartTime } from '@/utils/operationStatusUtils'
import { getOrderDurationPixels, resolveSlotDropPreview } from '@/lib/slotSnapUtils'

function getOperationalPlacementMessage(statuses, targetTime) {
  const earliest = getEarliestOperationalStartTime(statuses, targetTime)
  if (earliest) {
    const timeLabel = earliest.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `この号車の出勤時刻（${timeLabel}）より前には配置できません。`
  }
  return 'この時間帯は車両が稼働していないため配置できません。'
}

function calculateTimelineY(clientY) {
  const timelineBody = document.querySelector('.timeline-content-wrapper')
  if (!timelineBody) return null
  const rect = timelineBody.getBoundingClientRect()
  return clientY - rect.top + timelineBody.scrollTop
}

function getClientYFromEvent(event) {
  if (!event) return null
  if (event.touches && event.touches.length > 0) return event.touches[0].clientY
  if (event.clientY !== undefined) return event.clientY
  return null
}

export function useDispatchDnD({ vehicles, slots, orders, operationStatuses, setSlots, setOrders }) {
  const { showToast } = useToast()
  const [dragOverPosition, setDragOverPosition] = useState(null)
  const [mousePosition, setMousePosition] = useState(null)
  const [draggingSlotVehicleId, setDraggingSlotVehicleId] = useState(null)

  const dragContextRef = useRef(null)
  const slotsRef = useRef(slots)
  const ordersRef = useRef(orders)

  slotsRef.current = slots
  ordersRef.current = orders

  const buildDragPreview = (vehicleId, rawTopPx) => {
    const ctx = dragContextRef.current
    if (!ctx) {
      return {
        vehicleId,
        top: rowIndexToPixels(snapToRowIndex(pixelsToRowIndex(rawTopPx))),
        height: 20,
        snapGuide: null,
      }
    }

    const vehicleSlots = slotsRef.current.filter((s) => s.vehicle_id === vehicleId)
    const preview = resolveSlotDropPreview({
      rawTopPx,
      dragHeightPx: ctx.heightPx,
      vehicleSlots,
      orders: ordersRef.current,
      excludeSlotId: ctx.excludeSlotId,
    })

    return {
      vehicleId,
      top: preview.top,
      height: preview.height,
      snapGuide: preview.snapGuide,
    }
  }

  useEffect(() => {
    const updatePosition = (clientX, clientY) => {
      setMousePosition({ x: clientX, y: clientY })
      if (dragOverPosition !== null) {
        const mouseY = calculateTimelineY(clientY)
        if (mouseY === null) return
        setDragOverPosition(buildDragPreview(dragOverPosition.vehicleId, mouseY))
      }
    }

    const handleMouseMove = (e) => updatePosition(e.clientX, e.clientY)
    const handleTouchMove = (e) => {
      if (dragOverPosition === null) return
      e.preventDefault()
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        updatePosition(touch.clientX, touch.clientY)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [dragOverPosition])

  const handleDragStart = (event) => {
    setMousePosition(null)
    const data = event.active.data.current

    if (data?.type === 'slot' && data.slot && data.order) {
      dragContextRef.current = {
        type: 'slot',
        excludeSlotId: data.slot.id,
        heightPx: getOrderDurationPixels(data.order),
      }
      setDraggingSlotVehicleId(data.slot.vehicle_id)
      return
    }

    if (data?.type === 'order' && data.order) {
      dragContextRef.current = {
        type: 'order',
        excludeSlotId: null,
        heightPx: getOrderDurationPixels(data.order),
      }
      setDraggingSlotVehicleId(null)
      return
    }

    dragContextRef.current = null
    setDraggingSlotVehicleId(null)
  }

  const handleDragCancel = () => {
    setDragOverPosition(null)
    setMousePosition(null)
    setDraggingSlotVehicleId(null)
    dragContextRef.current = null
  }

  const handleDragOver = (event) => {
    const { active, over } = event

    if (!over || over.data.current?.type !== 'vehicle') {
      setDragOverPosition(null)
      return
    }

    const vehicleId = over.data.current.vehicleId
    let clientY = null
    if (event.activatorEvent) clientY = getClientYFromEvent(event.activatorEvent)
    if (clientY === null && mousePosition) clientY = mousePosition.y

    if (clientY === null) {
      if (active.data.current?.type === 'slot' && active.data.current?.slot) {
        const slot = active.data.current.slot
        const order = active.data.current.order
        const startRowIndex = dateToRowIndex(new Date(slot.start_at))
        const originalTop = rowIndexToPixels(startRowIndex)
        if (event.delta?.y !== undefined) {
          setDragOverPosition(
            buildDragPreview(vehicleId, originalTop + event.delta.y)
          )
          return
        }
      }
      setDragOverPosition(null)
      return
    }

    const mouseY = calculateTimelineY(clientY)
    if (mouseY === null) {
      setDragOverPosition(null)
      return
    }

    setDragOverPosition(buildDragPreview(vehicleId, mouseY))
  }

  function calcTimeFromDropPosition({
    targetVehicleId,
    currentDragOverPosition,
    currentMousePosition,
    activatorEvent,
  }) {
    if (
      currentDragOverPosition &&
      currentDragOverPosition.vehicleId === targetVehicleId &&
      currentDragOverPosition.top != null
    ) {
      const snappedRowIndex = snapToRowIndex(pixelsToRowIndex(currentDragOverPosition.top))
      const now = new Date()
      let businessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (now.getHours() < 6) businessDay.setDate(businessDay.getDate() - 1)
      return rowIndexToDate(snappedRowIndex, businessDay)
    }

    let dropY = null
    if (currentMousePosition) {
      dropY = calculateTimelineY(currentMousePosition.y)
    } else if (activatorEvent) {
      const clientY = getClientYFromEvent(activatorEvent)
      if (clientY !== null) dropY = calculateTimelineY(clientY)
    }

    if (dropY === null) return null

    const ctx = dragContextRef.current
    if (ctx) {
      const vehicleSlots = slotsRef.current.filter((s) => s.vehicle_id === targetVehicleId)
      const preview = resolveSlotDropPreview({
        rawTopPx: dropY,
        dragHeightPx: ctx.heightPx,
        vehicleSlots,
        orders: ordersRef.current,
        excludeSlotId: ctx.excludeSlotId,
      })
      dropY = preview.top
    }

    const snappedRowIndex = snapToRowIndex(pixelsToRowIndex(dropY))
    const now = new Date()
    let businessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (now.getHours() < 6) businessDay.setDate(businessDay.getDate() - 1)

    return rowIndexToDate(snappedRowIndex, businessDay)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over) {
      handleDragCancel()
      return
    }

    const currentDragOverPosition = dragOverPosition
    const currentMousePosition = mousePosition
    setDragOverPosition(null)
    setMousePosition(null)
    setDraggingSlotVehicleId(null)

    const dropContext = {
      currentDragOverPosition,
      currentMousePosition,
      activatorEvent: event.activatorEvent,
    }

    const clearDragContext = () => {
      dragContextRef.current = null
    }

    if (active.data.current?.type === 'slot' && over.data.current?.vehicleId) {
      const slot = active.data.current.slot
      const order = active.data.current.order
      const newVehicleId = over.data.current.vehicleId

      if (!slot || !order) {
        if (import.meta.env.DEV) console.error('Slot or order data not found')
        clearDragContext()
        return
      }

      const { data: latestOrder, error: orderError } = await getOrderById(order.id)
      if (orderError) {
        if (import.meta.env.DEV) console.error('Error fetching latest order:', orderError)
        showToast('依頼データの取得に失敗しました', 'error')
        clearDragContext()
        return
      }

      const newStartAt = calcTimeFromDropPosition({ targetVehicleId: newVehicleId, ...dropContext })

      const baseDuration = latestOrder?.base_duration_min || 30
      const buffer = latestOrder?.buffer_min || calculateBuffer(baseDuration)
      const totalDuration = baseDuration + buffer

      const startAt = newStartAt || new Date(slot.start_at)
      const endAt = new Date(startAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      const statuses = operationStatuses[newVehicleId] || []
      if (!isVehicleOperational(newVehicleId, startAt, statuses)) {
        showToast(getOperationalPlacementMessage(statuses, startAt), 'warning')
        clearDragContext()
        return
      }
      if (exceedsBusinessHours(endAt)) {
        showToast('06:00を超えるため配置できません。開始時刻を前にずらしてください。', 'warning')
        clearDragContext()
        return
      }

      const updateData = {
        vehicle_id: newVehicleId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      }
      if (slot.status === 'CONFIRMED') updateData.status = 'TENTATIVE'

      const { data: updatedSlot, error: updateError } = await updateSlot(slot.id, updateData)
      clearDragContext()
      if (updateError) {
        if (import.meta.env.DEV) console.error('Error updating slot:', updateError)
        return
      }
      if (updatedSlot) {
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? updatedSlot : s)))
      }
      return
    }

    if (active.data.current?.type === 'order' && over.data.current?.vehicleId) {
      const order = active.data.current.order
      const targetVehicleId = over.data.current.vehicleId

      if (!order) {
        if (import.meta.env.DEV) console.error('Order data not found')
        clearDragContext()
        return
      }

      const newStartAt = calcTimeFromDropPosition({
        targetVehicleId,
        ...dropContext,
      })

      if (!newStartAt) {
        showToast('ドロップ位置から時刻を計算できませんでした', 'error')
        clearDragContext()
        return
      }

      const statuses = operationStatuses[targetVehicleId] || []
      if (!isVehicleOperational(targetVehicleId, newStartAt, statuses)) {
        showToast(getOperationalPlacementMessage(statuses, newStartAt), 'warning')
        clearDragContext()
        return
      }

      const baseDuration = order.base_duration_min || 30
      const buffer = order.buffer_min || calculateBuffer(baseDuration)
      const totalDuration = baseDuration + buffer

      const endAt = new Date(newStartAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      if (exceedsBusinessHours(endAt)) {
        showToast('06:00を超えるため配置できません。開始時刻を前にずらしてください。', 'warning')
        clearDragContext()
        return
      }

      const { data: newSlot, error: slotError } = await createSlot({
        order_id: order.id,
        vehicle_id: targetVehicleId,
        start_at: newStartAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'TENTATIVE',
      })

      clearDragContext()

      if (slotError) {
        if (import.meta.env.DEV) console.error('Error creating slot:', slotError)
        showToast('スロットの作成に失敗しました', 'error')
        return
      }
      if (newSlot) {
        setSlots((prev) => [...prev, newSlot])
      }

      const { data: updatedOrder, error: orderUpdateError } = await getOrderById(order.id)
      if (!orderUpdateError && updatedOrder) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)))
      }
    } else {
      clearDragContext()
    }
  }

  void vehicles

  return {
    dragOverPosition,
    draggingSlotVehicleId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
