import { useEffect, useState } from 'react'
import { getOrderById } from '@/services/orderService'
import { createSlot, updateSlot } from '@/services/slotService'
import { calculateBuffer } from '@/services/routeService'
import { exceedsBusinessHours } from '@/utils/timeUtils'
import {
  pixelsToRowIndex,
  rowIndexToDate,
  snapToRowIndex,
  dateToRowIndex,
  rowIndexToPixels,
} from '@/utils/rowUtils'
import { isVehicleOperational } from '@/utils/operationStatusUtils'

/**
 * 内部 util: タイムライン要素内の Y 座標を取り出す。
 * .timeline-content-wrapper はマウント済み前提。
 */
function calculateTimelineY(clientY) {
  const timelineBody = document.querySelector('.timeline-content-wrapper')
  if (!timelineBody) return null
  const rect = timelineBody.getBoundingClientRect()
  return clientY - rect.top + timelineBody.scrollTop
}

/**
 * マウス / タッチ両対応で clientY を取り出す。
 */
function getClientYFromEvent(event) {
  if (!event) return null
  if (event.touches && event.touches.length > 0) return event.touches[0].clientY
  if (event.clientY !== undefined) return event.clientY
  return null
}

/**
 * DispatchBoard の DnD レイヤー。
 *
 * - dragOverPosition / mousePosition / draggingSlotVehicleId の state
 * - mousemove / touchmove のグローバルリスナで、ドラッグ中のハイライト
 *   位置をリアルタイム追跡
 * - handleDragStart / Cancel / Over / End: スロット移動と未割当
 *   依頼ドロップの両方を処理
 *
 * 副作用 (createSlot / updateSlot) のあとは setSlots を呼んで楽観的
 * 更新する。データ取得は呼び出し側 (useDispatchData) のものを使う。
 */
export function useDispatchDnD({ vehicles, slots, operationStatuses, setSlots, setOrders }) {
  const [dragOverPosition, setDragOverPosition] = useState(null)
  const [mousePosition, setMousePosition] = useState(null)
  const [draggingSlotVehicleId, setDraggingSlotVehicleId] = useState(null)

  // mousemove / touchmove で位置を追跡し、ハイライトをリアルタイム更新
  useEffect(() => {
    const updatePosition = (clientX, clientY) => {
      setMousePosition({ x: clientX, y: clientY })
      if (dragOverPosition !== null) {
        const timelineBody = document.querySelector('.timeline-content-wrapper')
        if (timelineBody) {
          const rect = timelineBody.getBoundingClientRect()
          const mouseY = clientY - rect.top + timelineBody.scrollTop
          const vehicleElement = document.querySelector(
            `[data-vehicle-id="${dragOverPosition.vehicleId}"]`
          )
          if (vehicleElement) {
            setDragOverPosition({ vehicleId: dragOverPosition.vehicleId, top: mouseY })
          }
        }
      }
    }

    const handleMouseMove = (e) => updatePosition(e.clientX, e.clientY)
    const handleTouchMove = (e) => {
      // ドラッグ中だけスクロールを抑制する
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
    if (event.active.data.current?.type === 'slot' && event.active.data.current?.slot) {
      setDraggingSlotVehicleId(event.active.data.current.slot.vehicle_id)
    } else {
      setDraggingSlotVehicleId(null)
    }
  }

  const handleDragCancel = () => {
    setDragOverPosition(null)
    setMousePosition(null)
    setDraggingSlotVehicleId(null)
  }

  const handleDragOver = (event) => {
    const { active, over } = event

    if (!over || over.data.current?.type !== 'vehicle') {
      setDragOverPosition(null)
      return
    }

    let clientY = null
    if (event.activatorEvent) clientY = getClientYFromEvent(event.activatorEvent)
    if (clientY === null && mousePosition) clientY = mousePosition.y

    if (clientY === null) {
      // 最終フォールバック: 元のスロット位置 + delta.y
      if (active.data.current?.type === 'slot' && active.data.current?.slot) {
        const slot = active.data.current.slot
        const startRowIndex = dateToRowIndex(new Date(slot.start_at))
        const originalTop = rowIndexToPixels(startRowIndex)
        if (event.delta?.y !== undefined) {
          setDragOverPosition({
            vehicleId: over.data.current.vehicleId,
            top: originalTop + event.delta.y,
          })
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

    setDragOverPosition({ vehicleId: over.data.current.vehicleId, top: mouseY })
  }

  /**
   * ドロップ位置から時刻を 15 分にスナップして返す。
   * クリア前のスナップショットを参照に渡す。
   */
  function calcTimeFromDropPosition({
    targetVehicleId,
    currentDragOverPosition,
    currentMousePosition,
    activatorEvent,
  }) {
    let dropY = null

    if (currentMousePosition) {
      dropY = calculateTimelineY(currentMousePosition.y)
    } else if (currentDragOverPosition && currentDragOverPosition.vehicleId === targetVehicleId) {
      dropY = currentDragOverPosition.top
    } else if (activatorEvent) {
      const clientY = getClientYFromEvent(activatorEvent)
      if (clientY !== null) dropY = calculateTimelineY(clientY)
    }

    if (dropY === null) return null

    const rowIndex = pixelsToRowIndex(dropY)
    const snappedRowIndex = snapToRowIndex(rowIndex)

    // 営業日基準を計算 (06:00 未満は前日扱い)
    const now = new Date()
    let businessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (now.getHours() < 6) businessDay.setDate(businessDay.getDate() - 1)

    return rowIndexToDate(snappedRowIndex, businessDay)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over) {
      setDragOverPosition(null)
      setMousePosition(null)
      setDraggingSlotVehicleId(null)
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

    // 既存スロットの移動
    if (active.data.current?.type === 'slot' && over.data.current?.vehicleId) {
      const slot = active.data.current.slot
      const order = active.data.current.order
      const newVehicleId = over.data.current.vehicleId

      if (!slot || !order) {
        if (import.meta.env.DEV) console.error('Slot or order data not found')
        return
      }

      const { data: latestOrder, error: orderError } = await getOrderById(order.id)
      if (orderError) {
        if (import.meta.env.DEV) console.error('Error fetching latest order:', orderError)
        alert('依頼データの取得に失敗しました')
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
        alert('この時間帯は車両が稼働していないため配置できません。')
        return
      }
      if (exceedsBusinessHours(endAt)) {
        alert('06:00を超えるため配置できません。開始時刻を前にずらしてください。')
        return
      }

      const updateData = {
        vehicle_id: newVehicleId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      }
      if (slot.status === 'CONFIRMED') updateData.status = 'TENTATIVE'

      const { data: updatedSlot, error: updateError } = await updateSlot(slot.id, updateData)
      if (updateError) {
        if (import.meta.env.DEV) console.error('Error updating slot:', updateError)
        return
      }
      if (updatedSlot) {
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? updatedSlot : s)))
      }
    }

    // 未割当依頼の新規ドロップ
    if (active.data.current?.type === 'order' && over.data.current?.vehicleId) {
      const order = active.data.current.order
      const targetVehicleId = over.data.current.vehicleId

      if (!order) {
        if (import.meta.env.DEV) console.error('Order data not found')
        return
      }

      const newStartAt = calcTimeFromDropPosition({
        targetVehicleId,
        ...dropContext,
      })

      if (!newStartAt) {
        alert('ドロップ位置から時刻を計算できませんでした')
        return
      }

      const statuses = operationStatuses[targetVehicleId] || []
      if (!isVehicleOperational(targetVehicleId, newStartAt, statuses)) {
        alert('この時間帯は車両が稼働していないため配置できません。')
        return
      }

      const baseDuration = order.base_duration_min || 30
      const buffer = order.buffer_min || calculateBuffer(baseDuration)
      const totalDuration = baseDuration + buffer

      const endAt = new Date(newStartAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      if (exceedsBusinessHours(endAt)) {
        alert('06:00を超えるため配置できません。開始時刻を前にずらしてください。')
        return
      }

      const { data: newSlot, error: slotError } = await createSlot({
        order_id: order.id,
        vehicle_id: targetVehicleId,
        start_at: newStartAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'TENTATIVE',
      })

      if (slotError) {
        if (import.meta.env.DEV) console.error('Error creating slot:', slotError)
        alert('スロットの作成に失敗しました')
        return
      }
      if (newSlot) {
        setSlots((prev) => [...prev, newSlot])
      }

      const { data: updatedOrder, error: orderUpdateError } = await getOrderById(order.id)
      if (!orderUpdateError && updatedOrder) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)))
      }
    }
  }

  // vehicles は将来 lookup したいときのため受け取り続ける（現状は使わない）
  void vehicles
  void slots

  return {
    dragOverPosition,
    draggingSlotVehicleId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
