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
 * `PlaceAutocompleteElement` をダークテーマに寄せるスタイルを一度だけ <head> に注入する。
 *
 * MUI OutlinedInput（暗色）に見た目を近づける。候補リストは color-scheme: dark で
 * ブラウザ／要素側にダーク描画を促しつつ、::part で細部を調整。
 */
export function injectPlaceAutocompleteStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('place-autocomplete-style-v3')) return

  const style = document.createElement('style')
  style.id = 'place-autocomplete-style-v3'
  style.textContent = `
    gmp-place-autocomplete {
      width: 100%;
      /* UA のダークスキーム（黒描画）を無効化。背景・文字色は下で明示する */
      color-scheme: light;
      /* 要素ホストの背景を透明にし、下の MUI Paper(#2a2a2a) を透けさせる */
      background-color: transparent;
      font-family: inherit;
    }
    gmp-place-autocomplete::part(input) {
      box-sizing: border-box;
      width: 100%;
      background-color: transparent;
      color: rgba(255, 255, 255, 0.87);
      border: 1px solid rgba(255, 255, 255, 0.23);
      border-radius: 8px;
      padding: 16.5px 14px;
      font-size: 1rem;
      line-height: 1.4375em;
      font-family: inherit;
    }
    gmp-place-autocomplete::part(input):hover {
      border-color: rgba(255, 255, 255, 0.87);
    }
    gmp-place-autocomplete::part(input):focus {
      border-color: #646cff;
      outline: 1px solid #646cff;
      outline-offset: -1px;
    }
    /* 候補ドロップダウンのコンテナ（ここも既定だと黒くなる） */
    gmp-place-autocomplete::part(prediction-list) {
      background-color: #2a2a2a;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    gmp-place-autocomplete::part(prediction-item) {
      background-color: #2a2a2a;
      color: rgba(255, 255, 255, 0.87);
    }
    gmp-place-autocomplete::part(prediction-item-selected) {
      background-color: #3a3a3a;
    }
    gmp-place-autocomplete::part(prediction-item-main-text) {
      color: rgba(255, 255, 255, 0.92);
    }
    gmp-place-autocomplete::part(prediction-item-secondary-text) {
      color: rgba(255, 255, 255, 0.6);
    }
  `
  document.head.appendChild(style)
}
