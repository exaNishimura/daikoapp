/**
 * Google Places Autocomplete のセットアップ用ユーティリティ（新 Web Component 版）
 *
 * 旧 `google.maps.places.Autocomplete`（input 後付け型・非推奨）から
 * 新 `google.maps.places.PlaceAutocompleteElement`（Web Component）へ移行。
 *
 * 新要素は自前の input と候補ドロップダウンを持ち、位置管理も内部で行うため
 * モーダル内スクロールにドロップダウンが追従しない問題が構造的に解消される。
 */

// 三重県の bounds（県外候補をなるべく除外する）
const MIE_BOUNDS_SW = { lat: 33.7, lng: 135.8 } // 南牟婁郡
const MIE_BOUNDS_NE = { lat: 35.2, lng: 136.9 } // 桑名市周辺

/**
 * locationRestriction 用の LatLngBoundsLiteral を返す（strictBounds 相当）
 * @returns {google.maps.LatLngBoundsLiteral}
 */
export function getMieLocationRestriction() {
  return {
    south: MIE_BOUNDS_SW.lat,
    west: MIE_BOUNDS_SW.lng,
    north: MIE_BOUNDS_NE.lat,
    east: MIE_BOUNDS_NE.lng,
  }
}

/**
 * Google Maps JS API（importLibrary）がブラウザに用意されているか
 */
function isGoogleMapsBootstrapReady() {
  return Boolean(
    typeof window !== 'undefined' &&
      window.google &&
      window.google.maps &&
      typeof window.google.maps.importLibrary === 'function'
  )
}

/**
 * places ライブラリを読み込む。main.jsx でスクリプト注入済みだが、
 * モーダル open 直後などまだ bootstrap が終わっていない可能性に備えてポーリングで待つ。
 *
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=10000] - 諦めるまでの最大待機ミリ秒
 * @param {number} [options.pollIntervalMs=100] - ポーリング間隔
 * @returns {Promise<google.maps.PlacesLibrary|null>}
 */
export function importPlacesLibrary({ timeoutMs = 10000, pollIntervalMs = 100 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now()

    const tryImport = () => {
      if (isGoogleMapsBootstrapReady()) {
        window.google.maps
          .importLibrary('places')
          .then((lib) => resolve(lib))
          .catch(() => resolve(null))
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null)
        return
      }
      setTimeout(tryImport, pollIntervalMs)
    }

    tryImport()
  })
}

/**
 * `PlaceAutocompleteElement` を MUI OutlinedInput に合わせるスタイルを一度だけ <head> に注入する。
 *
 * 枠線・角丸は gmp-place-autocomplete ホストに付与（Google 公式 CSS プロパティ）。
 * 色・半径は `.places-autocomplete-host` の CSS 変数（MUI theme 由来）を参照する。
 */
export function injectPlaceAutocompleteStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('place-autocomplete-style-v6')) return

  document.getElementById('place-autocomplete-style-v3')?.remove()
  document.getElementById('place-autocomplete-style-v4')?.remove()
  document.getElementById('place-autocomplete-style-v5')?.remove()

  const style = document.createElement('style')
  style.id = 'place-autocomplete-style-v6'
  style.textContent = `
    .places-autocomplete-host gmp-place-autocomplete {
      width: 100%;
      box-sizing: border-box;
      display: block;
      border: 1px solid var(--places-border, rgba(0, 0, 0, 0.23));
      border-radius: var(--places-radius, 8px);
      background-color: transparent;
      font-family: inherit;
      transition:
        border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
        border-width 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .places-autocomplete-host:hover gmp-place-autocomplete {
      border-color: var(--places-border-hover, rgba(0, 0, 0, 0.87));
    }
    .places-autocomplete-host:focus-within gmp-place-autocomplete {
      border-color: var(--places-border-focus, #5b61e6);
      border-width: 2px;
    }
    .places-autocomplete-host[data-error="true"] gmp-place-autocomplete {
      border-color: var(--places-border-error, #dc2626);
    }
    .places-autocomplete-host[data-error="true"]:focus-within gmp-place-autocomplete {
      border-color: var(--places-border-error, #dc2626);
      border-width: 2px;
    }
    .places-autocomplete-host gmp-place-autocomplete::part(focus-ring) {
      display: none;
    }
    .places-autocomplete-host gmp-place-autocomplete::part(input) {
      box-sizing: border-box;
      width: 100%;
      background-color: transparent;
      border: none;
      outline: none;
      box-shadow: none;
      border-radius: inherit;
      padding: 16.5px 14px;
      font-size: 1rem;
      line-height: 1.4375em;
      font-family: inherit;
    }

    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete {
      color-scheme: light;
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(input) {
      color: rgba(0, 0, 0, 0.87);
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(prediction-list) {
      background-color: #ffffff;
      border: 1px solid #e3e7ec;
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(prediction-item) {
      background-color: #ffffff;
      color: #1f2733;
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(prediction-item-selected) {
      background-color: #f4f6f8;
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(prediction-item-main-text) {
      color: #1f2733;
    }
    .places-autocomplete-host[data-color-scheme="light"] gmp-place-autocomplete::part(prediction-item-secondary-text) {
      color: #6b7280;
    }

    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete {
      color-scheme: dark;
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(input) {
      color: rgba(255, 255, 255, 0.87);
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(prediction-list) {
      background-color: #2a2a2a;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(prediction-item) {
      background-color: #2a2a2a;
      color: rgba(255, 255, 255, 0.87);
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(prediction-item-selected) {
      background-color: #3a3a3a;
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(prediction-item-main-text) {
      color: rgba(255, 255, 255, 0.92);
    }
    .places-autocomplete-host[data-color-scheme="dark"] gmp-place-autocomplete::part(prediction-item-secondary-text) {
      color: rgba(255, 255, 255, 0.6);
    }
  `
  document.head.appendChild(style)
}
