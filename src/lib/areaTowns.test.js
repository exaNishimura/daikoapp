import { describe, expect, it } from 'vitest'
import {
  AREA_CITIES,
  chunkArray,
  filterAreaTowns,
  flattenAreaTowns,
  formatDurationMinutes,
  formatTownNameWithKana,
  getDurationBand,
  getGojuonRow,
  groupTownsByGojuon,
  sortTownsByDuration,
  sortTownsByKana,
} from './areaTowns'

const SAMPLE = {
  cities: {
    鈴鹿市: [{ name: '白子町', kana: 'シラコチョウ', zip: '510-0241' }],
    亀山市: [{ name: '東町', kana: 'ヒガシチョウ', zip: '519-0155' }],
    四日市市: [{ name: '諏訪町', kana: 'スワチョウ', zip: '510-0086' }],
    津市: [{ name: '大門', kana: 'ダイモン', zip: '514-0027' }],
  },
}

describe('flattenAreaTowns', () => {
  it('builds address and id per city', () => {
    const towns = flattenAreaTowns(SAMPLE)
    expect(towns).toHaveLength(4)
    expect(towns[0]).toMatchObject({
      id: '鈴鹿市:白子町',
      city: '鈴鹿市',
      name: '白子町',
      address: '三重県鈴鹿市白子町',
    })
  })
})

describe('filterAreaTowns', () => {
  const towns = flattenAreaTowns(SAMPLE)

  it('filters by city', () => {
    expect(filterAreaTowns(towns, { city: '亀山市' }).map((t) => t.name)).toEqual(['東町'])
  })

  it('filters by name or kana', () => {
    expect(filterAreaTowns(towns, { query: 'シラコ' }).map((t) => t.name)).toEqual(['白子町'])
    expect(filterAreaTowns(towns, { query: '大門' }).map((t) => t.city)).toEqual(['津市'])
  })

  it('filters to favorites when a set is passed', () => {
    const favoriteIds = new Set(['鈴鹿市:白子町'])
    expect(filterAreaTowns(towns, { favoriteIds }).map((t) => t.name)).toEqual(['白子町'])
    expect(filterAreaTowns(towns, { city: '鈴鹿市', favoriteIds: new Set() })).toEqual([])
  })
})

describe('duration helpers', () => {
  it('bands minutes', () => {
    expect(getDurationBand(10).key).toBe('near')
    expect(getDurationBand(20).key).toBe('mid')
    expect(getDurationBand(40).key).toBe('far')
    expect(getDurationBand(50).key).toBe('long')
    expect(getDurationBand(null).key).toBe('unknown')
  })

  it('formats minutes', () => {
    expect(formatDurationMinutes(12)).toBe('12分')
    expect(formatDurationMinutes(null)).toBe('—')
  })
})

describe('sortTownsByDuration', () => {
  it('puts shorter first and unknowns last', () => {
    const sorted = sortTownsByDuration([
      { name: 'B町', minutes: 30 },
      { name: 'C町', minutes: null },
      { name: 'A町', minutes: 10 },
    ])
    expect(sorted.map((t) => t.name)).toEqual(['A町', 'B町', 'C町'])
  })
})

describe('chunkArray', () => {
  it('splits into batches', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('AREA_CITIES', () => {
  it('covers the four target cities', () => {
    expect(AREA_CITIES).toEqual(['鈴鹿市', '亀山市', '四日市市', '津市'])
  })
})

describe('AREA_TOWNS', () => {
  it('loads extracted towns from postal data', async () => {
    const { AREA_TOWNS } = await import('./areaTowns')
    expect(AREA_TOWNS).toHaveLength(820)
    expect(AREA_TOWNS[0].address).toMatch(/^三重県/)
  })
})

describe('gojuon helpers', () => {
  it('maps kana to 50-sound rows including dakuten', () => {
    expect(getGojuonRow('アコソチョウ').label).toBe('あ')
    expect(getGojuonRow('ガマガオリ').label).toBe('か')
    expect(getGojuonRow('シロコチョウ').label).toBe('さ')
    expect(getGojuonRow('ダイモン').label).toBe('た')
    expect(getGojuonRow('ヒガシチョウ').label).toBe('は')
    expect(getGojuonRow('ヤスヅカチョウ').label).toBe('や')
    expect(getGojuonRow('ワカヤマチョウ').label).toBe('わ')
    expect(getGojuonRow('ン').label).toBe('わ')
    expect(getGojuonRow('').label).toBe('他')
  })

  it('formats town names with furigana', () => {
    expect(formatTownNameWithKana('白子町', 'シロコチョウ')).toBe('白子町（シロコチョウ）')
    expect(formatTownNameWithKana('白子町', '')).toBe('白子町')
  })

  it('groups towns by gojuon and sorts by kana', () => {
    const grouped = groupTownsByGojuon([
      { name: '白子町', kana: 'シロコチョウ' },
      { name: '阿古曽町', kana: 'アコソチョウ' },
      { name: '磯山', kana: 'イソヤマ' },
    ])
    expect(grouped.map((g) => g.label)).toEqual(['あ', 'さ'])
    expect(grouped[0].towns.map((t) => t.name)).toEqual(['阿古曽町', '磯山'])
  })

  it('classifies extracted towns into gojuon rows', async () => {
    const { AREA_TOWNS } = await import('./areaTowns')
    const other = AREA_TOWNS.filter((town) => getGojuonRow(town.kana).key === 'other')
    expect(other).toEqual([])
  })
})

describe('sortTownsByKana', () => {
  it('sorts by kana then name', () => {
    const sorted = sortTownsByKana([
      { name: '白子町', kana: 'シロコチョウ' },
      { name: '阿古曽町', kana: 'アコソチョウ' },
    ])
    expect(sorted.map((t) => t.name)).toEqual(['阿古曽町', '白子町'])
  })
})
