import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import dayjs from 'dayjs'
import Popover from '@mui/material/Popover'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import './ReservationDayBadge.css'

/**
 * @param {{ date: string, reservations: Array<{ id: string, reserved_at: string, customer_name: string }> }} props
 */
export function ReservationDayBadge({ date, reservations }) {
  const [anchor, setAnchor] = useState(null)
  const count = reservations?.length ?? 0

  const sorted = useMemo(
    () =>
      [...(reservations ?? [])].sort(
        (a, b) => new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime()
      ),
    [reservations]
  )

  if (count === 0) return null

  return (
    <>
      <button
        type="button"
        className="reservation-day-badge"
        aria-label={`予約 ${count} 件`}
        onClick={(e) => {
          e.stopPropagation()
          setAnchor(e.currentTarget)
        }}
      >
        予約 {count}
      </button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Stack spacing={1} sx={{ p: 1.5, minWidth: 220, maxWidth: 320 }}>
          <Typography variant="subtitle2">{date} の予約</Typography>
          {sorted.map((r) => (
            <Typography key={r.id} variant="body2">
              {dayjs(r.reserved_at).format('HH:mm')} {r.customer_name}
            </Typography>
          ))}
          <Button
            component={RouterLink}
            to={`/reservations?date=${date}`}
            size="small"
            onClick={() => setAnchor(null)}
          >
            台帳で見る
          </Button>
        </Stack>
      </Popover>
    </>
  )
}
