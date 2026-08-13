import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import {
  decideReassignMode,
  getReassignableCarNums,
  hasVehicleData,
} from '@/lib/billing/reassignVehicleSales'
import { formatVehicleNumLabel } from '@/lib/billing/receivableForm'

export function ReassignVehicleDialog({
  open,
  fromCar,
  dailyRow = null,
  dayShifts = [],
  receivableRows = [],
  loading = false,
  error = null,
  onClose,
  onConfirm,
}) {
  const options = getReassignableCarNums(fromCar)
  const [toCar, setToCar] = useState(options[0] ?? '')

  useEffect(() => {
    if (!open) return
    const nextOptions = getReassignableCarNums(fromCar)
    setToCar(nextOptions[0] ?? '')
  }, [open, fromCar])

  const hasToData =
    toCar !== '' &&
    hasVehicleData({
      carNum: toCar,
      dailyRow,
      dayShifts,
      receivableRows,
    })

  let modeLabel = ''
  let mode = null
  try {
    if (toCar !== '') {
      mode = decideReassignMode({ fromCar, toCar, hasToData })
      modeLabel =
        mode === 'swap'
          ? `${formatVehicleNumLabel(fromCar)} と ${formatVehicleNumLabel(toCar)} のデータを入れ替えます`
          : `${formatVehicleNumLabel(fromCar)} のデータを ${formatVehicleNumLabel(toCar)} へ付け替えます`
    }
  } catch {
    modeLabel = ''
  }

  const handleConfirm = () => {
    if (!toCar || loading) return
    onConfirm?.({ toCar, mode })
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>号車変更</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            現在: {formatVehicleNumLabel(fromCar)}
          </Typography>
          <FormControl fullWidth size="small" disabled={loading || options.length === 0}>
            <InputLabel id="reassign-to-car-label">変更先号車</InputLabel>
            <Select
              labelId="reassign-to-car-label"
              label="変更先号車"
              value={toCar}
              onChange={(e) => setToCar(e.target.value)}
            >
              {options.map((car) => (
                <MenuItem key={car} value={car}>
                  {formatVehicleNumLabel(car)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {modeLabel && <Alert severity={mode === 'swap' ? 'warning' : 'info'}>{modeLabel}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || !toCar}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          実行
        </Button>
      </DialogActions>
    </Dialog>
  )
}
