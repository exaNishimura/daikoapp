import areaTownsData from '@/data/areaTowns.json'

export const AREA_PREFECTURE = '三重県'

export const AREA_CITIES = ['鈴鹿市', '亀山市', '四日市市', '津市']

/**
 * @param {typeof areaTownsData} [data]
 */
export function flattenAreaTowns(data = areaTownsData) {
  return AREA_CITIES.flatMap((city) =>
    (data.cities[city] ?? []).map((town) => ({
      id: `${city}:${town.name}`,
      city,
      name: town.name,
      kana: town.kana ?? '',
      zip: town.zip,
      address: `${AREA_PREFECTURE}${city}${town.name}`,
    }))
  )
}

export const AREA_TOWNS = flattenAreaTowns()

/**
 * @param {Array<{ id?: string, city: string, name: string, kana?: string }>} towns
 * @param {{ city?: string, query?: string, favoriteIds?: Set<string>|null }} [filters]
 */
export function filterAreaTowns(towns, { city, query, favoriteIds } = {}) {
  const needle = String(query ?? '')
    .trim()
    .toLowerCase()
  const favoritesOnly = favoriteIds != null
  return towns.filter((town) => {
    if (city && town.city !== city) return false
    if (favoritesOnly && !favoriteIds.has(town.id)) return false
    if (!needle) return true
    const kana = String(town.kana ?? '').toLowerCase()
    return town.name.toLowerCase().includes(needle) || kana.includes(needle)
  })
}

/**
 * @param {number|null|undefined} minutes
 */
export function getDurationBand(minutes) {
  if (minutes == null || Number.isNaN(minutes)) {
    return { key: 'unknown', label: '未計算', variant: 'neutral' }
  }
  if (minutes <= 15) return { key: 'near', label: '15分以内', variant: 'success' }
  if (minutes <= 30) return { key: 'mid', label: '30分以内', variant: 'accent' }
  if (minutes <= 45) return { key: 'far', label: '45分以内', variant: 'warning' }
  return { key: 'long', label: '45分超', variant: 'error' }
}

/**
 * @param {number|null|undefined} minutes
 */
export function formatDurationMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—'
  return `${minutes}分`
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} size
 */
export function chunkArray(items, size) {
  const out = []
  const step = Math.max(1, size)
  for (let i = 0; i < items.length; i += step) {
    out.push(items.slice(i, i + step))
  }
  return out
}

/**
 * 所要が短い順。未計算は末尾。同着は町名。
 * @param {Array<{ name: string, minutes?: number|null }>} towns
 */
export function sortTownsByDuration(towns) {
  return towns.toSorted((a, b) => {
    const aMin = a.minutes
    const bMin = b.minutes
    const aHas = aMin != null
    const bHas = bMin != null
    if (aHas !== bHas) return aHas ? -1 : 1
    if (aHas && bHas && aMin !== bMin) return aMin - bMin
    return a.name.localeCompare(b.name, 'ja')
  })
}

export const GOJUON_ROWS = [
  { key: 'a', label: 'あ' },
  { key: 'ka', label: 'か' },
  { key: 'sa', label: 'さ' },
  { key: 'ta', label: 'た' },
  { key: 'na', label: 'な' },
  { key: 'ha', label: 'は' },
  { key: 'ma', label: 'ま' },
  { key: 'ya', label: 'や' },
  { key: 'ra', label: 'ら' },
  { key: 'wa', label: 'わ' },
  { key: 'other', label: '他' },
]

const GOJUON_OTHER = GOJUON_ROWS[GOJUON_ROWS.length - 1]

const GOJUON_ROW_BY_KEY = new Map(GOJUON_ROWS.map((row) => [row.key, row]))

const SMALL_KATAKANA = {
  ァ: 'ア',
  ィ: 'イ',
  ゥ: 'ウ',
  ェ: 'エ',
  ォ: 'オ',
  ッ: 'ツ',
  ャ: 'ヤ',
  ュ: 'ユ',
  ョ: 'ヨ',
  ヮ: 'ワ',
  ヵ: 'カ',
  ヶ: 'ケ',
}

const GOJUON_BASE_TO_KEY = {
  ア: 'a',
  イ: 'a',
  ウ: 'a',
  エ: 'a',
  オ: 'a',
  ヴ: 'a',
  カ: 'ka',
  キ: 'ka',
  ク: 'ka',
  ケ: 'ka',
  コ: 'ka',
  ガ: 'ka',
  ギ: 'ka',
  グ: 'ka',
  ゲ: 'ka',
  ゴ: 'ka',
  サ: 'sa',
  シ: 'sa',
  ス: 'sa',
  セ: 'sa',
  ソ: 'sa',
  ザ: 'sa',
  ジ: 'sa',
  ズ: 'sa',
  ゼ: 'sa',
  ゾ: 'sa',
  タ: 'ta',
  チ: 'ta',
  ツ: 'ta',
  テ: 'ta',
  ト: 'ta',
  ダ: 'ta',
  ヂ: 'ta',
  ヅ: 'ta',
  デ: 'ta',
  ド: 'ta',
  ナ: 'na',
  ニ: 'na',
  ヌ: 'na',
  ネ: 'na',
  ノ: 'na',
  ハ: 'ha',
  ヒ: 'ha',
  フ: 'ha',
  ヘ: 'ha',
  ホ: 'ha',
  バ: 'ha',
  ビ: 'ha',
  ブ: 'ha',
  ベ: 'ha',
  ボ: 'ha',
  パ: 'ha',
  ピ: 'ha',
  プ: 'ha',
  ペ: 'ha',
  ポ: 'ha',
  マ: 'ma',
  ミ: 'ma',
  ム: 'ma',
  メ: 'ma',
  モ: 'ma',
  ヤ: 'ya',
  ユ: 'ya',
  ヨ: 'ya',
  ラ: 'ra',
  リ: 'ra',
  ル: 'ra',
  レ: 'ra',
  ロ: 'ra',
  ワ: 'wa',
  ヲ: 'wa',
  ン: 'wa',
}

function toKatakanaChar(ch) {
  const code = ch.codePointAt(0)
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCodePoint(code + 0x60)
  }
  return ch
}

/**
 * @param {string|null|undefined} kana
 */
export function getGojuonRow(kana) {
  const text = String(kana ?? '').trim()
  if (!text) return GOJUON_OTHER
  const first = toKatakanaChar([...text][0])
  const base = SMALL_KATAKANA[first] ?? first
  return GOJUON_ROW_BY_KEY.get(GOJUON_BASE_TO_KEY[base]) ?? GOJUON_OTHER
}

/**
 * @param {string} name
 * @param {string|null|undefined} kana
 */
export function formatTownNameWithKana(name, kana) {
  const reading = String(kana ?? '').trim()
  if (!reading) return name
  return `${name}（${reading}）`
}

/**
 * カナ順。同着は町名。
 * @param {Array<{ name: string, kana?: string }>} towns
 */
export function sortTownsByKana(towns) {
  return towns.toSorted((a, b) => {
    const kanaCmp = String(a.kana ?? '').localeCompare(String(b.kana ?? ''), 'ja')
    if (kanaCmp !== 0) return kanaCmp
    return a.name.localeCompare(b.name, 'ja')
  })
}

/**
 * @param {Array<{ name: string, kana?: string }>} towns
 */
export function groupTownsByGojuon(towns) {
  const buckets = new Map(GOJUON_ROWS.map((row) => [row.key, []]))
  for (const town of towns) {
    buckets.get(getGojuonRow(town.kana).key).push(town)
  }
  return GOJUON_ROWS.flatMap((row) => {
    const items = buckets.get(row.key)
    if (!items.length) return []
    return [{ ...row, towns: sortTownsByKana(items) }]
  })
}
