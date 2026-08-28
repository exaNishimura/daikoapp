import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { useOrderDetail } from '@/hooks/useOrderDetail'
import { getOrderConflictMessages } from '@/lib/slotConflictUtils'
import { OrderInfoSection } from './OrderDetailPanel/OrderInfoSection'
import { OrderRouteSection } from './OrderDetailPanel/OrderRouteSection'
import { OrderContactSection } from './OrderDetailPanel/OrderContactSection'
import { OrderActionFooter } from './OrderDetailPanel/OrderActionFooter'

export function OrderDetailPanel({
  order,
  onUpdate,
  onDelete,
  onClose,
  vehicles = [],
  slots = [],
}) {
  const conflictMessages = useMemo(
    () => getOrderConflictMessages(order.id, slots, vehicles),
    [order.id, slots, vehicles]
  )

  const {
    relatedVehicle,
    statusLabel,
    statusColor,
    advanceStatus,
    editing,
    formData,
    loading,
    recalculating,
    waitingLocationDuration,
    calculatingWaitingDuration,
    setEditing,
    setFormData,
    handleChange,
    handleSave,
    handleRecalculateRoute,
    handleConfirm,
    handleRevertStatus,
    handleCancel,
    handleAdvanceStatus,
  } = useOrderDetail({ order, vehicles, slots, onUpdate, onDelete, onClose })

  return (
    <Layout
      height="fill"
      padding={4}
      header={
        <HStack paddingBlock={2} hAlign="between" vAlign="center">
          <Heading level={2}>依頼詳細</Heading>
          <IconButton
            size="sm"
            variant="ghost"
            label="詳細パネルを閉じる"
            icon={<X />}
            onClick={onClose}
          />
        </HStack>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            {conflictMessages.length > 0 ? (
              <Banner status="error" title="時間が重複しています" collapsible={false}>
                <VStack gap={1}>
                  {conflictMessages.map((message) => (
                    <Text key={message}>{message}</Text>
                  ))}
                </VStack>
              </Banner>
            ) : null}
            <OrderInfoSection order={order} statusLabel={statusLabel} statusColor={statusColor} />
            <OrderRouteSection
              editing={editing}
              order={order}
              formData={formData}
              handleChange={handleChange}
              setFormData={setFormData}
              relatedVehicle={relatedVehicle}
              waitingLocationDuration={waitingLocationDuration}
              calculatingWaitingDuration={calculatingWaitingDuration}
              recalculating={recalculating}
              onRecalculateRoute={handleRecalculateRoute}
            />
            <OrderContactSection
              editing={editing}
              order={order}
              formData={formData}
              handleChange={handleChange}
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <OrderActionFooter
            order={order}
            editing={editing}
            loading={loading}
            advanceStatus={advanceStatus}
            hasConflict={conflictMessages.length > 0}
            onSave={handleSave}
            onCancelEdit={() => setEditing(false)}
            onStartEdit={() => setEditing(true)}
            onConfirm={handleConfirm}
            onRevertStatus={handleRevertStatus}
            onAdvanceStatus={handleAdvanceStatus}
            onCancel={handleCancel}
          />
        </LayoutFooter>
      }
    />
  )
}
