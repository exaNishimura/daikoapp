import { useState } from 'react'
import TextField from '@mui/material/TextField'

const ALLOWED_INPUT_RE = /^[¥0-9,\s]*$/

function parseAmount(raw) {
  if (raw == null) return null
  const s = String(raw).replace(/[¥,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function formatAmount(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return `¥${n.toLocaleString('ja-JP')}`
}

/**
 * 金額入力。
 *
 * - 非フォーカス時は `¥X,XXX` 表示、フォーカス時は素の数字に切替
 * - `¥` `,` 含む入力も許容、保存値は number
 * - 空欄は null で親に返す
 *
 * @param {Object} props
 * @param {number|null} props.value
 * @param {(value: number|null) => void} props.onChange
 * @param {string} [props.label]
 * @param {string} [props.size]
 * @param {string} [props.placeholder]
 */
export function AmountInput({
  value,
  onChange,
  label = '金額',
  size = 'small',
  placeholder = '¥0',
  inputProps,
  ...rest
}) {
  const [draft, setDraft] = useState(null)

  const display = draft !== null ? draft : formatAmount(value)

  const handleFocus = () => {
    setDraft(value == null ? '' : String(value))
  }

  const handleBlur = () => {
    const parsed = parseAmount(draft)
    setDraft(null)
    onChange?.(parsed)
  }

  const handleChange = (e) => {
    const v = e.target.value
    if (ALLOWED_INPUT_RE.test(v)) setDraft(v)
  }

  return (
    <TextField
      label={label}
      size={size}
      value={display}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
      inputProps={{ inputMode: 'numeric', ...inputProps }}
      {...rest}
    />
  )
}
