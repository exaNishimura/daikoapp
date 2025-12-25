import { useState, useEffect } from 'react'
import { createOrder, updateOrder } from '@/services/orderService'
import { estimateDuration, calculateBuffer } from '@/services/routeService'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

// 現在時刻をdatetime-local形式に変換（15分刻みにスナップ）
const getCurrentDateTimeLocal = () => {
  const now = new Date()
  // 15分刻みにスナップ
  const minutes = Math.round(now.getMinutes() / 15) * 15
  const snappedDate = new Date(now)
  snappedDate.setMinutes(minutes, 0, 0)
  
  const year = snappedDate.getFullYear()
  const month = String(snappedDate.getMonth() + 1).padStart(2, '0')
  const day = String(snappedDate.getDate()).padStart(2, '0')
  const hours = String(snappedDate.getHours()).padStart(2, '0')
  const snappedMinutes = String(snappedDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${snappedMinutes}`
}

// 営業時間内かチェック（18:00〜翌06:00）
const isValidBusinessTime = (dateTimeString) => {
  if (!dateTimeString) return false
  
  const date = new Date(dateTimeString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  // 18:00以降（当日）または翌06:00以前（翌日）が営業時間内
  // 06:00より大きく18:00より小さい場合は営業時間外
  if (hours >= 18 || hours < 6) {
    return true
  }
  
  return false
}

// 営業時間内の最小値を取得（当日の18:00）
const getMinBusinessDateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T18:00`
}

export function OrderFormModal({ onClose, onOrderCreated, open }) {
  const [formData, setFormData] = useState({
    order_type: 'NOW',
    scheduled_at: '',
    pickup_location: '',
    pickup_address: '',
    dropoff_address: '',
    contact_phone: '',
    car_model: '',
    car_plate: '',
    car_color: '',
    parking_note: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // モーダルが開かれたときにフォームをリセット
  useEffect(() => {
    if (open) {
      setFormData({
        order_type: 'NOW',
        scheduled_at: '',
        pickup_location: '',
        pickup_address: '',
        dropoff_address: '',
        contact_phone: '',
        car_model: '',
        car_plate: '',
        car_color: '',
        parking_note: '',
      })
      setErrors({})
    }
  }, [open])

  // 日時を15分刻みにスナップ
  const snapDateTimeTo15Minutes = (dateTimeString) => {
    if (!dateTimeString) return dateTimeString
    
    const date = new Date(dateTimeString)
    const minutes = date.getMinutes()
    const snappedMinutes = Math.round(minutes / 15) * 15
    
    const snappedDate = new Date(date)
    snappedDate.setMinutes(snappedMinutes, 0, 0)
    
    const year = snappedDate.getFullYear()
    const month = String(snappedDate.getMonth() + 1).padStart(2, '0')
    const day = String(snappedDate.getDate()).padStart(2, '0')
    const hours = String(snappedDate.getHours()).padStart(2, '0')
    const snappedMinutesStr = String(snappedDate.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${snappedMinutesStr}`
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const newData = { ...prev, [name]: value }
      // 予約種別が「日時指定」に変更された場合、現在時刻をデフォルト値として設定
      if (name === 'order_type' && value === 'SCHEDULED' && !prev.scheduled_at) {
        newData.scheduled_at = getCurrentDateTimeLocal()
      }
      // 日時指定の場合は15分刻みにスナップ
      if (name === 'scheduled_at' && value) {
        const snapped = snapDateTimeTo15Minutes(value)
        newData.scheduled_at = snapped
        // 営業時間チェック
        if (!isValidBusinessTime(snapped)) {
          setErrors((prev) => ({
            ...prev,
            scheduled_at: '営業時間（18:00〜翌06:00）内で選択してください',
          }))
        } else {
          // 営業時間内の場合はエラーをクリア
          setErrors((prev) => ({ ...prev, scheduled_at: null }))
        }
      }
      return newData
    })
    // エラーをクリア（scheduled_at以外）
    if (errors[name] && name !== 'scheduled_at') {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.pickup_address.trim()) {
      newErrors.pickup_address = '出発地を入力してください'
    }
    if (!formData.dropoff_address.trim()) {
      newErrors.dropoff_address = '目的地を入力してください'
    }
    if (formData.order_type === 'SCHEDULED' && !formData.scheduled_at) {
      newErrors.scheduled_at = '予約日時を入力してください'
    }
    
    // 営業時間チェック（18:00〜翌06:00）
    if (formData.order_type === 'SCHEDULED' && formData.scheduled_at) {
      if (!isValidBusinessTime(formData.scheduled_at)) {
        newErrors.scheduled_at = '営業時間（18:00〜翌06:00）内で選択してください'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault()
    }

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      // 依頼データの準備
      const orderData = {
        order_type: formData.order_type,
        pickup_location: formData.pickup_location.trim() || null,
        pickup_address: formData.pickup_address.trim(),
        dropoff_address: formData.dropoff_address.trim(),
        contact_phone: formData.contact_phone.trim() || null,
        car_model: formData.car_model.trim() || null,
        car_plate: formData.car_plate.trim() || null,
        car_color: formData.car_color.trim() || null,
        parking_note: formData.parking_note.trim() || null,
        status: 'UNASSIGNED',
      }

      if (formData.order_type === 'SCHEDULED' && formData.scheduled_at) {
        orderData.scheduled_at = new Date(formData.scheduled_at).toISOString()
      }

      // 依頼作成
      const { data: order, error: createError } = await createOrder(orderData)

      if (createError) {
        throw createError
      }

      // ルート計算（バックグラウンド）
      // ルート計算が完了するまで待機してから依頼を作成
      const { duration, error } = await estimateDuration(order.pickup_address, order.dropoff_address)
      
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Route calculation error:', error)
        }
        // エラーでも依頼は作成済みなので、デフォルト値で更新
        // デフォルト値は30分（往復15分×2）に設定
        const defaultDuration = 30
        const defaultBuffer = calculateBuffer(defaultDuration)
        await updateOrder(order.id, {
          base_duration_min: defaultDuration,
          buffer_min: defaultBuffer,
          buffer_manual: false,
        })
      } else if (duration) {
        const buffer = calculateBuffer(duration)
        // 依頼を更新（base_durationとbufferを設定）
        const { error: updateError } = await updateOrder(order.id, {
          base_duration_min: duration,
          buffer_min: buffer,
          buffer_manual: false,
        })

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to update order with route data:', updateError)
          }
        }
      } else {
        // durationがnullの場合もデフォルト値で更新
        const defaultDuration = 30
        const defaultBuffer = calculateBuffer(defaultDuration)
        await updateOrder(order.id, {
          base_duration_min: defaultDuration,
          buffer_min: defaultBuffer,
          buffer_manual: false,
        })
      }

      onOrderCreated(order)
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: '依頼の作成に失敗しました。もう一度お試しください。' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus={true}
      disableAutoFocus={false}
    >
      <DialogTitle>新規依頼（電話）</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          新しい依頼情報を入力してください
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              予約種別 <span style={{ color: '#ff4444' }}>*</span>
            </Typography>
            <RadioGroup
              row
              name="order_type"
              value={formData.order_type}
              onChange={handleChange}
            >
              <FormControlLabel value="NOW" control={<Radio />} label="今すぐ" />
              <FormControlLabel value="SCHEDULED" control={<Radio />} label="日時指定" />
            </RadioGroup>
          </Box>

          {formData.order_type === 'SCHEDULED' && (
            <TextField
              label="予約日時（15分刻み）"
              type="datetime-local"
              name="scheduled_at"
              value={formData.scheduled_at}
              onChange={handleChange}
              onBlur={(e) => {
                // フォーカスが外れたときにも15分刻みにスナップ
                if (e.target.value) {
                  const snapped = snapDateTimeTo15Minutes(e.target.value)
                  if (snapped !== e.target.value) {
                    setFormData((prev) => ({ ...prev, scheduled_at: snapped }))
                  }
                  // 営業時間チェック
                  if (!isValidBusinessTime(snapped)) {
                    setErrors((prev) => ({
                      ...prev,
                      scheduled_at: '営業時間（18:00〜翌06:00）内で選択してください',
                    }))
                  }
                }
              }}
              error={!!errors.scheduled_at}
              helperText={errors.scheduled_at || '15分刻みで選択してください（営業時間: 18:00〜翌06:00）'}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                step: 900, // 15分刻み（900秒 = 15分）
                min: getMinBusinessDateTime(), // 当日の18:00以降
              }}
              required
            />
          )}

          <TextField
            label="お迎え場所"
            name="pickup_location"
            value={formData.pickup_location}
            onChange={handleChange}
            multiline
            rows={2}
            error={!!errors.pickup_location}
            helperText={errors.pickup_location}
            placeholder="例: 三重県鈴鹿市..."
            fullWidth
          />

          <TextField
            label="出発地"
            name="pickup_address"
            value={formData.pickup_address}
            onChange={handleChange}
            multiline
            rows={2}
            error={!!errors.pickup_address}
            helperText={errors.pickup_address}
            placeholder="例: 三重県鈴鹿市..."
            fullWidth
            required
          />

          <TextField
            label="目的地"
            name="dropoff_address"
            value={formData.dropoff_address}
            onChange={handleChange}
            multiline
            rows={2}
            error={!!errors.dropoff_address}
            helperText={errors.dropoff_address}
            placeholder="例: 三重県鈴鹿市..."
            fullWidth
            required
          />

          <TextField
            label="連絡先電話番号"
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            placeholder="例: 090-1234-5678"
            fullWidth
          />

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              車情報
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <TextField
                  label="車種"
                  type="text"
                  name="car_model"
                  value={formData.car_model}
                  onChange={handleChange}
                  placeholder="例: プリウス"
                />
                <TextField
                  label="色"
                  type="text"
                  name="car_color"
                  value={formData.car_color}
                  onChange={handleChange}
                  placeholder="例: 白"
                />
              </Box>
              <TextField
                label="ナンバー"
                type="text"
                name="car_plate"
                value={formData.car_plate}
                onChange={handleChange}
                placeholder="例: 三重500あ1234"
                fullWidth
              />
            </Box>
            <TextField
              label="駐車位置メモ"
              name="parking_note"
              value={formData.parking_note}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="駐車位置やその他のメモ..."
              fullWidth
            />
          </Box>

          {errors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.submit}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

