import { useEffect, useId, useRef } from 'react'
import { Field } from '@astryxdesign/core/Field'
import {
  importPlacesLibrary,
  getMieLocationRestriction,
  injectPlaceAutocompleteStyle,
} from '@/lib/places'

const HOST_STYLE = {
  display: 'block',
  width: '100%',
  '--places-border': 'var(--color-border)',
  '--places-border-hover': 'var(--color-text)',
  '--places-border-focus': 'var(--color-accent)',
  '--places-border-error': 'var(--color-error)',
  '--places-radius': 'var(--radius-md)',
}

/**
 * Google Places の新 `PlaceAutocompleteElement`（Web Component）を React でラップしたフィールド。
 *
 * - 要素の生成はマウント時に一度だけ。以降 value の外部変更（reset 等）は同期用 effect で反映。
 * - ユーザー入力（input）と候補選択（gmp-select）の両方を onChange に流す。
 *   選択時は formattedAddress を fetch して確定値とする。
 *
 * @param {Object} props
 * @param {string} props.value - 現在値（親の formData と同期）
 * @param {(address: string) => void} props.onChange
 * @param {string} [props.label] - 上部ラベル
 * @param {string} [props.name] - フォーム送信名
 * @param {string} [props.placeholder]
 * @param {boolean} [props.required]
 * @param {string} [props.error] - エラーメッセージ（あれば赤表示）
 * @param {string} [props.helperText] - 補助テキスト
 */
export function PlacesAutocompleteField({
  value = '',
  onChange,
  label,
  name,
  placeholder,
  required = false,
  error,
  helperText,
}) {
  const inputId = useId()
  const containerRef = useRef(null)
  const elementRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    let selectListener
    let inputListener
    ;(async () => {
      const places = await importPlacesLibrary()
      if (cancelled || !places || !containerRef.current) return

      const { PlaceAutocompleteElement } = places
      if (!PlaceAutocompleteElement) return

      injectPlaceAutocompleteStyle()

      const el = new PlaceAutocompleteElement({
        includedRegionCodes: ['jp'],
        locationRestriction: getMieLocationRestriction(),
      })
      el.requestedLanguage = 'ja'
      el.requestedRegion = 'jp'
      if (placeholder) el.placeholder = placeholder
      if (name) el.name = name
      if (value) el.value = value

      containerRef.current.appendChild(el)
      elementRef.current = el

      inputListener = () => {
        onChangeRef.current?.(el.value)
      }
      el.addEventListener('input', inputListener)

      selectListener = async (event) => {
        const prediction = event.placePrediction
        if (!prediction) return
        try {
          const place = prediction.toPlace()
          await place.fetchFields({ fields: ['formattedAddress'] })
          if (cancelled) return
          const address = place.formattedAddress || el.value
          el.value = address
          onChangeRef.current?.(address)
        } catch (err) {
          console.error('Failed to fetch place fields:', err)
        }
      }
      el.addEventListener('gmp-select', selectListener)
    })()

    return () => {
      cancelled = true
      const el = elementRef.current
      if (el) {
        if (selectListener) el.removeEventListener('gmp-select', selectListener)
        if (inputListener) el.removeEventListener('input', inputListener)
        el.remove()
      }
      elementRef.current = null
    }
    // 要素はマウント時に一度だけ生成する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = elementRef.current
    if (el && el.value !== value) {
      el.value = value || ''
    }
  }, [value])

  return (
    <Field
      label={label || '住所'}
      inputID={inputId}
      isRequired={required}
      isLabelHidden={!label}
      description={!error ? helperText : undefined}
      status={error ? { type: 'error', message: error } : undefined}
      statusVariant="detached"
      width="100%"
    >
      <span
        ref={containerRef}
        id={inputId}
        className="places-autocomplete-host"
        data-color-scheme="light"
        data-error={error ? 'true' : undefined}
        style={HOST_STYLE}
      />
    </Field>
  )
}
