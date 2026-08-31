import { afterEach, describe, expect, it } from 'vitest'
import {
  clearFavoriteTownIds,
  loadFavoriteTownIds,
  parseTownId,
  saveFavoriteTownIds,
  setFavoriteTownId,
  townIdFromParts,
} from './travelTimeFavorites'

afterEach(() => {
  localStorage.clear()
})

describe('travelTimeFavorites', () => {
  it('round-trips ids and ignores invalid values', () => {
    saveFavoriteTownIds(['鈴鹿市:白子町', '', 1, '亀山市:東町'])
    expect(loadFavoriteTownIds()).toEqual(['鈴鹿市:白子町', '亀山市:東町'])
  })

  it('returns empty on corrupt json', () => {
    localStorage.setItem('travelTimeFavorites:v1', '{')
    expect(loadFavoriteTownIds()).toEqual([])
  })

  it('adds and removes a favorite', () => {
    expect(setFavoriteTownId([], '鈴鹿市:白子町', true)).toEqual(['鈴鹿市:白子町'])
    expect(setFavoriteTownId(['鈴鹿市:白子町'], '鈴鹿市:白子町', false)).toEqual([])
  })

  it('parses town ids', () => {
    expect(townIdFromParts('鈴鹿市', '白子町')).toBe('鈴鹿市:白子町')
    expect(parseTownId('鈴鹿市:白子町')).toEqual({ city: '鈴鹿市', name: '白子町' })
    expect(parseTownId('invalid')).toBeNull()
  })

  it('clears stored favorites', () => {
    saveFavoriteTownIds(['鈴鹿市:白子町'])
    clearFavoriteTownIds()
    expect(loadFavoriteTownIds()).toEqual([])
  })
})
