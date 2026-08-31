import { useId, useState } from 'react'
import { Field } from '@astryxdesign/core/Field'

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

const INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  paddingBlock: 'var(--spacing-2)',
  paddingInline: 'var(--spacing-3)',
  font: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
}

/**
 * 金額入力。
 *
 * - 非フォーカス時は `¥X,XXX` 表示、フォーカス時は素の数字に切替
 * - `¥` `,` 含む入力も許容、保存値は number
 * - 空欄は null で親に返す
 */
export function AmountInput({
  value,
  onChange,
  label = '金額',
  placeholder = '¥0',
  disabled = false,
  isLabelHidden = false,
}) {
  const inputId = useId()
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
    <Field label={label} inputID={inputId} width="100%" isLabelHidden={isLabelHidden}>
      <input
        id={inputId}
        value={display}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        style={INPUT_STYLE}
      />
    </Field>
  )
}
