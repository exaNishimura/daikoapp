import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { TimelineGrid } from './TimelineGrid'
import { OrderDetailPanel } from './OrderDetailPanel'
import { OrderFormModal } from './OrderFormModal'
import { VehicleOperationStatusModal } from './VehicleOperationStatusModal'
import { DispatchHeader } from './DispatchBoard/DispatchHeader'
import { VehicleSelectDialog } from './DispatchBoard/VehicleSelectDialog'
import { useDispatchData } from '@/hooks/useDispatchData'
import { useDispatchDnD } from '@/hooks/useDispatchDnD'
import { getOrderById } from '@/services/orderService'
import { createSlot } from '@/services/slotService'
import { findAutoPlacementSlot } from '@/lib/orderPlacement'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'

export function DispatchBoard() {
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
  } = useDispatchDnD({ vehicles, slots, operationStatuses, setSlots, setOrders })

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
