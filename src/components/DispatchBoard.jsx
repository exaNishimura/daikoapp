import { useState, useEffect, useMemo, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimelineGrid } from './TimelineGrid'
import { OrderDetailPanel } from './OrderDetailPanel'
import { OrderFormModal } from './OrderFormModal'
import { VehicleOperationStatusModal } from './VehicleOperationStatusModal'
import { DispatchHeader } from './DispatchBoard/DispatchHeader'
import { VehicleSelectDialog } from './DispatchBoard/VehicleSelectDialog'
import { getOrders, getOrderById } from '@/services/orderService'
import { getVehicles } from '@/services/vehicleService'
import { createSlot, updateSlot, getSlotsByVehicleAndDate } from '@/services/slotService'
import {
  getVehicleOperationStatuses,
  syncOperationStatusFromShifts,
} from '@/services/vehicleOperationService'
import { getShiftsByDate } from '@/services/shiftService'
import { calculateBuffer } from '@/services/routeService'
import { supabase } from '@/lib/supabase'
import { exceedsBusinessHours, formatBusinessDay } from '@/utils/timeUtils'
import { getBusinessDayBoundaries } from '@/utils/businessDayUtils'
import { getEarliestAvailableTimeWithSlots } from '@/utils/earliestTimeUtils'
import {
  pixelsToRowIndex,
  rowIndexToDate,
  snapToRowIndex,
  dateToRowIndex,
  rowIndexToPixels,
} from '@/utils/rowUtils'
import { isVehicleOperational } from '@/utils/operationStatusUtils'
import { findAutoPlacementSlot } from '@/lib/orderPlacement'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'

export function DispatchBoard() {
  const [orders, setOrders] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [slots, setSlots] = useState([])
  const [operationStatuses, setOperationStatuses] = useState({}) // vehicleIdをキーとした稼働状況マップ
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOperationStatusModalOpen, setIsOperationStatusModalOpen] = useState(false)
  const [isVehicleSelectDialogOpen, setIsVehicleSelectDialogOpen] = useState(false)
  const [selectedVehicleForStatus, setSelectedVehicleForStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dragOverPosition, setDragOverPosition] = useState(null) // { vehicleId, top }
  const [mousePosition, setMousePosition] = useState(null) // { x, y }
  const [draggingSlotVehicleId, setDraggingSlotVehicleId] = useState(null) // ドラッグ中のslotのvehicleId

  // ドラッグ&ドロップ用のsensors設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動したらドラッグ開始
      },
    })
  )

  // 営業日（今日の日付）
  const businessDate = new Date()
  const businessDayText = formatBusinessDay(businessDate)

  const earliestAvailableTime = useMemo(() => {
    return getEarliestAvailableTimeWithSlots(vehicles, slots, 30, operationStatuses)
  }, [vehicles, slots, operationStatuses])

  // 稼働状況データを取得
  const loadOperationStatuses = useCallback(async (vehiclesList) => {
    if (!vehiclesList || vehiclesList.length === 0) {
      setOperationStatuses({})
      return
    }

    try {
      const vehicleIds = vehiclesList.map((v) => v.id)
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const { data, error } = await getVehicleOperationStatuses(vehicleIds, todayStr)

      if (error) {
        console.error('Error loading operation statuses:', error)
        setOperationStatuses({})
      } else {
        setOperationStatuses(data || {})
      }
    } catch (error) {
      console.error('Error loading operation statuses:', error)
      setOperationStatuses({})
    }
  }, [])

  // loadSlotsとloadDataを先に定義（useEffectで使用するため）
  const loadSlots = useCallback(async (vehiclesList) => {
    // 営業日の開始（18:00）と終了（翌 06:00）を取得
    // 06:00 未満は前日の営業日として扱われる
    const { start, end } = getBusinessDayBoundaries(new Date())

    const allSlots = []
    for (const vehicle of vehiclesList) {
      try {
        const { data, error } = await getSlotsByVehicleAndDate(vehicle.id, start, end)
        if (error) continue
        if (data) allSlots.push(...data)
      } catch {
        continue
      }
    }

    setSlots(allSlots)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordersResult, vehiclesResult] = await Promise.all([getOrders(), getVehicles()])

      if (ordersResult.error) {
        console.error('Error loading orders:', ordersResult.error)
        setError(`依頼データの読み込みに失敗: ${ordersResult.error.message || ordersResult.error}`)
        setOrders([])
      } else {
        setOrders(ordersResult.data || [])
      }

      if (vehiclesResult.error) {
        console.error('Error loading vehicles:', vehiclesResult.error)
        setError(
          `車両データの読み込みに失敗: ${vehiclesResult.error.message || vehiclesResult.error}`
        )
        setVehicles([])
      } else {
        setVehicles(vehiclesResult.data || [])
        // 車両が読み込まれたらスロットと稼働状況も取得
        if (vehiclesResult.data && vehiclesResult.data.length > 0) {
          loadSlots(vehiclesResult.data)

          // シフトから稼働状況を自動生成
          const today = new Date()
          const todayStr = today.toISOString().split('T')[0]

          getShiftsByDate(todayStr).then(({ data: shiftsByCar, error: shiftsError }) => {
            if (!shiftsError && shiftsByCar) {
              syncOperationStatusFromShifts(vehiclesResult.data, todayStr, shiftsByCar).then(() => {
                // 稼働状況を再読み込み
                loadOperationStatuses(vehiclesResult.data)
              })
            } else {
              // シフトデータがない場合は通常の読み込み
              loadOperationStatuses(vehiclesResult.data)
            }
          })
        } else {
          setSlots([])
          setOperationStatuses({})
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError(`データの読み込みに失敗: ${error.message}`)
      setOrders([])
      setVehicles([])
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [loadSlots])

  // 初期データ取得
  useEffect(() => {
    loadData()
  }, [loadData])

  // Supabase Realtimeで変更を監視
  useEffect(() => {
    if (!supabase) return

    // ordersテーブルの変更を監視
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE すべて
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          // データを再読み込み
          loadData()
        }
      )
      .subscribe()

    // dispatch_slotsテーブルの変更を監視
    const slotsChannel = supabase
      .channel('slots-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE すべて
          schema: 'public',
          table: 'dispatch_slots',
        },
        (payload) => {
          // スロットを再読み込み（車両データが必要）
          if (vehicles.length > 0) {
            loadSlots(vehicles)
          }
        }
      )
      .subscribe()

    // vehicle_operation_statusテーブルの変更を監視
    const operationStatusChannel = supabase
      .channel('operation-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE すべて
          schema: 'public',
          table: 'vehicle_operation_status',
        },
        (payload) => {
          // 稼働状況を再読み込み（車両データが必要）
          if (vehicles.length > 0) {
            loadOperationStatuses(vehicles)
          }
        }
      )
      .subscribe()

    // shiftsテーブルの変更を監視（シフト変更時に稼働状況を自動更新）
    const shiftsChannel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE すべて
          schema: 'public',
          table: 'shifts',
        },
        async (payload) => {
          // シフト変更時に稼働状況を自動更新
          if (vehicles.length > 0) {
            try {
              // 今日の日付を取得
              const today = new Date()
              const todayStr = today.toISOString().split('T')[0]

              // 変更されたシフトの日付を取得
              const shiftDate = payload.new?.date || payload.old?.date || todayStr

              // その日のシフトデータを取得
              const { data: shiftsByCar, error: shiftsError } = await getShiftsByDate(shiftDate)

              if (shiftsError) {
                if (import.meta.env.DEV) {
                  console.error('Error fetching shifts for sync:', shiftsError)
                }
                return
              }

              // シフトから稼働状況を自動生成
              const { error: syncError } = await syncOperationStatusFromShifts(
                vehicles,
                shiftDate,
                shiftsByCar || {}
              )

              if (syncError) {
                if (import.meta.env.DEV) {
                  console.error('Error syncing operation status from shifts:', syncError)
                }
              } else {
                // 稼働状況を再読み込み
                await loadOperationStatuses(vehicles)
              }
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error('Error handling shift change:', error)
              }
            }
          }
        }
      )
      .subscribe()

    // クリーンアップ
    return () => {
      ordersChannel.unsubscribe()
      slotsChannel.unsubscribe()
      operationStatusChannel.unsubscribe()
      shiftsChannel.unsubscribe()
    }
  }, [vehicles, loadData, loadSlots, loadOperationStatuses])

  // マウス/タッチ位置を追跡し、ドラッグ中のハイライト位置をリアルタイム更新
  useEffect(() => {
    const updatePosition = (clientX, clientY) => {
      setMousePosition({ x: clientX, y: clientY })

      // ドラッグ中の場合、ハイライト位置をリアルタイム更新
      if (dragOverPosition !== null) {
        const timelineBody = document.querySelector('.timeline-content-wrapper')
        if (timelineBody) {
          const timelineRect = timelineBody.getBoundingClientRect()
          const scrollTop = timelineBody.scrollTop
          const mouseY = clientY - timelineRect.top + scrollTop

          // 現在のvehicleIdを確認
          const vehicleElement = document.querySelector(
            `[data-vehicle-id="${dragOverPosition.vehicleId}"]`
          )
          if (vehicleElement) {
            setDragOverPosition({
              vehicleId: dragOverPosition.vehicleId,
              top: mouseY,
            })
          }
        }
      }
    }

    const handleMouseMove = (e) => {
      updatePosition(e.clientX, e.clientY)
    }

    const handleTouchMove = (e) => {
      // タッチイベントのデフォルト動作を防ぐ（スクロールを許可）
      if (dragOverPosition === null) return

      e.preventDefault() // ドラッグ中のみスクロールを防ぐ
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

  const handleOrderCreated = async (newOrder) => {
    setOrders((prev) => [newOrder, ...prev])
    setIsModalOpen(false)

    // すべての依頼を即座にタイムラインに自動配置
    if (vehicles.length > 0) {
      try {
        // 最新の依頼データを取得（base_duration_minとbuffer_minが正しく設定されているか確認）
        const { data: latestOrder, error: orderError } = await getOrderById(newOrder.id)
        if (orderError) {
          console.error('Error fetching latest order for auto-placement:', orderError)
          alert('依頼データの取得に失敗しました')
          return
        }

        const { availableSlot, totalDuration } = findAutoPlacementSlot({
          order: latestOrder ?? newOrder,
          vehicles,
          slots,
          operationStatuses,
        })

        if (availableSlot) {
          // スロットを作成
          const endAt = new Date(availableSlot.startAt)
          endAt.setMinutes(endAt.getMinutes() + totalDuration)

          const { data: slot, error } = await createSlot({
            order_id: newOrder.id,
            vehicle_id: availableSlot.vehicleId,
            start_at: availableSlot.startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: 'TENTATIVE',
          })

          if (error) {
            if (import.meta.env.DEV) {
              console.error('Error auto-placing order:', error)
            }
            alert('自動配置に失敗しました')
          } else if (slot) {
            // スロットを即座に追加（タイムラインにすぐ表示）
            setSlots((prev) => {
              // 既に同じIDのスロットが存在する場合は更新、存在しない場合は追加
              const existingIndex = prev.findIndex((s) => s.id === slot.id)
              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = slot
                return updated
              }
              return [...prev, slot]
            })

            // 依頼を更新（base_duration_min / buffer_min 反映済みの最新版で）
            // ※以前は 1 秒後に loadSlots で再フェッチしていたが、
            //  createSlot の戻り値で十分なため二重描画を避けるべく削除した。
            //  他端末との整合性は Realtime 購読で別途解決する。
            if (latestOrder) {
              handleOrderUpdate(latestOrder)
            }
          }
        } else {
          alert('配置可能な時間が見つかりませんでした。')
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error in auto-placement:', error)
        }
        alert('自動配置中にエラーが発生しました')
      }
    }
  }

  const handleOrderSelect = (order) => {
    setSelectedOrder(order)
  }

  const handleOrderUpdate = async (updatedOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder)
      // キャンセルされた場合はパネルを閉じる
      if (updatedOrder.status === 'CANCELLED') {
        setSelectedOrder(null)
      }
    }
    // キャンセルまたはスロット関連の変更があった場合はスロットを再読み込み
    if (
      updatedOrder.status === 'CANCELLED' ||
      updatedOrder.status === 'TENTATIVE' ||
      updatedOrder.status === 'CONFIRMED'
    ) {
      if (vehicles.length > 0) {
        await loadSlots(vehicles)
      }
    }
  }

  const handleOrderDelete = async (orderId) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(null)
    }
    // スロットも再読み込み（削除された依頼に関連するスロットが削除されている可能性があるため）
    if (vehicles.length > 0) {
      await loadSlots(vehicles)
      await loadOperationStatuses(vehicles)
    }
  }

  // マウス/タッチ位置からタイムライン内のY座標を計算する関数
  const calculateTimelineY = (clientY) => {
    const timelineBody = document.querySelector('.timeline-content-wrapper')
    if (!timelineBody) return null

    const timelineRect = timelineBody.getBoundingClientRect()
    const scrollTop = timelineBody.scrollTop
    return clientY - timelineRect.top + scrollTop
  }

  // イベントからclientYを取得する関数（マウス/タッチ両対応）
  const getClientYFromEvent = (event) => {
    if (!event) return null

    // タッチイベントの場合
    if (event.touches && event.touches.length > 0) {
      return event.touches[0].clientY
    }

    // マウスイベントの場合
    if (event.clientY !== undefined) {
      return event.clientY
    }

    return null
  }

  const handleDragStart = (event) => {
    // ドラッグ開始時にマウス位置をリセット（すぐに更新される）
    setMousePosition(null)

    // SlotComponentをドラッグしている場合、元のvehicleIdを記録
    if (event.active.data.current?.type === 'slot' && event.active.data.current?.slot) {
      setDraggingSlotVehicleId(event.active.data.current.slot.vehicle_id)
    } else {
      setDraggingSlotVehicleId(null)
    }
  }

  const handleDragCancel = () => {
    // ドラッグキャンセル時にクリア
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

    // マウス/タッチ位置を直接取得（優先順位: activatorEvent > mousePosition）
    let clientY = null

    // event.activatorEventから直接位置を取得（リアルタイム更新のため優先）
    if (event.activatorEvent) {
      clientY = getClientYFromEvent(event.activatorEvent)
    }

    // フォールバック: mousePositionを使用
    if (clientY === null && mousePosition) {
      clientY = mousePosition.y
    }

    // さらにフォールバック: delta.yを使用する場合、元の位置を計算
    if (clientY === null) {
      if (active.data.current?.type === 'slot' && active.data.current?.slot) {
        const slot = active.data.current.slot
        const startDate = new Date(slot.start_at)
        const startRowIndex = dateToRowIndex(startDate)
        const originalTop = rowIndexToPixels(startRowIndex)

        if (event.delta?.y !== undefined) {
          const mouseY = originalTop + event.delta.y
          setDragOverPosition({
            vehicleId: over.data.current.vehicleId,
            top: mouseY,
          })
          return
        }
      }

      setDragOverPosition(null)
      return
    }

    // タイムライン内のY座標を計算
    const mouseY = calculateTimelineY(clientY)
    if (mouseY === null) {
      setDragOverPosition(null)
      return
    }

    // スナップせずに実際の位置を使用（負の値も許可）
    setDragOverPosition({
      vehicleId: over.data.current.vehicleId,
      top: mouseY,
    })
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over) {
      setDragOverPosition(null)
      setMousePosition(null)
      setDraggingSlotVehicleId(null)
      return
    }

    // ドラッグ終了時にハイライトとマウス位置を保存（クリア前に）
    const currentDragOverPosition = dragOverPosition
    const currentMousePosition = mousePosition
    setDragOverPosition(null)
    setMousePosition(null)
    setDraggingSlotVehicleId(null)

    // ドロップ位置から時刻を計算する関数
    const calculateTimeFromDropPosition = (targetVehicleId) => {
      // マウス/タッチ位置を取得（優先順位: currentMousePosition > currentDragOverPosition > activatorEvent）
      let dropY = null

      if (currentMousePosition) {
        // マウス位置からタイムライン内のY座標を計算
        dropY = calculateTimelineY(currentMousePosition.y)
      } else if (currentDragOverPosition && currentDragOverPosition.vehicleId === targetVehicleId) {
        // dragOverPositionから計算（タイムライン内のY座標を直接使用）
        dropY = currentDragOverPosition.top
      } else if (event.activatorEvent) {
        // activatorEventから計算（マウス/タッチ両対応）
        const clientY = getClientYFromEvent(event.activatorEvent)
        if (clientY !== null) {
          dropY = calculateTimelineY(clientY)
        }
      }

      if (dropY === null) return null

      // Y座標を行番号に変換（15分 = 20px = 1行）
      const rowIndex = pixelsToRowIndex(dropY)

      // 15分刻みでスナップ（ドロップ時のみ）
      const snappedRowIndex = snapToRowIndex(rowIndex)

      // 営業日の基準日を計算
      const now = new Date()
      const localHours = now.getHours()
      let businessDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (localHours < 6) {
        // 06:00未満の場合は前日の営業日として扱う
        businessDay.setDate(businessDay.getDate() - 1)
      }

      // 行番号からDateオブジェクトに変換
      return rowIndexToDate(snappedRowIndex, businessDay)
    }

    // Slotの移動
    if (active.data.current?.type === 'slot' && over.data.current?.vehicleId) {
      const slot = active.data.current.slot
      const order = active.data.current.order
      const newVehicleId = over.data.current.vehicleId

      if (!slot || !order) {
        console.error('Slot or order data not found')
        return
      }

      // 最新の依頼データを取得（base_duration_minとbuffer_minが正しく設定されているか確認）
      const { data: latestOrder, error: orderError } = await getOrderById(order.id)
      if (orderError) {
        console.error('Error fetching latest order:', orderError)
        alert('依頼データの取得に失敗しました')
        return
      }

      // ドロップ位置から時刻を計算
      const newStartAt = calculateTimeFromDropPosition(newVehicleId)

      // 依頼の最新の所要時間を使用（既存のslotの長さではなく）
      const baseDuration = latestOrder?.base_duration_min || 30
      const buffer = latestOrder?.buffer_min || calculateBuffer(baseDuration)
      const totalDuration = baseDuration + buffer

      // 新しい開始時刻を設定（ドロップ位置から計算、または既存の時刻を維持）
      const startAt = newStartAt || new Date(slot.start_at)
      const endAt = new Date(startAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      // 稼働状況チェック
      const statuses = operationStatuses[newVehicleId] || []
      if (!isVehicleOperational(newVehicleId, startAt, statuses)) {
        alert('この時間帯は車両が稼働していないため配置できません。')
        return
      }

      // 06:00超過チェック
      if (exceedsBusinessHours(endAt)) {
        alert('06:00を超えるため配置できません。開始時刻を前にずらしてください。')
        return
      }

      // 確定済みslotの移動時は確定解除
      const updateData = {
        vehicle_id: newVehicleId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      }

      if (slot.status === 'CONFIRMED') {
        updateData.status = 'TENTATIVE'
      }

      const { data: updatedSlot, error } = await updateSlot(slot.id, updateData)
      if (error) {
        console.error('Error updating slot:', error)
        return
      }

      // スロットを即座に更新（タイムラインにすぐ反映）
      // updateSlot の戻り値で十分なので 500ms 後の再フェッチは廃止
      if (updatedSlot) {
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? updatedSlot : s)))
      }
    }

    // 未割当依頼のドラッグ&ドロップ
    if (active.data.current?.type === 'order' && over.data.current?.vehicleId) {
      const order = active.data.current.order
      const targetVehicleId = over.data.current.vehicleId

      if (!order) {
        console.error('Order data not found')
        return
      }

      // ドロップ位置から時刻を計算
      const newStartAt = calculateTimeFromDropPosition(targetVehicleId)

      if (!newStartAt) {
        alert('ドロップ位置から時刻を計算できませんでした')
        return
      }

      // 稼働状況チェック
      const statuses = operationStatuses[targetVehicleId] || []
      if (!isVehicleOperational(targetVehicleId, newStartAt, statuses)) {
        alert('この時間帯は車両が稼働していないため配置できません。')
        return
      }

      // 依頼の所要時間を計算
      const baseDuration = order.base_duration_min || 30
      const buffer = order.buffer_min || calculateBuffer(baseDuration)
      const totalDuration = baseDuration + buffer

      const endAt = new Date(newStartAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      // 06:00超過チェック
      if (exceedsBusinessHours(endAt)) {
        alert('06:00を超えるため配置できません。開始時刻を前にずらしてください。')
        return
      }

      // スロットを作成
      const { data: newSlot, error: slotError } = await createSlot({
        order_id: order.id,
        vehicle_id: targetVehicleId,
        start_at: newStartAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'TENTATIVE',
      })

      if (slotError) {
        console.error('Error creating slot:', slotError)
        alert('スロットの作成に失敗しました')
        return
      }

      // スロットを即座に追加（createSlot の戻り値で十分なため再フェッチは廃止）
      if (newSlot) {
        setSlots((prev) => [...prev, newSlot])
      }

      // 依頼のステータスを更新
      const { data: updatedOrder, error: orderUpdateError } = await getOrderById(order.id)
      if (!orderUpdateError && updatedOrder) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)))
      }
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          読み込み中...
        </Typography>
      </Box>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <DispatchHeader
          businessDayText={businessDayText}
          earliestAvailableTime={earliestAvailableTime}
          vehicles={vehicles}
          onOpenSettings={() => {
            if (vehicles.length === 0) return
            if (vehicles.length === 1) {
              setSelectedVehicleForStatus(vehicles[0])
              setIsOperationStatusModalOpen(true)
            } else {
              setIsVehicleSelectDialogOpen(true)
            }
          }}
          onOpenOrderForm={() => setIsModalOpen(true)}
        />

        {/* エラーメッセージ */}
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={loadData}>
                再読み込み
              </Button>
            }
            sx={{ borderRadius: 0, mt: '64px' }}
          >
            {error}
          </Alert>
        )}

        {/* メインコンテンツ */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', mt: '70px' }}>
          {/* タイムライン */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: 'background.default',
            }}
          >
            {vehicles.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 1,
                }}
              >
                <Typography variant="h6" color="text.secondary">
                  車両データがありません
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supabaseに車両データを追加してください
                </Typography>
              </Box>
            ) : (
              <TimelineGrid
                vehicles={vehicles}
                orders={orders}
                slots={slots}
                operationStatuses={operationStatuses}
                dragOverPosition={dragOverPosition}
                draggingSlotVehicleId={draggingSlotVehicleId}
                onOrderSelect={handleOrderSelect}
                onOrderUpdate={handleOrderUpdate}
                onSlotsUpdate={loadSlots}
              />
            )}
          </Box>

          {/* 右サイドバー: 依頼詳細 */}
          {selectedOrder && (
            <Drawer
              anchor="right"
              open={!!selectedOrder}
              variant="persistent"
              sx={{
                width: 384,
                flexShrink: 0,
                zIndex: (theme) => theme.zIndex.drawer + 10,
                '& .MuiDrawer-paper': {
                  width: 384,
                  boxSizing: 'border-box',
                  borderLeft: 1,
                  borderColor: 'divider',
                  zIndex: (theme) => theme.zIndex.drawer + 10,
                },
              }}
            >
              <OrderDetailPanel
                order={selectedOrder}
                onUpdate={handleOrderUpdate}
                onDelete={handleOrderDelete}
                onClose={() => setSelectedOrder(null)}
                vehicles={vehicles}
                slots={slots}
              />
            </Drawer>
          )}
        </Box>

        {/* モーダル */}
        <OrderFormModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onOrderCreated={handleOrderCreated}
        />
        <VehicleSelectDialog
          open={isVehicleSelectDialogOpen}
          vehicles={vehicles}
          onClose={() => setIsVehicleSelectDialogOpen(false)}
          onSelect={(vehicle) => {
            setSelectedVehicleForStatus(vehicle)
            setIsVehicleSelectDialogOpen(false)
            setIsOperationStatusModalOpen(true)
          }}
        />
        <VehicleOperationStatusModal
          open={isOperationStatusModalOpen}
          onClose={() => {
            setIsOperationStatusModalOpen(false)
            setSelectedVehicleForStatus(null)
          }}
          onStatusUpdated={() => {
            // 稼働状況が更新されたら再読み込み
            if (vehicles.length > 0) {
              loadOperationStatuses(vehicles)
            }
          }}
          vehicleId={selectedVehicleForStatus?.id}
          vehicleName={selectedVehicleForStatus?.name}
        />
      </Box>
    </DndContext>
  )
}
