import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import FormLabel from '@mui/material/FormLabel'
import FormHelperText from '@mui/material/FormHelperText'
import { useTheme } from '@mui/material/styles'
import {
  importPlacesLibrary,
  getMieLocationRestriction,
  injectPlaceAutocompleteStyle,
} from '@/lib/places'

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
  const theme = useTheme()
  const containerRef = useRef(null)
  const elementRef = useRef(null)
  // onChange を ref 経由で参照し、生成 effect の依存から外す（要素の作り直しを防ぐ）
  const onChangeRef = useRef(onChange)

  // 最新の onChange を ref に反映（render 中ではなく effect で更新）
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
      // マウント時点の value を初期値として設定（以降は下の同期 effect で反映）
      if (value) el.value = value

      containerRef.current.appendChild(el)
      elementRef.current = el

      // 手入力を親に反映（バリデーション用に値を持たせる）
      inputListener = () => {
        onChangeRef.current?.(el.value)
      }
      el.addEventListener('input', inputListener)

      // 候補選択時は formattedAddress を確定値として反映
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

  // 外部 value 変更（reset 等）を要素へ同期
  useEffect(() => {
    const el = elementRef.current
    if (el && el.value !== value) {
      el.value = value || ''
    }
  }, [value])

  const isLight = theme.palette.mode === 'light'

  return (
    <Box>
      {label && (
        <FormLabel
          error={!!error}
          required={required}
          sx={{ display: 'block', mb: 1, fontSize: '0.875rem' }}
        >
          {label}
        </FormLabel>
      )}
      <Box
        ref={containerRef}
        className="places-autocomplete-host"
        data-color-scheme={theme.palette.mode}
        data-error={error ? 'true' : undefined}
        sx={{
          width: '100%',
          // MUI OutlinedInput と同じ枠線・角丸（dispatchLightTheme / darkTheme 双方に追従）
          '--places-border': isLight ? 'rgba(0, 0, 0, 0.23)' : 'rgba(255, 255, 255, 0.23)',
          '--places-border-hover': isLight ? 'rgba(0, 0, 0, 0.87)' : 'rgba(255, 255, 255, 0.87)',
          '--places-border-focus': theme.palette.primary.main,
          '--places-border-error': theme.palette.error.main,
          '--places-radius': `${theme.shape.borderRadius}px`,
        }}
      />
      {error ? (
        <FormHelperText error>{error}</FormHelperText>
      ) : helperText ? (
        <FormHelperText>{helperText}</FormHelperText>
      ) : null}
    </Box>
  )
}
