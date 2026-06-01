/**
 * 住所文字列の整形ユーティリティ
 *
 * Google Places API が返す住所は「日本、〒123-4567 東京都千代田区...」のような
 * 形式が多い。UI 表示では市以降だけ見せたいため、頭から不要な接頭辞を削るのが
 * このモジュールの責務。
 */

const PREFIX_NIHON_WITH_COMMA = '日本、'
const PREFIX_NIHON = '日本'

const POSTAL_CODE_PATTERN = /^〒?\d{3}-?\d{4}\s*/

const PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
]

/**
 * 「日本、」「〒123-4567」「東京都」等の接頭辞を削除して市以降を取り出す
 * @param {string|null|undefined} address - 整形前の住所
 * @returns {string} 整形後の住所（入力が空なら空文字）
 */
export function getAddressFromCity(address) {
  if (!address) return ''

  let result = String(address)

  if (result.startsWith(PREFIX_NIHON_WITH_COMMA)) {
    result = result.substring(PREFIX_NIHON_WITH_COMMA.length)
  } else if (result.startsWith(PREFIX_NIHON)) {
    result = result.substring(PREFIX_NIHON.length)
  }

  result = result.replace(POSTAL_CODE_PATTERN, '')

  for (const prefecture of PREFECTURES) {
    if (result.startsWith(prefecture)) {
      result = result.substring(prefecture.length)
      break
    }
  }

  result = result.replace(/^[、\s]+/, '')

  return result.trim()
}

/**
 * 市以降の住所を最大文字数で切り詰めて末尾に「…」風のマーカーを付ける
 * @param {string|null|undefined} address - 整形前の住所
 * @param {number} maxLength - 最大文字数（デフォルト 20）
 * @returns {string} 切り詰め済みの住所
 */
export function shortenAddress(address, maxLength = 20) {
  const fromCity = getAddressFromCity(address)
  if (fromCity.length <= maxLength) return fromCity
  return fromCity.substring(0, maxLength) + '...'
}
