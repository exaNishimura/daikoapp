import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          依頼詳細
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="詳細パネルを閉じる">
          <CloseIcon />
        </IconButton>
      </Paper>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Stack spacing={3.5}>
          {conflictMessages.length > 0 && (
            <Alert severity="error" role="alert">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                時間が重複しています
              </Typography>
              {conflictMessages.map((message) => (
                <Typography key={message} variant="body2">
                  {message}
                </Typography>
              ))}
            </Alert>
          )}
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
        </Stack>
      </Box>

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
    </Box>
  )
}
