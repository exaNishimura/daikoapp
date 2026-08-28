import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { listShiftAvailabilityRequests } from '@/services/employeeShiftService'

function RequestDetailRow({ row }) {
  const [open, setOpen] = useState(false)
  const days = row.payload?.days ?? {}
  const entries = Object.entries(days)
    .filter(([, v]) => v?.available)
    .sort(([a], [b]) => a.localeCompare(b))

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)} aria-label="詳細">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{row.employee_name}</TableCell>
        <TableCell>{row.license_type}</TableCell>
        <TableCell>
          <Chip
            size="small"
            label={row.shift_pin_configured ? 'PIN設定済' : 'PIN未設定'}
            color={row.shift_pin_configured ? 'success' : 'default'}
          />
        </TableCell>
        <TableCell align="right">{row.has_request ? row.available_days : '—'}</TableCell>
        <TableCell>
          {row.updated_at ? dayjs(row.updated_at).format('M/D HH:mm') : '—'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2 }}>
              {!row.has_request ? (
                <Typography variant="body2" color="text.secondary">
                  未提出
                </Typography>
              ) : entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  出勤可の日がありません
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {entries.map(([date, d]) => (
                    <li key={date}>
                      <Typography variant="body2" component="span">
                        {dayjs(date).format('M/D（ddd）')} {d.start}〜{d.end}
                      </Typography>
                    </li>
                  ))}
                </Box>
              )}
              {row.payload?.notes ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  備考: {row.payload.notes}
                </Typography>
              ) : null}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export function ShiftRequestsAdminPage() {
  const [month, setMonth] = useState(() => dayjs().add(1, 'month').format('YYYY-MM'))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: apiErr } = await listShiftAvailabilityRequests(month)
    if (apiErr) {
      setError(apiErr.message)
      setRows([])
    } else {
      setRows(data?.rows ?? [])
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const shiftMonth = (delta) => {
    setMonth((m) => dayjs(`${m}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        シフト希望一覧（管理者）
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <IconButton onClick={() => shiftMonth(-1)} aria-label="前の月">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6">{dayjs(`${month}-01`).format('YYYY年M月')}</Typography>
          <IconButton onClick={() => shiftMonth(1)} aria-label="次の月">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography>読み込み中...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>名前</TableCell>
                <TableCell>免許</TableCell>
                <TableCell>PIN</TableCell>
                <TableCell align="right">出勤可日数</TableCell>
                <TableCell>更新日時</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <RequestDetailRow key={row.employee_id} row={row} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ mt: 2 }}>
        <Button onClick={load} disabled={loading}>
          再読み込み
        </Button>
      </Box>
    </Container>
  )
}
