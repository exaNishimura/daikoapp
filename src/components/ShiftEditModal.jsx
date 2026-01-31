import { useState, useEffect } from 'react'
import { getShifts, createShift, updateShift, deleteShift, deleteShiftsByDate, createShiftsBulk } from '@/services/shiftService'
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

const DOW_OPTIONS = ['月', '火', '水', '木', '金', '土', '日']
const CAR_OPTIONS = ['1', '2']
const ROLE_OPTIONS = ['代行', '随伴']
const STAFF_OPTIONS = ['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや']
const STATUS_OPTIONS = ['休業', '定休日']

export function ShiftEditModal({ open, onClose, date, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shifts, setShifts] = useState([])
  const [newShift, setNewShift] = useState({
    date: date || '',
    dow: '',
    car: '',
    role: '',
    staff: '',
    start: '',
    end: '',
    note: '',
    status: '',
  })

  // モーダルが開かれたときにシフトデータを取得
  useEffect(() => {
    if (open && date) {
      loadShifts()
      // 曜日を自動設定
      const dateObj = new Date(date)
      const dowIndex = dateObj.getDay()
      const dowMap = ['日', '月', '火', '水', '木', '金', '土']
      setNewShift(prev => ({ ...prev, date, dow: dowMap[dowIndex] }))
    }
  }, [open, date])

  const loadShifts = async () => {
    if (!date) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await getShifts(date, date)

      if (fetchError) {
        setError(`シフトデータの取得に失敗: ${fetchError.message}`)
        setShifts([])
      } else {
        setShifts(data || [])
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddShift = () => {
    if (!newShift.date || !newShift.dow) {
      setError('日付と曜日は必須です')
      return
    }

    // ステータスがある場合は、シフト情報は不要
    if (newShift.status) {
      if (newShift.status === '休業' || newShift.status === '定休日') {
        // 既存のシフトを削除してからステータスを追加
        handleSaveStatus(newShift.status)
        return
      }
    }

    // シフト情報が必要な場合のバリデーション
    if (!newShift.car || !newShift.role || !newShift.staff || !newShift.start || !newShift.end) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    setLoading(true)
    setError(null)

    createShift(newShift)
      .then(({ data, error: createError }) => {
        if (createError) {
          setError(`シフトの追加に失敗: ${createError.message}`)
        } else {
          setNewShift({
            date: date || '',
            dow: newShift.dow,
            car: '',
            role: '',
            staff: '',
            start: '',
            end: '',
            note: '',
            status: '',
          })
          loadShifts()
        }
      })
      .catch(err => {
        setError(`エラーが発生しました: ${err.message}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleSaveStatus = async (status) => {
    setLoading(true)
    setError(null)

    try {
      // 既存のシフトを削除
      await deleteShiftsByDate(date)

      // ステータスを追加
      const { error: createError } = await createShift({
        date,
        dow: newShift.dow,
        status,
      })

      if (createError) {
        setError(`ステータスの保存に失敗: ${createError.message}`)
      } else {
        setNewShift({
          date: date || '',
          dow: newShift.dow,
          car: '',
          role: '',
          staff: '',
          start: '',
          end: '',
          note: '',
          status: '',
        })
        await loadShifts()
        if (onSaved) {
          onSaved()
        }
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
        if (onSaved) {
          onSaved()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setShifts([])
    setError(null)
    setNewShift({
      date: date || '',
      dow: '',
      car: '',
      role: '',
      staff: '',
      start: '',
      end: '',
      note: '',
      status: '',
    })
    onClose()
  }

  // ステータスがある場合は、シフト一覧を非表示
  const hasStatus = shifts.some(s => s.status)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        シフト編集 - {date ? new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!hasStatus && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              新規シフト追加
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>曜日</InputLabel>
                  <Select
                    value={newShift.dow}
                    onChange={(e) => setNewShift({ ...newShift, dow: e.target.value })}
                    label="曜日"
                  >
                    {DOW_OPTIONS.map(dow => (
                      <MenuItem key={dow} value={dow}>{dow}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="開始時刻"
                  type="time"
                  value={newShift.start}
                  onChange={(e) => setNewShift({ ...newShift, start: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="終了時刻"
                  type="time"
                  value={newShift.end}
                  onChange={(e) => setNewShift({ ...newShift, end: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="備考"
                  value={newShift.note}
                  onChange={(e) => setNewShift({ ...newShift, note: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddShift}
                  disabled={loading}
                >
                  シフトを追加
                </Button>
              </Grid>
            </Grid>
          </>
        )}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">
            ステータス設定
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>ステータス</InputLabel>
              <Select
                value={newShift.status}
                onChange={(e) => {
                  const status = e.target.value
                  setNewShift({ ...newShift, status })
                  if (status) {
                    handleSaveStatus(status)
                  }
                }}
                label="ステータス"
              >
                <MenuItem value="">なし</MenuItem>
                {STATUS_OPTIONS.map(status => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {hasStatus && (
          <Alert severity="info" sx={{ mt: 2 }}>
            この日は{shifts.find(s => s.status)?.status}のため、シフトは設定できません。
          </Alert>
        )}

        {!hasStatus && shifts.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              設定済みのシフト
            </Typography>
            <Stack spacing={1}>
              {shifts.map((shift) => (
                <Box
                  key={shift.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      {shift.car}号車 / {shift.role} / {shift.staff} / {shift.start} - {shift.end}
                      {shift.note && ` (${shift.note})`}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteShift(shift.id)}
                    disabled={loading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  )
}

