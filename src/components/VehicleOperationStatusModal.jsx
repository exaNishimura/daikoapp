import { useState, useEffect } from 'react'
import { getVehicleOperationStatus, setVehicleOperationStatus, deleteVehicleOperationStatus } from '@/services/vehicleOperationService'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import DeleteIcon from '@mui/icons-material/Delete'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'

export function VehicleOperationStatusModal({ open, onClose, vehicleId, vehicleName, onStatusUpdated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [formData, setFormData] = useState({
    type: 'DEFAULT',
    date: '',
    time: '',
  })

  // モーダルが開かれたときに稼働状況を取得
  useEffect(() => {
    if (open && vehicleId) {
      loadStatuses()
    }
  }, [open, vehicleId])

  const loadStatuses = async () => {
    if (!vehicleId) return

    setLoading(true)
    setError(null)

    try {
      // 今日の日付を取得
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const { data, error: fetchError } = await getVehicleOperationStatus(vehicleId, todayStr)

      if (fetchError) {
        setError(`稼働状況の取得に失敗: ${fetchError.message}`)
        setStatuses([])
      } else {
        setStatuses(data || [])
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setStatuses([])
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (event) => {
    setFormData({
      ...formData,
      type: event.target.value,
      time: event.target.value === 'STOP' || event.target.value === 'START' ? formData.time : '',
    })
  }

  const handleDateChange = (event) => {
    setFormData({
      ...formData,
      date: event.target.value,
    })
  }

  const handleTimeChange = (event) => {
    setFormData({
      ...formData,
      time: event.target.value,
    })
  }

  const handleSave = async () => {
    if (!vehicleId) return

    // バリデーション
    if (!formData.date) {
      setError('日付を入力してください')
      return
    }

    if ((formData.type === 'STOP' || formData.type === 'START') && !formData.time) {
      setError('時刻を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: saveError } = await setVehicleOperationStatus(vehicleId, {
        type: formData.type,
        date: formData.date,
        time: formData.time || null,
      })

      if (saveError) {
        setError(`保存に失敗: ${saveError.message}`)
      } else {
        // フォームをリセット
        setFormData({
          type: 'DEFAULT',
          date: '',
          time: '',
        })
        // 稼働状況を再取得
        await loadStatuses()
        // 親コンポーネントに通知
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (statusId) => {
    if (!vehicleId || !statusId) return

    if (!confirm('この稼働状況設定を削除しますか？')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await deleteVehicleOperationStatus(vehicleId, statusId)

      if (deleteError) {
        setError(`削除に失敗: ${deleteError.message}`)
      } else {
        // 稼働状況を再取得
        await loadStatuses()
        // 親コンポーネントに通知
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'DEFAULT':
        return '基本は稼働'
      case 'DAY_OFF':
        return '1日稼働しない'
      case 'STOP':
        return '途中で稼働停止'
      case 'START':
        return '途中で稼働開始'
      default:
        return type
    }
  }

  // 今日の日付を'YYYY-MM-DD'形式で取得
  const getTodayDateString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        稼働状況設定 - {vehicleName || '車両'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">稼働状況パターン</FormLabel>
            <RadioGroup
              value={formData.type}
              onChange={handleTypeChange}
            >
              <FormControlLabel value="DEFAULT" control={<Radio />} label="基本は稼働" />
              <FormControlLabel value="DAY_OFF" control={<Radio />} label="1日稼働しない" />
              <FormControlLabel value="STOP" control={<Radio />} label="途中で稼働停止" />
              <FormControlLabel value="START" control={<Radio />} label="途中で稼働開始" />
            </RadioGroup>
          </FormControl>
        </Box>

        <Box sx={{ mt: 3 }}>
          <TextField
            label="日付"
            type="date"
            value={formData.date}
            onChange={handleDateChange}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: getTodayDateString(),
            }}
            required
          />
        </Box>

        {(formData.type === 'STOP' || formData.type === 'START') && (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="時刻"
              type="time"
              value={formData.time}
              onChange={handleTimeChange}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                step: 900, // 15分刻み
              }}
              required
            />
          </Box>
        )}

        {statuses.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              設定済みの稼働状況
            </Typography>
            <Stack spacing={1}>
              {statuses.map((status) => (
                <Box
                  key={status.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Chip label={getTypeLabel(status.type)} size="small" sx={{ mr: 1 }} />
                    <Typography variant="body2" component="span">
                      {status.date}
                      {status.time && ` ${status.time}`}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(status.id)}
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
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

