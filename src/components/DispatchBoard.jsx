import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimelineGrid } from './TimelineGrid'
import { OrderDetailPanel } from './OrderDetailPanel'
import { OrderFormModal } from './OrderFormModal'
import { OrderCardList } from './OrderCardList'
import { VehicleOperationStatusModal } from './VehicleOperationStatusModal'
import { DispatchHeader } from './DispatchBoard/DispatchHeader'
import { DispatchNightReservations } from './DispatchBoard/DispatchNightReservations'
import { DispatchStatusLegend } from './DispatchBoard/DispatchStatusLegend'
import { VehicleSelectDialog } from './DispatchBoard/VehicleSelectDialog'
import { useDispatchData } from '@/hooks/useDispatchData'
import { useDispatchNight } from '@/hooks/useDispatchNight'
import { useDispatchDnD } from '@/hooks/useDispatchDnD'
import { useReservations } from '@/hooks/useReservations'
import { useToast } from '@/contexts/ToastContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { getOrderById } from '@/services/orderService'
import { createSlot, getSlotsByOrderId, getSlotsInRange } from '@/services/slotService'
import { placeReservationOnTimeline } from '@/lib/reservation/placeReservation'
import { isReservationLinked } from '@/lib/reservation/reservationLink'
import { getVehicleOperationStatuses } from '@/services/vehicleOperationService'
import { computeDesiredStartTime, findAutoPlacementSlot } from '@/lib/orderPlacement'
import { detectAllConflicts } from '@/lib/slotConflictUtils'
import { filterOrdersForDispatchNight } from '@/lib/dispatch/filterOrdersForDispatchNight'
import {
  filterReservationsInReceptionNight,
  getTonightListFilters,
} from '@/lib/reservation/tonightReservations'
import { getBusinessDayKey, getNightRangeFromWorkDateKey, parseWorkDateKey } from '@/utils/businessDayUtils'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog } from '@astryxdesign/core/Dialog'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import './DispatchBoard.css'

export function DispatchBoard() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const {
    nightDate,
    isCurrentNight,
    setNightDate,
    goPrev,
    goNext,
    goToday,
  } = useDispatchNight()

  const {
    orders,
    vehicles,
    slots,
    slotsNight,
    operationStatuses,
    loading,
    error,
    setOrders,
    setSlots,
    loadData,
    loadSlots,
    syncNightOperations,
    earliestAvailableTime,
    businessDayText,
  } = useDispatchData(nightDate)

  const nightOrders = useMemo(
    () => filterOrdersForDispatchNight(orders, nightDate, { isCurrentNight }),
    [orders, nightDate, isCurrentNight]
  )
  const reservationFilters = useMemo(() => getTonightListFilters(nightDate), [nightDate])
  const reservationsQuery = useReservations(reservationFilters, { enabled: Boolean(nightDate) })
  const nightReservations = useMemo(
    () => filterReservationsInReceptionNight(reservationsQuery.data, nightDate),
    [reservationsQuery.data, nightDate]
  )
  const unplacedReservations = useMemo(
    () => nightReservations.filter((row) => !isReservationLinked(row, orders)),
    [nightReservations, orders]
  )
  const businessDay = useMemo(() => parseWorkDateKey(nightDate) || new Date(), [nightDate])
  const nightReferenceTime = useMemo(() => {
    if (isCurrentNight) return null
    const date = parseWorkDateKey(nightDate)
    if (!date) return null
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 0, 0, 0)
  }, [isCurrentNight, nightDate])

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (!selectedOrder?.id) return
    const latest = orders.find((row) => row.id === selectedOrder.id)
    if (!latest) return
    if (
      latest.scheduled_at !== selectedOrder.scheduled_at ||
      latest.status !== selectedOrder.status
    ) {
      setSelectedOrder(latest)
    }
  }, [orders, selectedOrder])
  const [isOperationStatusModalOpen, setIsOperationStatusModalOpen] = useState(false)
  const [isVehicleSelectDialogOpen, setIsVehicleSelectDialogOpen] = useState(false)
  const [selectedVehicleForStatus, setSelectedVehicleForStatus] = useState(null)

  const pendingCount = useMemo(
    () =>
      nightOrders.filter((o) => o.status === 'UNASSIGNED' || o.status === 'TENTATIVE').length +
      unplacedReservations.length,
    [nightOrders, unplacedReservations]
  )

  const conflictCount = useMemo(() => detectAllConflicts(slots).conflictIds.size, [slots])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleReservationDrop = async (reservation, vehicleId, startAt) => {
    try {
      const result = await placeReservationOnTimeline({
        reservation,
        vehicles,
        slots,
        operationStatuses,
        startAt,
        vehicleId,
        existingOrders: orders,
      })
      if (result.error) throw result.error
      if (result.order) {
        setOrders((prev) => {
          if (prev.some((row) => row.id === result.order.id)) {
            return prev.map((row) => (row.id === result.order.id ? result.order : row))
          }
          return [result.order, ...prev]
        })
      }
      if (result.slot) {
        setSlots((prev) =>
          prev.some((row) => row.id === result.slot.id) ? prev : [...prev, result.slot]
        )
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
      return Boolean(result.slot)
    } catch (error) {
      showToast(error?.message || '予約の配置に失敗しました', 'error')
      return false
    }
  }

  const {
    dragOverPosition,
    draggingSlotVehicleId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDispatchDnD({
    vehicles,
    slots,
    orders: nightOrders,
    operationStatuses,
    setSlots,
    setOrders,
    businessDay,
    onReservationDrop: handleReservationDrop,
  })

  const autoPlaceAttemptedRef = useRef(new Set())

  const autoPlaceOrder = async (order, { silent = false } = {}) => {
    if (vehicles.length === 0) return false
    try {
      const { data: existingSlots } = await getSlotsByOrderId(order.id)
      if (existingSlots?.length) {
        const slotNight = getBusinessDayKey(existingSlots[0].start_at)
        if (slotNight && slotNight !== nightDate) {
          setNightDate(slotNight)
          return true
        }
        setSlots((prev) => {
          const next = [...prev]
          for (const slot of existingSlots) {
            if (!next.some((row) => row.id === slot.id)) next.push(slot)
          }
          return next
        })
        return true
      }

      const { data: latestOrder, error: orderError } = await getOrderById(order.id)
      if (orderError) {
        if (!silent) {
          console.error('Error fetching latest order for auto-placement:', orderError)
          showToast('依頼データの取得に失敗しました。未確定一覧から手動配置してください。', 'error')
        }
        return false
      }

      const placementOrder = latestOrder ?? order
      const targetNight = getBusinessDayKey(computeDesiredStartTime(placementOrder))
      if (!targetNight) return false

      const { start, end } = getNightRangeFromWorkDateKey(targetNight)
      const [{ data: nightSlots }, opsResult] = await Promise.all([
        getSlotsInRange(start, end),
        getVehicleOperationStatuses(
          vehicles.map((vehicle) => vehicle.id),
          targetNight
        ),
      ])

      const { availableSlot, totalDuration } = findAutoPlacementSlot({
        order: placementOrder,
        vehicles,
        slots: nightSlots || [],
        operationStatuses: opsResult.data || {},
      })

      if (!availableSlot) {
        if (!silent) {
          const scheduled = (latestOrder ?? order).order_type === 'SCHEDULED'
          showToast(
            scheduled
              ? '指定時刻に空きがありません。別の時刻を選んでください。'
              : '配置可能な時間が見つかりませんでした。未確定一覧から手動で配置してください。',
            'warning'
          )
        }
        return false
      }

      const endAt = new Date(availableSlot.startAt)
      endAt.setMinutes(endAt.getMinutes() + totalDuration)

      const { data: slot, error } = await createSlot({
        order_id: order.id,
        vehicle_id: availableSlot.vehicleId,
        start_at: availableSlot.startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'TENTATIVE',
      })

      if (error) {
        if (import.meta.env.DEV) {
          console.error('Error auto-placing order:', error)
        }
        if (!silent) {
          showToast('自動配置に失敗しました。未確定一覧から手動配置してください。', 'error')
        }
        return false
      }
      if (!slot) return false

      if (targetNight === nightDate) {
        setSlots((prev) => {
          const existingIndex = prev.findIndex((row) => row.id === slot.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = slot
            return updated
          }
          return [...prev, slot]
        })
      } else {
        setNightDate(targetNight)
      }
      if (latestOrder) {
        setOrders((prev) =>
          prev.map((row) =>
            row.id === latestOrder.id ? { ...latestOrder, status: 'TENTATIVE' } : row
          )
        )
      }
      if (!silent) {
        const scheduled = (latestOrder ?? order).order_type === 'SCHEDULED'
        showToast(
          scheduled ? '指定時刻に仮配置しました' : '依頼をタイムラインに仮配置しました',
          'success'
        )
      }
      return true
    } catch (autoPlaceError) {
      if (import.meta.env.DEV) {
        console.error('Error in auto-placement:', autoPlaceError)
      }
      if (!silent) {
        showToast('自動配置中にエラーが発生しました。未確定一覧を確認してください。', 'error')
      }
      return false
    }
  }

  const autoPlaceOrderRef = useRef(autoPlaceOrder)
  useEffect(() => {
    autoPlaceOrderRef.current = autoPlaceOrder
  })

  useEffect(() => {
    if (!isCurrentNight) return
    if (loading || vehicles.length === 0) return
    const slotted = new Set(slots.map((slot) => slot.order_id))
    for (const order of orders) {
      if (slotted.has(order.id)) continue
      if (autoPlaceAttemptedRef.current.has(order.id)) continue
      if (order.status !== 'UNASSIGNED' && order.status !== 'CONFIRMED') continue
      if (typeof order.parking_note !== 'string' || !order.parking_note.includes('[LINE]')) continue
      autoPlaceAttemptedRef.current.add(order.id)
      void autoPlaceOrderRef.current(order, { silent: true })
    }
  }, [isCurrentNight, loading, vehicles.length, orders, slots])

  const reservationPlaceAttemptedRef = useRef(new Set())
  useEffect(() => {
    if (loading || vehicles.length === 0) return
    if (slotsNight !== nightDate) return
    const pending = unplacedReservations.filter(
      (row) => !reservationPlaceAttemptedRef.current.has(row.id)
    )
    if (pending.length === 0) return

    let cancelled = false
    const run = async () => {
      let workingSlots = slots
      for (const reservation of pending) {
        if (cancelled) return
        reservationPlaceAttemptedRef.current.add(reservation.id)
        try {
          const result = await placeReservationOnTimeline({
            reservation,
            vehicles,
            slots: workingSlots,
            operationStatuses,
            existingOrders: orders,
          })
          if (result.skipped || result.error) continue
          if (result.order) {
            setOrders((prev) => {
              if (prev.some((row) => row.id === result.order.id)) return prev
              return [result.order, ...prev]
            })
          }
          if (result.slot) {
            workingSlots = [...workingSlots, result.slot]
            setSlots((prev) =>
              prev.some((row) => row.id === result.slot.id) ? prev : [...prev, result.slot]
            )
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('Reservation auto-place failed:', error)
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    loading,
    vehicles,
    slotsNight,
    nightDate,
    unplacedReservations,
    slots,
    orders,
    operationStatuses,
    queryClient,
    setOrders,
    setSlots,
  ])

  const handleOrderCreated = async (newOrder) => {
    setOrders((prev) => [newOrder, ...prev])
    setIsModalOpen(false)
    await autoPlaceOrder(newOrder)
  }

  const handleReservationSaved = (reservation) => {
    setIsModalOpen(false)
    if (!reservation?.order_id) {
      showToast('翌日以降の依頼を予約台帳に保存しました', 'success')
    }
    const key = getBusinessDayKey(reservation?.reserved_at)
    if (key) setNightDate(key)
  }

  const handleOrderSelect = (order) => {
    setSelectedOrder(order)
  }

  const handleOrderUpdate = async (updatedOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder)
      if (updatedOrder.status === 'CANCELLED') {
        setSelectedOrder(null)
      }
    }
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
    if (vehicles.length > 0) {
      await loadSlots(vehicles)
      await syncNightOperations(vehicles)
    }
  }

  if (loading) {
    return (
      <div className="dispatch-root dispatch-loading">
        <Center height="100%">
          <VStack gap={2} hAlign="center">
            <Spinner size="lg" label="読み込み中" />
            <Text color="secondary">読み込み中…</Text>
          </VStack>
        </Center>
      </div>
    )
  }

  const detailPanel = selectedOrder ? (
    <OrderDetailPanel
      order={selectedOrder}
      onUpdate={handleOrderUpdate}
      onDelete={handleOrderDelete}
      onClose={() => setSelectedOrder(null)}
      vehicles={vehicles}
      slots={slots}
    />
  ) : null

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="dispatch-root">
          <DispatchHeader
            businessDayText={businessDayText}
            earliestAvailableTime={earliestAvailableTime}
            isCurrentNight={isCurrentNight}
            vehicles={vehicles}
            conflictCount={conflictCount}
            onPrevNight={goPrev}
            onNextNight={goNext}
            onToday={goToday}
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

          {vehicles.length > 0 ? <DispatchStatusLegend /> : null}

          {error ? (
            <Banner
              status="error"
              title={error}
              collapsible={false}
              endContent={
                <Button label="再読み込み" variant="secondary" size="sm" onClick={loadData} />
              }
            />
          ) : null}

          <div className="dispatch-body">
            {!isMobile && vehicles.length > 0 ? (
              <aside className="dispatch-sidebar">
                <DispatchNightReservations
                  reservations={unplacedReservations}
                  nightDate={nightDate}
                />
                <OrderCardList
                  orders={nightOrders}
                  onOrderSelect={handleOrderSelect}
                  selectedOrderId={selectedOrder?.id}
                  defaultExpanded
                  fillHeight
                />
              </aside>
            ) : null}

            <main className="dispatch-main">
              {vehicles.length === 0 ? (
                <div className="dispatch-empty">
                  <Text weight="semibold" color="secondary">
                    車両データがありません
                  </Text>
                  <Text color="secondary">Supabaseに車両データを追加してください</Text>
                </div>
              ) : (
                <TimelineGrid
                  vehicles={vehicles}
                  orders={nightOrders}
                  slots={slots}
                  operationStatuses={operationStatuses}
                  dragOverPosition={dragOverPosition}
                  draggingSlotVehicleId={draggingSlotVehicleId}
                  selectedOrderId={selectedOrder?.id}
                  onOrderSelect={handleOrderSelect}
                  onOrderUpdate={handleOrderUpdate}
                  onSlotsUpdate={loadSlots}
                  nightDate={nightDate}
                  referenceTime={nightReferenceTime}
                  showNowLine={isCurrentNight}
                />
              )}
            </main>

            {!isMobile && selectedOrder ? (
              <aside className="dispatch-detail-panel">{detailPanel}</aside>
            ) : null}
          </div>

          {isMobile && vehicles.length > 0 && pendingCount > 0 ? (
            <div className="dispatch-mobile-queue">
              <DispatchNightReservations
                reservations={unplacedReservations}
                nightDate={nightDate}
              />
              <OrderCardList
                orders={nightOrders}
                onOrderSelect={handleOrderSelect}
                selectedOrderId={selectedOrder?.id}
                defaultExpanded
              />
            </div>
          ) : null}

          {isMobile && selectedOrder ? (
            <Dialog
              isOpen
              onOpenChange={(next) => {
                if (!next) setSelectedOrder(null)
              }}
              purpose="info"
              variant="fullscreen"
            >
              {detailPanel}
            </Dialog>
          ) : null}
        </div>
      </DndContext>
      <OrderFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOrderCreated={handleOrderCreated}
        onReservationSaved={handleReservationSaved}
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
          if (vehicles.length > 0) {
            syncNightOperations(vehicles)
          }
        }}
        vehicleId={selectedVehicleForStatus?.id}
        vehicleName={selectedVehicleForStatus?.name}
        date={nightDate}
      />
    </>
  )
}
