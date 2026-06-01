/**
 * Google Places Autocomplete のセットアップ用ユーティリティ
 *
 * フォーム上の <input> に Autocomplete を取り付ける処理は本来同じだが
 * pickup / dropoff / waypoint で 3 回コピペされていたため共通化。
 */

// 三重県の bounds（県外候補をなるべく除外する）
const MIE_BOUNDS_SW = { lat: 33.7, lng: 135.8 } // 南牟婁郡
const MIE_BOUNDS_NE = { lat: 35.2, lng: 136.9 } // 桑名市周辺

/**
 * Google Places API がブラウザに読み込まれているか
 */
export function isGooglePlacesReady() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.google &&
    window.google.maps &&
    window.google.maps.places
  )
}

/**
 * Material-UI の TextField の inputRef は時々 input 以外（コンテナ）を返すので
 * 必要に応じて子の input を辿って取り出す。
 * @param {HTMLElement|HTMLInputElement|null} ref
 * @returns {HTMLInputElement|null}
 */
export function resolveInputElement(ref) {
  if (!ref) return null
  if (ref instanceof HTMLInputElement) return ref
  const container = typeof ref.closest === 'function' ? ref.closest('.MuiInputBase-root') : null
  if (container) {
    const input = container.querySelector('input')
    if (input instanceof HTMLInputElement) return input
  }
  if (typeof ref.querySelector === 'function') {
    const input = ref.querySelector('input')
    if (input instanceof HTMLInputElement) return input
  }
  return null
}

/**
 * `.pac-container` の z-index を Dialog 内でも見えるように調整するスタイルを
 * 一度だけ <head> に注入する
 */
export function injectPacContainerStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('pac-container-style')) return

  const style = document.createElement('style')
  style.id = 'pac-container-style'
  style.textContent = `
    .pac-container {
      z-index: 1400 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .pac-item {
      cursor: pointer;
      padding: 8px;
    }
    .pac-item:hover {
      background-color: #f5f5f5;
    }
    .pac-item-selected {
      background-color: #e3f2fd;
    }
  `
  document.head.appendChild(style)
}

/**
 * 1 つの input 要素に Places Autocomplete を取り付ける
 *
 * @param {HTMLInputElement} inputElement - 取り付け先の input
 * @param {(formattedAddress: string, place: google.maps.places.PlaceResult) => void} onPlaceChanged
 * @returns {() => void} cleanup 関数（イベントリスナー解除）
 */
export function attachPlacesAutocomplete(inputElement, onPlaceChanged) {
  if (!isGooglePlacesReady() || !(inputElement instanceof HTMLInputElement)) {
    return () => {}
  }

  const { Autocomplete } = window.google.maps.places

  // 既存があればクリーンアップ
  if (inputElement._autocomplete) {
    window.google.maps.event.clearInstanceListeners(inputElement._autocomplete)
    delete inputElement._autocomplete
  }

  const bounds = new window.google.maps.LatLngBounds(
    new window.google.maps.LatLng(MIE_BOUNDS_SW.lat, MIE_BOUNDS_SW.lng),
    new window.google.maps.LatLng(MIE_BOUNDS_NE.lat, MIE_BOUNDS_NE.lng)
  )

  const autocomplete = new Autocomplete(inputElement, {
    componentRestrictions: { country: 'jp' },
    fields: ['formatted_address'],
    language: 'ja',
    bounds,
    strictBounds: true,
  })
  inputElement._autocomplete = autocomplete

  injectPacContainerStyle()

  const listener = autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()
    if (place && place.formatted_address) {
      onPlaceChanged(place.formatted_address, place)
    }
  })

  return () => {
    if (listener && typeof listener.remove === 'function') {
      listener.remove()
    }
    if (inputElement._autocomplete) {
      window.google.maps.event.clearInstanceListeners(inputElement._autocomplete)
      delete inputElement._autocomplete
    }
  }
}

/**
 * Google Places API が準備できるまで待ってから取り付け、戻り値は cleanup 関数
 *
 * @param {() => HTMLInputElement|null} getInputElement - 遅延取得（モーダル open 直後に DOM が無い可能性に備える）
 * @param {(formattedAddress: string, place: google.maps.places.PlaceResult) => void} onPlaceChanged
 * @param {Object} [options]
 * @param {number} [options.initialDelayMs=500] - 初期化までの待機ミリ秒
 * @param {number} [options.pollIntervalMs=100] - Google API ロード待ちのポーリング間隔
 * @returns {() => void} cleanup 関数
 */
export function setupPlacesAutocomplete(getInputElement, onPlaceChanged, options = {}) {
  const { initialDelayMs = 500, pollIntervalMs = 100 } = options
  let cancelled = false
  let cleanup = () => {}
  let pollTimer = null

  const tryInit = () => {
    if (cancelled) return
    if (!isGooglePlacesReady()) {
      pollTimer = setTimeout(tryInit, pollIntervalMs)
      return
    }
    const input = resolveInputElement(getInputElement())
    if (!input) {
      // input が無い（モーダルが閉じた等）→ 諦める
      return
    }
    cleanup = attachPlacesAutocomplete(input, onPlaceChanged)
  }

  const initialTimer = setTimeout(tryInit, initialDelayMs)

  return () => {
    cancelled = true
    clearTimeout(initialTimer)
    if (pollTimer) clearTimeout(pollTimer)
    cleanup()
  }
}
