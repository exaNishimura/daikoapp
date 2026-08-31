import { Selector } from '@astryxdesign/core/Selector'
import { RECEIVABLE_VEHICLE_OPTIONS } from '@/lib/billing/receivableForm'

/**
 * 売掛の号車選択（未指定 / 1号車 / 2号車）
 */
export function VehicleNumSelect({
  value,
  onChange,
  label = '号車',
  size = 'small',
  disabled = false,
  isLabelHidden = false,
}) {
  return (
    <Selector
      label={label}
      isLabelHidden={isLabelHidden}
      options={RECEIVABLE_VEHICLE_OPTIONS.map((opt) => ({
        value: String(opt.value ?? ''),
        label: opt.label,
      }))}
      value={value == null ? '' : String(value)}
      onChange={(next) => onChange(next)}
      size={size === 'small' ? 'sm' : 'md'}
      isDisabled={disabled}
      width="100%"
    />
  )
}
