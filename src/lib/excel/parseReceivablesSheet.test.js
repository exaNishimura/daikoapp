import { describe, expect, it } from 'vitest'
import { parseReceivablesSheet } from './parseReceivablesSheet'

const PERIOD = { year: 2026, month: 5 }

describe('parseReceivablesSheet', () => {
  it('parses a typical block (Tokumaru) from May 2026', () => {
    const rows = [
      ['2026年5月売掛記録', '', '', '', '合計¥104,000', 'OK', '合計¥0'],
      ['請求先', '日', '出発地', '到着地', '金額', '備考'],
      ['徳丸', '5日', '若松', '南江島', '¥2,000'],
      ['徳丸', '7日', '白子', '岸岡', '¥2,000'],
      ['徳丸', '7日', '白子', '平田', '¥5,000'],
      ['徳丸', '12日', '白子', '岸岡', '¥2,500', '待機料500円含む'],
      ['徳丸', '31日', '白子', '玉垣', '¥8,000', '土師-岸岡経由'],
      ['徳丸'], // 明細無し継続行
      [], // ブロック区切り
      ['三重パーツ', '7日', '住吉', '平田', '¥2,000'],
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.errors).toEqual([])
    expect(r.receivables).toHaveLength(6)

    const tokumaru = r.receivables.filter((x) => x.companyName === '徳丸')
    expect(tokumaru).toHaveLength(5)
    expect(tokumaru.reduce((s, x) => s + x.amount, 0)).toBe(19500)

    const tokumaru12 = tokumaru.find((x) => x.workDate.getDate() === 12)
    expect(tokumaru12).toMatchObject({
      departure: '白子',
      destination: '岸岡',
      amount: 2500,
      note: '待機料500円含む',
    })

    const mp = r.receivables.find((x) => x.companyName === '三重パーツ')
    expect(mp).toMatchObject({
      departure: '住吉',
      destination: '平田',
      amount: 2000,
    })
    expect(mp.workDate).toEqual(new Date(2026, 4, 7))
  })

  it('inherits company name across rows within a block', () => {
    const rows = [
      ['title'],
      ['請求先'],
      ['草深創建', '14日', '平田', '神戸', '¥2,000'],
      ['草深創建', '27日', '道伯', '神戸', '¥3,000'],
      ['草深創建', '27日', '道伯', '平田', '¥2,000'],
      ['草深創建', '27日', '平田', '末広南', '¥2,000'],
      ['草深創建'],
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.receivables).toHaveLength(4)
    expect(r.receivables.every((x) => x.companyName === '草深創建')).toBe(true)
  })

  it('records empty-block companies in seenCompanies', () => {
    const rows = [
      ['title'],
      ['請求先'],
      ['アステル塗健'], // 名前のみ × 4
      ['アステル塗健'],
      ['アステル塗健'],
      ['アステル塗健'],
      [], // ブロック区切り
      ['蝶々'], // 1 行のみで明細ゼロ
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.receivables).toHaveLength(0)
    expect(r.seenCompanies.has('アステル塗健')).toBe(true)
    expect(r.seenCompanies.has('蝶々')).toBe(true)
  })

  it('blank line resets the current company so the next entry needs a name', () => {
    const rows = [
      ['title'],
      ['請求先'],
      ['鈴友', '8日', '算所', '南旭が丘', '¥3,000'],
      [], // 区切り
      ['', '12日', '平田', '南旭が丘', '¥2,500'], // 名前なし → エラーにする
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.receivables).toHaveLength(1)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].field).toBe('companyName')
  })

  it('parses note with embedded full-width spaces unchanged', () => {
    const rows = [
      ['title'],
      ['請求先'],
      ['鈴友', '18日', '白子', '南旭が丘', '¥8,500', 'P1000円　一ノ宮経由'],
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.receivables[0].note).toBe('P1000円　一ノ宮経由')
    expect(r.receivables[0].amount).toBe(8500)
  })

  it('skips rows that have a company but no day or no amount', () => {
    const rows = [
      ['title'],
      ['請求先'],
      ['鈴友'], // empty continuation
      ['鈴友', '18日'], // no amount → skip
      ['鈴友', '', '', '', '¥3,000'], // no day → skip
    ]
    const r = parseReceivablesSheet(rows, PERIOD)
    expect(r.receivables).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })
})
