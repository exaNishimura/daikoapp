import { describe, expect, it } from 'vitest'
import { getAddressFromCity, shortenAddress } from './addressUtils'

describe('getAddressFromCity', () => {
  it('returns empty string for null/undefined/empty input', () => {
    expect(getAddressFromCity(null)).toBe('')
    expect(getAddressFromCity(undefined)).toBe('')
    expect(getAddressFromCity('')).toBe('')
  })

  it('strips "日本、" prefix', () => {
    expect(getAddressFromCity('日本、東京都千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })

  it('strips "日本" prefix without comma', () => {
    expect(getAddressFromCity('日本東京都千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })

  it('strips Japanese postal code with prefix mark', () => {
    expect(getAddressFromCity('〒100-0005 東京都千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })

  it('strips postal code without prefix mark', () => {
    expect(getAddressFromCity('100-0005 東京都千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })

  it('strips combined "日本、〒... 東京都" prefix', () => {
    expect(getAddressFromCity('日本、〒100-0005 東京都千代田区丸の内1-1')).toBe(
      '千代田区丸の内1-1'
    )
  })

  it('strips Hokkaido without "県" suffix mismatch', () => {
    expect(getAddressFromCity('北海道札幌市中央区')).toBe('札幌市中央区')
  })

  it('strips 京都府 / 大阪府', () => {
    expect(getAddressFromCity('京都府京都市中京区')).toBe('京都市中京区')
    expect(getAddressFromCity('大阪府大阪市北区')).toBe('大阪市北区')
  })

  it('returns address as-is when no recognized prefix exists', () => {
    expect(getAddressFromCity('千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })

  it('trims leading "、" and whitespace', () => {
    expect(getAddressFromCity('日本、東京都、 千代田区丸の内1-1')).toBe('千代田区丸の内1-1')
  })
})

describe('shortenAddress', () => {
  it('returns full address when within max length', () => {
    expect(shortenAddress('日本、東京都千代田区丸の内', 20)).toBe('千代田区丸の内')
  })

  it('truncates and appends ellipsis when exceeding max length', () => {
    const result = shortenAddress('日本、東京都千代田区丸の内1丁目1番1号', 10)
    expect(result.endsWith('...')).toBe(true)
    expect(result.length).toBe(10 + 3)
  })

  it('uses 20 chars as default maxLength', () => {
    const long = '日本、東京都' + 'あ'.repeat(30)
    const result = shortenAddress(long)
    expect(result.length).toBe(20 + 3)
  })

  it('returns empty for empty input', () => {
    expect(shortenAddress(null)).toBe('')
  })
})
