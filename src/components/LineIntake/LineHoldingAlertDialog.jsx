import { Link as RouterLink } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'

function holdRemainingLabel(holdUntil) {
  if (!holdUntil) return ''
  const ms = new Date(holdUntil).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  return `残${Math.ceil(ms / 60000)}分`
}

/**
 * @param {{
 *   open: boolean
 *   units: Array<{
 *     id: string
 *     pickup_at?: string
 *     pickup_address?: string
 *     dropoff_address?: string
 *     hold_until?: string
 *     uses_extra_capacity?: boolean
 *     line_bookings?: { contact_phone?: string }
 *   }>
 *   onClose: () => void
 * }} props
 */
export function LineHoldingAlertDialog({ open, units, onClose }) {
  const count = units?.length ?? 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="line-holding-alert-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="line-holding-alert-title">LINE新規予約 {count}件</DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ mt: 0.5 }}>
          {(units ?? []).map((unit) => {
            const remain = holdRemainingLabel(unit.hold_until)
            return (
              <Box
                key={unit.id}
                sx={{
                  p: 1.25,
                  border: '1px solid #e3e7ec',
                  borderRadius: 1,
                  background: '#fff',
                }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" mb={0.5}>
                  {remain ? <Chip size="small" variant="outlined" label={remain} /> : null}
                  {unit.uses_extra_capacity ? (
                    <Chip size="small" color="error" label="要手配" />
                  ) : null}
                </Stack>
                <Typography sx={{ fontWeight: 700, color: '#b45309' }}>
                  {unit.pickup_at
                    ? new Date(unit.pickup_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                    : '—'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {unit.pickup_address || '—'} → {unit.dropoff_address || '—'}
                </Typography>
                {unit.line_bookings?.contact_phone ? (
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    <a href={`tel:${unit.line_bookings.contact_phone}`}>
                      {unit.line_bookings.contact_phone}
                    </a>
                  </Typography>
                ) : null}
              </Box>
            )
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button component={RouterLink} to="/" variant="contained" onClick={onClose}>
          配車画面へ
        </Button>
      </DialogActions>
    </Dialog>
  )
}
