import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimelineGrid } from './TimelineGrid'
import { OrderDetailPanel } from './OrderDetailPanel'
import { OrderFormModal } from './OrderFormModal'
import { OrderCardList } from './OrderCardList'
import { VehicleOperationStatusModal } from './VehicleOperationStatusModal'
import { DispatchHeader } from './DispatchBoard/DispatchHeader'
import { DispatchStatusLegend } from './DispatchBoard/DispatchStatusLegend'
import { VehicleSelectDialog } from './DispatchBoard/VehicleSelectDialog'
import { useDispatchData } from '@/hooks/useDispatchData'
import { useDispatchDnD } from '@/hooks/useDispatchDnD'
import { useToast } from '@/contexts/ToastContext'
import { getOrderById } from '@/services/orderService'
import { createSlot } from '@/services/slotService'
import { findAutoPlacementSlot } from '@/lib/orderPlacement'
import { detectAllConflicts } from '@/lib/slotConflictUtils'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import RefreshIcon from '@mui/icons-material/Refresh'

export function DispatchBoard() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { showToast } = useToast()

  const {
    orders,
    vehicles,
    slots,
    operationStatuses,
    loading,
    error,
    setOrders,
    setSlots,
    loadData,
    loadSlots,
    loadOperationStatuses,
    earliestAvailableTime,
    businessDayText,
  } = useDispatchData()

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOperationStatusModalOpen, setIsOperationStatusModalOpen] = useState(false)
  const [isVehicleSelectDialogOpen, setIsVehicleSelectDialogOpen] = useState(false)
  const [selectedVehicleForStatus, setSelectedVehicleForStatus] = useState(null)

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === 'UNASSIGNED' || o.status === 'TENTATIVE').length,
    [orders]
  )

  const conflictCount = useMemo(() => detectAllConflicts(slots).conflictIds.size, [slots])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const {
    dragOverPosition,
    draggingSlotVehicleId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDispatchDnD({ vehicles, slots, orders, operationStatuses, setSlots, setOrders })

  const handleOrderCreated = async (newOrder) => {
    setOrders((prev) => [newOrder, ...prev])
    setIsModalOpen(false)

    // すべての依頼を即座にタイムラインに自動配置
    if (vehicles.length > 0) {
      try {
        const { data: latestOrder, error: orderError } = await getOrderById(newOrder.id)
        if (orderError) {
          console.error('Error fetching latest order for auto-placement:', orderError)
          showToast('依頼データの取得に失敗しました。未確定一覧から手動配置してください。', 'error')
          return
        }

        const { availableSlot, totalDuration } = findAutoPlacementSlot({
          order: latestOrder ?? newOrder,
          vehicles,
          slots,
          operationStatuses,
        })

        if (availableSlot) {
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
            showToast('自動配置に失敗しました。未確定一覧から手動配置してください。', 'error')
          } else if (slot) {
            setSlots((prev) => {
              const existingIndex = prev.findIndex((s) => s.id === slot.id)
              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = slot
                return updated
              }
              return [...prev, slot]
            })

            if (latestOrder) {
              handleOrderUpdate(latestOrder)
            }
            showToast('依頼をタイムラインに仮配置しました', 'success')
          }
        } else {
          showToast(
            '配置可能な時間が見つかりませんでした。未確定一覧から手動で配置してください。',
            'warning'
          )
        }
      } catch (autoPlaceError) {
        if (import.meta.env.DEV) {
          console.error('Error in auto-placement:', autoPlaceError)
        }
        showToast('自動配置中にエラーが発生しました。未確定一覧を確認してください。', 'error')
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
      await loadOperationStatuses(vehicles)
    }
  }

  const detailDrawerWidth = isMobile ? '100%' : 384

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          minHeight: 0,
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          読み込み中…
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <DispatchHeader
          businessDayText={businessDayText}
          earliestAvailableTime={earliestAvailableTime}
          vehicles={vehicles}
          pendingCount={pendingCount}
          conflictCount={conflictCount}
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

        {vehicles.length > 0 && <DispatchStatusLegend />}

        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={loadData}>
                再読み込み
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {!isMobile && vehicles.length > 0 && (
            <Box
              sx={{
                width: 280,
                flexShrink: 0,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignSelf: 'flex-start',
              }}
            >
              <OrderCardList
                orders={orders}
                onOrderSelect={handleOrderSelect}
                selectedOrderId={selectedOrder?.id}
                defaultExpanded
              />
            </Box>
          )}

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: 'background.default',
              minWidth: 0,
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
                selectedOrderId={selectedOrder?.id}
                onOrderSelect={handleOrderSelect}
                onOrderUpdate={handleOrderUpdate}
                onSlotsUpdate={loadSlots}
              />
            )}
          </Box>

          {selectedOrder && (
            <Drawer
              anchor="right"
              open={!!selectedOrder}
              variant={isMobile ? 'temporary' : 'persistent'}
              onClose={() => setSelectedOrder(null)}
              ModalProps={{ keepMounted: true }}
              sx={{
                width: detailDrawerWidth,
                flexShrink: 0,
                zIndex: (t) => t.zIndex.drawer + 10,
                '& .MuiDrawer-paper': {
                  width: detailDrawerWidth,
                  boxSizing: 'border-box',
                  borderLeft: 1,
                  borderColor: 'divider',
                  zIndex: (t) => t.zIndex.drawer + 10,
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

        {isMobile && vehicles.length > 0 && pendingCount > 0 && (
          <Box
            sx={{
              flexShrink: 0,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <OrderCardList
              orders={orders}
              onOrderSelect={handleOrderSelect}
              selectedOrderId={selectedOrder?.id}
              defaultExpanded
            />
          </Box>
        )}

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
