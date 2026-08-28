import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useAdminLineUnitAction, useApproveLineUnit, useLineQueue } from '@/hooks/useLineIntake'
import './LineQueuePage.css'

const UNIT_STATUS_LABELS = {
  HOLDING: '仮受付',
  CONFIRMED: '確定',
  EXPIRED: '期限切れ',
  CANCELLED: 'キャンセル',
}

const UNIT_STATUS_COLORS = {
  HOLDING: 'warning',
  CONFIRMED: 'success',
  EXPIRED: 'default',
  CANCELLED: 'default',
}

function unitStatusLabel(status) {
  return UNIT_STATUS_LABELS[status] || status
}

function holdRemainingLabel(holdUntil) {
  if (!holdUntil) return '—'
  const ms = new Date(holdUntil).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  const m = Math.ceil(ms / 60000)
  return `残${m}分`
}

export function LineQueuePage() {
  const { data, isLoading, error, refetch } = useLineQueue()
  const approve = useApproveLineUnit()
  const adminAction = useAdminLineUnitAction()
  const [selected, setSelected] = useState(null)
  const [actionError, setActionError] = useState('')

  const rows = useMemo(() => data || [], [data])

  const openDetail = (unit) => {
    setSelected(unit)
    setActionError('')
  }

  const handleApprove = async () => {
    setActionError('')
    try {
      await approve.mutateAsync({ unitId: selected.id })
      setSelected(null)
    } catch (e) {
      setActionError(e?.raw?.error || e.message || '承認に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm('この仮受付を削除しますか？枠も解放されます。')) return
    setActionError('')
    try {
      await adminAction.mutateAsync({
        action: 'admin_delete',
        unit_id: selected.id,
      })
      setSelected(null)
    } catch (e) {
      setActionError(e?.raw?.error || e.message || '削除に失敗しました')
    }
  }

  return (
    <Box className="line-queue-page" sx={{ p: 2, overflow: 'auto', height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h1">
          LINE 仮受付
        </Typography>
        <Button onClick={() => refetch()}>更新</Button>
      </Stack>

      {isLoading && <Typography>読み込み中…</Typography>}
      {error && <Alert severity="error">{error.message}</Alert>}

      <Stack spacing={1.5}>
        {rows.map((unit) => {
          const booking = unit.line_bookings
          const discount = booking?.discount_snapshot
          return (
            <Box
              key={unit.id}
              className="line-queue-card"
              onClick={() => openDetail(unit)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openDetail(unit)
              }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
                <Chip
                  size="small"
                  label={unitStatusLabel(unit.status)}
                  color={UNIT_STATUS_COLORS[unit.status] || 'default'}
                />
                {unit.uses_extra_capacity && <Chip size="small" color="error" label="要手配" />}
                {unit.status === 'HOLDING' && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={holdRemainingLabel(unit.hold_until)}
                  />
                )}
                {discount?.applied && <Chip size="small" color="success" label={discount.label} />}
              </Stack>
              <Typography fontWeight={600}>
                {new Date(unit.pickup_at).toLocaleString('ja-JP')}
              </Typography>
              <Typography variant="body2">
                {unit.pickup_address} → {unit.dropoff_address}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                TEL {booking?.contact_phone} / LINE {booking?.line_user_id}
              </Typography>
            </Box>
          )
        })}
        {!isLoading && rows.length === 0 && (
          <Typography color="text.secondary">仮受付・確定の表示対象はありません</Typography>
        )}
      </Stack>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>台詳細</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={1.5} mt={1}>
              <Typography>
                {selected.pickup_address} → {selected.dropoff_address}
              </Typography>
              <Typography variant="body2">車両: {selected.vehicle_info || '—'}</Typography>
              <Typography variant="body2">電話: {selected.line_bookings?.contact_phone}</Typography>
              <Typography variant="body2">LINE: {selected.line_bookings?.line_user_id}</Typography>
              <Typography variant="body2">状態: {unitStatusLabel(selected.status)}</Typography>
              <Typography variant="body2">
                割引: {selected.line_bookings?.discount_snapshot?.label || 'なし'}
              </Typography>
              {selected.projection_error && (
                <Alert severity="warning">投影エラー: {selected.projection_error}</Alert>
              )}
              {actionError && <Alert severity="error">{actionError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>閉じる</Button>
          <Button color="error" onClick={handleDelete} disabled={adminAction.isPending}>
            削除
          </Button>
          {selected?.status === 'HOLDING' && (
            <Button variant="contained" onClick={handleApprove} disabled={approve.isPending}>
              確定にする
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
