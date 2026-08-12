import { describe, expect, it } from 'vitest'
import { findUnseenHoldingUnits, parseSeenHoldingIds } from './holdingAlertStorage.js'

describe('parseSeenHoldingIds', () => {
  it('parses string array and ignores junk', () => {
    expect(parseSeenHoldingIds('["a","b"]')).toEqual(['a', 'b'])
    expect(parseSeenHoldingIds('[1,"c"]')).toEqual(['c'])
    expect(parseSeenHoldingIds('nope')).toEqual([])
  })
})

describe('findUnseenHoldingUnits', () => {
  it('returns only ids not in seen set', () => {
    const seen = new Set(['a'])
    const unseen = findUnseenHoldingUnits([{ id: 'a' }, { id: 'b' }, {}], seen)
    expect(unseen.map((u) => u.id)).toEqual(['b'])
  })
})
