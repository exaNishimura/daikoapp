import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CancelIcon from '@mui/icons-material/Cancel'
import DeleteIcon from '@mui/icons-material/Delete'
import { STATUS_LABELS } from '@/utils/orderStatusUtils'

const REVERTABLE_STATUSES = ['COMPLETED', 'IN_TRANSIT', 'PICKING_UP', 'ARRIVED', 'CONFIRMED']

export function OrderActionFooter({
  order,
  editing,
  loading,
  advanceStatus,
  hasConflict = false,
  onSave,
  onCancelEdit,
  onStartEdit,
  onConfirm,
  onRevertStatus,
  onAdvanceStatus,
  onCancel,
}) {
  const advanceColor = advanceStatus === 'COMPLETED' ? 'success' : 'info'

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
      <Stack spacing={1.5}>
        {editing ? (
          <>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={onCancelEdit}
              disabled={loading}
              fullWidth
            >
              キャンセル
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={onSave}
              disabled={loading}
              fullWidth
            >
              {loading ? '保存中…' : '保存'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onStartEdit} fullWidth>
              編集
            </Button>
            {(order.status === 'UNASSIGNED' || order.status === 'TENTATIVE') && (
              <Button
                variant="contained"
                color="success"
                onClick={onConfirm}
                disabled={loading || hasConflict}
                fullWidth
                title={hasConflict ? '時間の重複を解消してから確定してください' : undefined}
              >
                確定
              </Button>
            )}
            {REVERTABLE_STATUSES.includes(order.status) && (
              <Button variant="outlined" onClick={onRevertStatus} disabled={loading} fullWidth>
                ステータスを戻す
              </Button>
            )}
            {advanceStatus && (
              <Button
                variant="contained"
                color={advanceColor}
                onClick={onAdvanceStatus}
                disabled={loading}
                fullWidth
              >
                {STATUS_LABELS[advanceStatus]}
              </Button>
            )}
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onCancel}
              disabled={loading}
              fullWidth
            >
              削除
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  )
}
