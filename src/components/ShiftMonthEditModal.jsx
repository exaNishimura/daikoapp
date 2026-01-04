import { useState, useEffect, useMemo } from 'react'
import { getShifts, createShift, deleteShift, deleteShiftsByDate, createShiftsBulk } from '@/services/shiftService'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'

const CAR_OPTIONS = ['1', '2']
const ROLE_OPTIONS = ['代行', '随伴']
const STAFF_OPTIONS = ['西村', '鈴木', 'チョロモン', 'たかし', 'なみ']
const STATUS_OPTIONS = ['休業', '定休日']
const DOW_MAP = ['日', '月', '火', '水', '木', '金', '土']

// 月の日付リストを生成
function getDaysInMonth(year, month) {
  const days = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = DOW_MAP[date.getDay()]
    days.push({ date: dateStr, day, dow })
  }
  return days
}

export function ShiftMonthEditModal({ open, onClose, year, month, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shifts, setShifts] = useState([])
  const [editingDate, setEditingDate] = useState(null)
  const [newShift, setNewShift] = useState({
    car: '',
    role: '',
    staff: '',
    start: '',
    end: '',
    note: '',
  })
  const [statuses, setStatuses] = useState({}) // 日付ごとのステータス

  const days = useMemo(() => {
    if (!year || !month) return []
    return getDaysInMonth(year, month)
  }, [year, month])

  // モーダルが開かれたときにシフトデータを取得
  useEffect(() => {
    if (open && year && month) {
      loadShifts()
    }
  }, [open, year, month])

  const loadShifts = async () => {
    if (!year || !month) return

    setLoading(true)
    setError(null)

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(days.length).padStart(2, '0')}`
      
      const { data, error: fetchError } = await getShifts(startDate, endDate)

      if (fetchError) {
        setError(`シフトデータの取得に失敗: ${fetchError.message}`)
        setShifts([])
      } else {
        setShifts(data || [])
        // ステータスを抽出
        const statusMap = {}
        data?.forEach(shift => {
          if (shift.status) {
            statusMap[shift.date] = shift.status
          }
        })
        setStatuses(statusMap)
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  const getShiftsForDate = (date) => {
    return shifts.filter(s => s.date === date && !s.status)
  }

  const handleAddShift = async (date) => {
    if (!newShift.car || !newShift.role || !newShift.staff || !newShift.start || !newShift.end) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const dateObj = new Date(date)
      const dow = DOW_MAP[dateObj.getDay()]
      
      const { error: createError } = await createShift({
        date,
        dow,
        car: newShift.car,
        role: newShift.role,
        staff: newShift.staff,
        start: newShift.start,
        end: newShift.end,
        note: newShift.note || null,
      })

      if (createError) {
        setError(`シフトの追加に失敗: ${createError.message}`)
      } else {
        setNewShift({
          car: '',
          role: '',
          staff: '',
          start: '',
          end: '',
          note: '',
        })
        setEditingDate(null)
        await loadShifts()
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShift = async (id) => {
    if (!confirm('このシフトを削除しますか？')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await deleteShift(id)

      if (deleteError) {
        setError(`削除に失敗: ${deleteError.message}`)
      } else {
        await loadShifts()
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSetStatus = async (date, status) => {
    setLoading(true)
    setError(null)

    try {
      // 既存のシフトを削除
      await deleteShiftsByDate(date)

      if (status) {
        const dateObj = new Date(date)
        const dow = DOW_MAP[dateObj.getDay()]
        
        // ステータスを追加
        const { error: createError } = await createShift({
          date,
          dow,
          status,
        })

        if (createError) {
          setError(`ステータスの保存に失敗: ${createError.message}`)
        } else {
          await loadShifts()
        }
      } else {
        await loadShifts()
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setShifts([])
    setStatuses({})
    setError(null)
    setEditingDate(null)
    setNewShift({
      car: '',
      role: '',
      staff: '',
      start: '',
      end: '',
      note: '',
    })
    onClose()
  }

  const monthLabel = year && month ? `${year}年${month}月` : ''

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        シフト編集 - {monthLabel}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography>読み込み中...</Typography>
          </Box>
        )}

        {!loading && days.length > 0 && (
          <TableContainer component={Paper} sx={{ mt: 2, maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 100 }}>日付</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>曜日</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>ステータス</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>シフト</TableCell>
                  <TableCell sx={{ minWidth: 300 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {days.map(({ date, day, dow }) => {
                  const dateShifts = getShiftsForDate(date)
                  const status = statuses[date]
                  const isEditing = editingDate === date

                  return (
                    <TableRow key={date} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {day}日
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{dow}</Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={status || ''}
                            onChange={(e) => handleSetStatus(date, e.target.value || null)}
                            disabled={loading}
                            displayEmpty
                          >
                            <MenuItem value="">なし</MenuItem>
                            {STATUS_OPTIONS.map(s => (
                              <MenuItem key={s} value={s}>{s}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        {status ? (
                          <Chip label={status} size="small" color={status === '休業' ? 'error' : 'warning'} />
                        ) : (
                          <Stack spacing={0.5}>
                            {dateShifts.map((shift) => (
                              <Box key={shift.id} sx={{ fontSize: '0.75rem' }}>
                                {shift.car}号車 / {shift.role} / {shift.staff} / {shift.start} - {shift.end}
                                {shift.note && ` (${shift.note})`}
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        {!status && (
                          <Box>
                            {!isEditing ? (
                              <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setEditingDate(date)}
                                disabled={loading}
                              >
                                シフト追加
                              </Button>
                            ) : (
                              <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1, bgcolor: 'background.paper' }}>
                                <Grid container spacing={1}>
                                  <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>車両</InputLabel>
                                      <Select
                                        value={newShift.car}
                                        onChange={(e) => setNewShift({ ...newShift, car: e.target.value })}
                                        label="車両"
                                      >
                                        {CAR_OPTIONS.map(car => (
                                          <MenuItem key={car} value={car}>{car}号車</MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>役割</InputLabel>
                                      <Select
                                        value={newShift.role}
                                        onChange={(e) => setNewShift({ ...newShift, role: e.target.value })}
                                        label="役割"
                                      >
                                        {ROLE_OPTIONS.map(role => (
                                          <MenuItem key={role} value={role}>{role}</MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>スタッフ</InputLabel>
                                      <Select
                                        value={newShift.staff}
                                        onChange={(e) => setNewShift({ ...newShift, staff: e.target.value })}
                                        label="スタッフ"
                                      >
                                        {STAFF_OPTIONS.map(staff => (
                                          <MenuItem key={staff} value={staff}>{staff}</MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid item xs={3}>
                                    <TextField
                                      label="開始"
                                      type="time"
                                      value={newShift.start}
                                      onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                                      size="small"
                                      fullWidth
                                      InputLabelProps={{ shrink: true }}
                                    />
                                  </Grid>
                                  <Grid item xs={3}>
                                    <TextField
                                      label="終了"
                                      type="time"
                                      value={newShift.end}
                                      onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                                      size="small"
                                      fullWidth
                                      InputLabelProps={{ shrink: true }}
                                    />
                                  </Grid>
                                  <Grid item xs={12}>
                                    <TextField
                                      label="備考"
                                      value={newShift.note}
                                      onChange={(e) => setNewShift({ ...newShift, note: e.target.value })}
                                      size="small"
                                      fullWidth
                                      multiline
                                      rows={1}
                                    />
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => handleAddShift(date)}
                                        disabled={loading}
                                      >
                                        追加
                                      </Button>
                                      <Button
                                        size="small"
                                        onClick={() => {
                                          setEditingDate(null)
                                          setNewShift({
                                            car: '',
                                            role: '',
                                            staff: '',
                                            start: '',
                                            end: '',
                                            note: '',
                                          })
                                        }}
                                      >
                                        キャンセル
                                      </Button>
                                    </Stack>
                                  </Grid>
                                </Grid>
                              </Box>
                            )}
                            {dateShifts.map((shift) => (
                              <Box key={shift.id} sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                  {shift.car}号車 / {shift.role} / {shift.staff} / {shift.start} - {shift.end}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteShift(shift.id)}
                                  disabled={loading}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          閉じる
        </Button>
        <Button
          onClick={async () => {
            await loadShifts()
            if (onSaved) {
              onSaved()
            }
          }}
          disabled={loading}
        >
          再読み込み
        </Button>
      </DialogActions>
    </Dialog>
  )
}

