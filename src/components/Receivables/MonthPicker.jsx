import { DateInput } from '@astryxdesign/core/DateInput'
import { dayjsToMonthString } from './monthUtils'

/**
 * 月選択。I/O は常に 'YYYY-MM'。
 * DateInput は日単位なので、選択日の年月だけを親に返す。
 */
export function MonthPicker({ value, onChange, label = '対象月', size = 'small' }) {
  const isoValue = value ? `${value}-01` : undefined

  return (
    <DateInput
      label={label}
      value={isoValue}
      onChange={(next) => onChange?.(next ? String(next).slice(0, 7) : null)}
      format={(iso) => {
        if (!iso) return ''
        const [y, m] = String(iso).split('-')
        return `${y}年${m}月`
      }}
      hasClear
      size={size === 'small' ? 'sm' : 'md'}
      weekStartsOn="mon"
    />
  )
}

export { dayjsToMonthString }
