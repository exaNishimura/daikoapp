import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SaveIcon from '@mui/icons-material/Save'
import LogoutIcon from '@mui/icons-material/Logout'
import { ShiftPinGate } from '@/components/ShiftRequest/ShiftPinGate'
import {
  getShiftAvailabilityRequest,
  saveShiftAvailabilityRequest,
} from '@/services/employeeShiftService'
import { clearEmployeeShiftSession } from '@/lib/employeeShift/employeeShiftSession'

const DEFAULT_START = '20:00'
const DEFAULT_END = '06:00'

function monthKey(d) {
  return d.format('YYYY-MM')
}

function daysInMonth(month) {
  const start = dayjs(`${month}-01`)
  const count = start.daysInMonth()
  const days = []
  for (let i = 1; i <= count; i++) {
    days.push(start.date(i).format('YYYY-MM-DD'))
  }
  return days
}

function emptyPayload() {
  return { days: {}, notes: '' }
}

function ShiftRequestForm({ employee, onLogout }) {
  const [month, setMonth] = useState(() => dayjs().add(1, 'month').format('YYYY-MM'))
  const [payload, setPayload] = useState(emptyPayload)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const dates = useMemo(() => daysInMonth(month), [month])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const { data, error: apiErr } = await getShiftAvailabilityRequest(month)
    if (apiErr) {
      setError(apiErr.message)
      setPayload(emptyPayload())
    } else {
      setPayload(data?.payload ?? emptyPayload())
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const setDay = (date, patch) => {
    setPayload((prev) => {
      const days = { ...(prev.days || {}) }
      const current = days[date] || { available: false, start: DEFAULT_START, end: DEFAULT_END }
      days[date] = { ...current, ...patch }
      return { ...prev, days }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const { error: apiErr } = await saveShiftAvailabilityRequest(month, payload)
    if (apiErr) {
      setError(apiErr.message)
    } else {
      setSuccess('希望を保存しました')
    }
    setSaving(false)
  }

  const shiftMonth = (delta) => {
    setMonth((m) => dayjs(`${m}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          シフト希望提出
        </Typography>
        <Button startIcon={<LogoutIcon />} onClick={onLogout} size="small">
          ログアウト
        </Button>
      </Box>

      <Typography variant="body1" sx={{ mb: 2 }}>
        {employee.name} さん
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          出勤可能な日だけ「出勤可」をオンにし、時間帯を入力してください。オフの日は希望なし（出勤不可）として扱われます。
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Typography>読み込み中...</Typography>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {dates.map((date) => {
              const day = payload.days?.[date] || {
                available: false,
                start: DEFAULT_START,
                end: DEFAULT_END,
              }
              const weekday = dayjs(date).format('ddd')
              return (
                <Box
                  key={date}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 2,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography sx={{ minWidth: 120, fontWeight: 500 }}>
                    {dayjs(date).format('M/D')}（{weekday}）
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(day.available)}
                        onChange={(e) => setDay(date, { available: e.target.checked })}
                      />
                    }
                    label="出勤可"
                  />
                  {day.available ? (
                    <>
                      <TextField
                        label="開始"
                        type="time"
                        size="small"
                        value={day.start || DEFAULT_START}
                        onChange={(e) => setDay(date, { start: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 130 }}
                      />
                      <TextField
                        label="終了"
                        type="time"
                        size="small"
                        value={day.end || DEFAULT_END}
                        onChange={(e) => setDay(date, { end: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 130 }}
                      />
                    </>
                  ) : null}
                </Box>
              )
            })}
          </Box>

          <TextField
            label="備考（任意）"
            value={payload.notes || ''}
            onChange={(e) => setPayload((prev) => ({ ...prev, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 3 }}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '希望を保存'}
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  )
}

export function ShiftRequestPage() {
  const handleLogout = () => {
    clearEmployeeShiftSession()
    window.location.reload()
  }

  return (
    <ShiftPinGate>
      {({ employee }) => <ShiftRequestForm employee={employee} onLogout={handleLogout} />}
    </ShiftPinGate>
  )
}
