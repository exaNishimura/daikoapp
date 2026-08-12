import { Link as RouterLink } from 'react-router-dom'
import dayjs from 'dayjs'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

function memoPreview(memo) {
  const text = String(memo ?? '').trim()
  if (!text) return ''
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

function formatWorkDateLabel(workDate) {
  if (!workDate) return ''
  const [, m, d] = workDate.split('-')
  return `${Number(m)}/${Number(d)}`
}

/**
 * @param {{
 *   open: boolean
 *   workDate: string
 *   reservations: Array<{ id: string, reserved_at: string, customer_name: string, phone?: string, memo?: string }>
 *   onClose: () => void
 * }} props
 */
export function ReservationTonightDialog({ open, workDate, reservations, onClose }) {
  const count = reservations?.length ?? 0
  const dateLabel = formatWorkDateLabel(workDate)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="reservation-tonight-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="reservation-tonight-title">本日の予約 {count}件</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {dateLabel} 19:00〜翌06:00
        </Typography>
        <Stack spacing={1.25}>
          {(reservations ?? []).map((row) => {
            const memo = memoPreview(row.memo)
            return (
              <Box
                key={row.id}
                sx={{
                  p: 1.25,
                  border: '1px solid #e3e7ec',
                  borderRadius: 1,
                  background: '#fff',
                }}
              >
                <Typography sx={{ fontWeight: 700, color: '#b45309' }}>
                  {dayjs(row.reserved_at).format('M/D HH:mm')} {row.customer_name}
                </Typography>
                {row.phone ? (
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    <a href={`tel:${row.phone}`}>{row.phone}</a>
                  </Typography>
                ) : null}
                {memo ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {memo}
                  </Typography>
                ) : null}
              </Box>
            )
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button
          component={RouterLink}
          to={`/reservations?date=${workDate}`}
          variant="contained"
          onClick={onClose}
        >
          台帳で見る
        </Button>
      </DialogActions>
    </Dialog>
  )
}
