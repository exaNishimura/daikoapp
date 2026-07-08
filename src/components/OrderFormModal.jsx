import { useEffect } from 'react'
import { getMinBusinessDateTime } from '@/utils/businessDayUtils'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { useOrderForm } from '@/hooks/useOrderForm'
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
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import Stack from '@mui/material/Stack'

export function OrderFormModal({ onClose, onOrderCreated, open }) {
  const {
    formData,
    errors,
    loading,
    updateField,
    setErrors,
    handleChange,
    handleScheduledBlur,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    handleSubmit,
    reset,
  } = useOrderForm({ onSuccess: onOrderCreated })

  // モーダルが開かれたタイミングでフォームをリセット
  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])

  const handlePickupAddressChange = (address) => {
    updateField('pickup_address', address)
    setErrors((prev) => (prev.pickup_address ? { ...prev, pickup_address: null } : prev))
  }

  const handleDropoffAddressChange = (address) => {
    updateField('dropoff_address', address)
    setErrors((prev) => (prev.dropoff_address ? { ...prev, dropoff_address: null } : prev))
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus={true}
      disableAutoFocus={false}
      PaperProps={{
        style: {
          overflow: 'visible',
          position: 'relative',
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle>新規依頼（電話）</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          新しい依頼情報を入力してください
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              予約種別 <span style={{ color: '#ff4444' }}>*</span>
            </Typography>
            <RadioGroup row name="order_type" value={formData.order_type} onChange={handleChange}>
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
              onBlur={handleScheduledBlur}
              error={!!errors.scheduled_at}
              helperText={
                errors.scheduled_at || '15分刻みで選択してください（営業時間: 18:00〜翌06:00）'
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{
                step: 900,
                min: getMinBusinessDateTime(),
              }}
              required
            />
          )}

          <TextField
            label="お迎え場所"
            name="pickup_location"
            value={formData.pickup_location}
            onChange={handleChange}
            error={!!errors.pickup_location}
            helperText={errors.pickup_location}
            placeholder="例: モンガータ"
            fullWidth
          />

          <PlacesAutocompleteField
            label="出発地"
            name="pickup_address"
            value={formData.pickup_address}
            onChange={handlePickupAddressChange}
            error={errors.pickup_address}
            placeholder="例: 三重県鈴鹿市..."
            required
          />

          <PlacesAutocompleteField
            label="目的地"
            name="dropoff_address"
            value={formData.dropoff_address}
            onChange={handleDropoffAddressChange}
            error={errors.dropoff_address}
            placeholder="例: 三重県鈴鹿市..."
            required
          />

          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                経由地
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addWaypoint}>
                追加
              </Button>
            </Box>
            <Stack spacing={1.5}>
              {formData.waypoints.map((waypoint, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <PlacesAutocompleteField
                      label={`経由地 ${index + 1}`}
                      value={waypoint}
                      onChange={(address) => updateWaypoint(index, address)}
                      placeholder="例: 三重県鈴鹿市..."
                    />
                  </Box>
                  <IconButton
                    onClick={() => removeWaypoint(index)}
                    sx={{ mt: 0.5 }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              {formData.waypoints.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  経由地はありません
                </Typography>
              )}
            </Stack>
          </Box>

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
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
