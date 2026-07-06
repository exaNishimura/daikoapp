import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { RECEIVABLE_VEHICLE_OPTIONS } from '@/lib/billing/receivableForm'

/**
 * 売掛の号車選択（未指定 / 1号車 / 2号車）
 */
export function VehicleNumSelect({
  value,
  onChange,
  label = '号車',
  size = 'small',
  fullWidth = true,
  disabled = false,
}) {
  return (
    <FormControl size={size} fullWidth={fullWidth} disabled={disabled}>
      <InputLabel id="vehicle-num-select-label">{label}</InputLabel>
      <Select
        labelId="vehicle-num-select-label"
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {RECEIVABLE_VEHICLE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value || 'unset'} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
