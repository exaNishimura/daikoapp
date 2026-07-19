import { useState } from 'react'
import dayjs from 'dayjs'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { missingReservationFields } from '@/services/reservationService'

function ReservationFormFields({ initial, onClose, onSubmit, isMobile }) {
  const [reservedAt, setReservedAt] = useState(() =>
    initial?.reserved_at ? dayjs(initial.reserved_at) : dayjs()
  )
  const [customerName, setCustomerName] = useState(() => initial?.customer_name ?? '')
  const [phone, setPhone] = useState(() => initial?.phone ?? '')
  const [memo, setMemo] = useState(() => initial?.memo ?? '')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const payload = {
      reserved_at: reservedAt?.isValid?.() ? reservedAt.toISOString() : '',
      customer_name: customerName,
      phone,
      memo,
    }
    const missing = missingReservationFields(payload)
    if (missing.length) {
      const next = {}
      for (const key of missing) next[key] = true
      setFieldErrors(next)
      setSubmitError('必須項目を入力してください')
      return
    }
    setFieldErrors({})
    setSubmitError('')
    setSaving(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setSubmitError(err?.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>{initial?.id ? '予約を編集' : '予約を登録'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <DateTimePicker
            label="予約日時"
            value={reservedAt}
            onChange={(v) => setReservedAt(v)}
            ampm={false}
            slotProps={{
              textField: {
                fullWidth: true,
                error: Boolean(fieldErrors.reserved_at),
                required: true,
              },
            }}
          />
          <TextField
            label="顧客名"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            error={Boolean(fieldErrors.customer_name)}
            fullWidth
          />
          <TextField
            label="電話番号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            error={Boolean(fieldErrors.phone)}
            fullWidth
          />
          <TextField
            label="メモ（備忘）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0,
          px: isMobile ? 2 : undefined,
          pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : undefined,
        }}
      >
        <Button onClick={onClose} disabled={saving} fullWidth={isMobile}>
          キャンセル
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} fullWidth={isMobile}>
          保存
        </Button>
      </DialogActions>
    </>
  )
}

/**
 * @param {{
 *   open: boolean
 *   initial?: { id?: string, reserved_at?: string, customer_name?: string, phone?: string, memo?: string } | null
 *   onClose: () => void
 *   onSubmit: (payload: { reserved_at: string, customer_name: string, phone: string, memo: string }) => Promise<void>
 * }} props
 */
export function ReservationFormDialog({ open, initial = null, onClose, onSubmit }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const formKey = `${initial?.id ?? 'new'}:${initial?.updated_at ?? 'create'}`
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      {open ? (
        <ReservationFormFields
          key={formKey}
          initial={initial}
          onClose={onClose}
          onSubmit={onSubmit}
          isMobile={isMobile}
        />
      ) : null}
    </Dialog>
  )
}
