import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import { useOrderDetail } from '@/hooks/useOrderDetail'
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
      {/* ヘッダー */}
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
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Paper>

      {/* コンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Stack spacing={3.5}>
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
