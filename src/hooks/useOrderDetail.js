import { useState, useEffect, useMemo, useCallback } from 'react'
import { getOrderById } from '@/services/orderService'
import { confirmSlot, createSlot } from '@/services/slotService'
import { estimateDuration, calculateBuffer } from '@/services/routeService'
import { getVehicles } from '@/services/vehicleService'
import { supabase } from '@/lib/supabase'
import {
  STATUS_LABELS,
  getStatusLabel,
  getStatusColor,
  getRevertStatus,
  getAdvanceStatus,
} from '@/utils/orderStatusUtils'
import { formatRouteCalculationError } from '@/lib/routeErrors'
import {
  saveOrderEdit,
  recalculateOrderRoute,
  confirmOrder,
  revertOrderStatus,
} from '@/lib/orderActions'
import { useUpdateOrder, useCancelOrder } from '@/hooks/useOrders'
import { useToast } from '@/contexts/ToastContext'
import { getOrderConflictMessages } from '@/lib/slotConflictUtils'

const buildInitialFormData = (order) => ({
  pickup_location: order.pickup_location || '',
  pickup_address: order.pickup_address,
  dropoff_address: order.dropoff_address,
  waypoints: order.waypoints || [],
  contact_phone: order.contact_phone || '',
  car_model: order.car_model || '',
  car_plate: order.car_plate || '',
  car_color: order.car_color || '',
  parking_note: order.parking_note || '',
  base_duration_min: order.base_duration_min || 30,
  buffer_min: order.buffer_min || 0,
})

/**
 * 依頼詳細パネルの state とアクションをまとめた hook。
 *
 * - formData / editing / loading / recalculating / waitingLocationDuration の管理
 * - 編集保存・ルート再計算・確定・ステータス遷移・削除のハンドラ
 * - mutation hooks 経由で更新するため、依頼一覧などのキャッシュも自動的に invalidate される
 */
export function useOrderDetail({ order, vehicles = [], slots = [], onUpdate, onDelete, onClose }) {
  const { showToast } = useToast()
  const relatedVehicle = useMemo(() => {
    if (slots.length === 0) return null
    return vehicles.find((v) => v.id === slots[0].vehicle_id) || null
  }, [vehicles, slots])

  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(() => buildInitialFormData(order))
  const [waitingLocationDuration, setWaitingLocationDuration] = useState(null)
  const [calculatingWaitingDuration, setCalculatingWaitingDuration] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    setFormData(buildInitialFormData(order))
    setEditing(false)
  }, [order.id])

  const updateOrderMutation = useUpdateOrder()
  const cancelOrderMutation = useCancelOrder()

  // orderActions の deps が期待する shape `(id, updates) => { data, error }` に揃える
  const updateOrderAdapter = useCallback(
    async (id, updates) => {
      try {
        const data = await updateOrderMutation.mutateAsync({ id, updates })
        return { data, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
    [updateOrderMutation]
  )

  const actionDeps = useMemo(
    () => ({
      supabase,
      updateOrder: updateOrderAdapter,
      getOrderById,
      getVehicles,
      estimateDuration,
      calculateBuffer,
      createSlot,
      confirmSlot,
    }),
    [updateOrderAdapter]
  )

  // 待機場所までの所要時間（片道）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!order.dropoff_address || !relatedVehicle?.waiting_location_address) {
        setWaitingLocationDuration(null)
        return
      }
      setCalculatingWaitingDuration(true)
      try {
        const { duration, error } = await estimateDuration(
          order.dropoff_address,
          relatedVehicle.waiting_location_address,
          null
        )
        if (cancelled) return
        if (error) {
          if (import.meta.env.DEV) {
            console.error('Error calculating waiting location duration:', error)
          }
          setWaitingLocationDuration(null)
        } else {
          setWaitingLocationDuration(duration ? Math.round(duration / 2) : null)
        }
      } catch (e) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.error('Error calculating waiting location duration:', e)
          }
          setWaitingLocationDuration(null)
        }
      } finally {
        if (!cancelled) setCalculatingWaitingDuration(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [order.dropoff_address, relatedVehicle?.waiting_location_address])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setLoading(true)
    try {
      const updatedOrder = await saveOrderEdit({ order, formData, deps: actionDeps })
      onUpdate?.(updatedOrder)
      setEditing(false)
    } catch (error) {
      console.error('Error updating order:', error)
      showToast('更新に失敗しました', 'error')
    } finally {
      setLoading(false)
    }
  }, [order, formData, actionDeps, onUpdate])

  const handleRecalculateRoute = useCallback(async () => {
    setRecalculating(true)
    try {
      const result = await recalculateOrderRoute({
        order,
        formData,
        relatedVehicle,
        deps: actionDeps,
      })
      setFormData((prev) => ({ ...prev, buffer_min: result.buffer }))
      onUpdate?.(result.order)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error recalculating route:', error)
      }
      const cause = error.cause ?? error.message
      const message =
        typeof cause === 'string' && /API|REQUEST|RESULT|LIMIT|key/.test(cause)
          ? formatRouteCalculationError(cause)
          : `ルート再計算に失敗しました: ${error.message || error}`
      showToast(message, 'error')
    } finally {
      setRecalculating(false)
    }
  }, [order, formData, relatedVehicle, actionDeps, onUpdate])

  const handleConfirm = useCallback(async () => {
    const conflictMessages = getOrderConflictMessages(order.id, slots, vehicles)
    if (conflictMessages.length > 0) {
      showToast(conflictMessages[0], 'error')
      return
    }
    if (!confirm('この依頼を確定しますか？')) return
    setLoading(true)
    try {
      const updatedOrder = await confirmOrder({
        order,
        vehicles,
        slots,
        deps: actionDeps,
      })
      onUpdate?.(updatedOrder)
      showToast('確定しました', 'success')
    } catch (error) {
      console.error('Error confirming slot:', error)
      showToast(`確定に失敗しました: ${error.message || error}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [order, vehicles, slots, actionDeps, onUpdate, showToast])

  const handleRevertStatus = useCallback(async () => {
    const previousStatus = getRevertStatus(order.status)
    if (!previousStatus) {
      showToast('戻すことができないステータスです', 'warning')
      return
    }
    if (!confirm(`${STATUS_LABELS[previousStatus]}に戻しますか？`)) return

    setLoading(true)
    try {
      const updatedOrder = await revertOrderStatus({ order, deps: actionDeps })
      onUpdate?.(updatedOrder)
      showToast('ステータスを戻しました', 'success')
    } catch (error) {
      console.error('Error reverting status:', error)
      showToast(`ステータスの戻しに失敗しました: ${error.message || error}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [order, actionDeps, onUpdate])

  const handleCancel = useCallback(async () => {
    if (!confirm('この依頼をキャンセルしますか？データベースからも削除されます。')) return

    setLoading(true)
    try {
      await cancelOrderMutation.mutateAsync(order.id)
      if (import.meta.env.DEV) {
        console.log('Order deleted successfully:', order.id)
      }
      onDelete?.(order.id)
      onClose?.()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error cancelling order:', error)
      }
      showToast(`キャンセルに失敗しました: ${error.message || error}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [order.id, cancelOrderMutation, onDelete, onClose])

  const advanceStatus = getAdvanceStatus(order.status)
  const handleAdvanceStatus = useCallback(async () => {
    if (!advanceStatus) return
    setLoading(true)
    try {
      const updatedOrder = await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { status: advanceStatus },
      })
      onUpdate?.(updatedOrder)
    } catch (error) {
      console.error('Error updating status:', error)
      showToast('ステータス更新に失敗しました', 'error')
    } finally {
      setLoading(false)
    }
  }, [advanceStatus, order.id, updateOrderMutation, onUpdate])

  return {
    // 派生値
    relatedVehicle,
    statusLabel: getStatusLabel(order.status),
    statusColor: getStatusColor(order.status),
    advanceStatus,

    // state
    editing,
    formData,
    loading,
    recalculating,
    waitingLocationDuration,
    calculatingWaitingDuration,

    // setters
    setEditing,
    setFormData,

    // handlers
    handleChange,
    handleSave,
    handleRecalculateRoute,
    handleConfirm,
    handleRevertStatus,
    handleCancel,
    handleAdvanceStatus,
  }
}
