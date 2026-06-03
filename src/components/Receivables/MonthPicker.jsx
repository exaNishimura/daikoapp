import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import { dayjsToMonthString } from './monthUtils'

/**
 * 月選択コンポーネント。
 *
 * MUI X DatePicker (`views={['year', 'month']}`) で年/月だけを選ばせる。
 * I/O は常に 'YYYY-MM' 文字列で扱い、DB の `billing_month` に直接マップしやすくする。
 *
 * アプリ全体は `main.jsx` の `LocalizationProvider`（adapterDayjs / locale=ja）配下にある前提。
 *
 * @param {Object} props
 * @param {string|null} props.value      'YYYY-MM' 形式
 * @param {(value: string|null) => void} props.onChange
 * @param {string} [props.label]
 * @param {string} [props.size]
 * @param {Object} [props.slotProps]     MUI X DatePicker の slotProps を上書きしたい場合に
 */
export function MonthPicker({
  value,
  onChange,
  label = '対象月',
  size = 'small',
  slotProps,
  ...rest
}) {
  const dayjsValue = value ? dayjs(`${value}-01`) : null

  return (
    <DatePicker
      label={label}
      value={dayjsValue}
      onChange={(next) => onChange?.(dayjsToMonthString(next))}
      views={['year', 'month']}
      openTo="month"
      format="YYYY年MM月"
      slotProps={{
        textField: { size, ...(slotProps?.textField ?? {}) },
        ...slotProps,
      }}
      {...rest}
    />
  )
}
