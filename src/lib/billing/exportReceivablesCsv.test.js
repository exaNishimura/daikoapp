import { describe, expect, it } from 'vitest'
import {
  RECEIVABLES_CSV_HEADERS,
  buildReceivablesCsv,
  escapeCsvField,
} from './exportReceivablesCsv'

describe('escapeCsvField', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
    expect(escapeCsvField('鈴友')).toBe('鈴友')
  })

  it('wraps values containing comma in quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('wraps values containing quote and escapes the quote', () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"')
  })

  it('wraps values containing newlines in quotes', () => {
    expect(escapeCsvField('a\nb')).toBe('"a\nb"')
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('coerces numbers and booleans to string', () => {
    expect(escapeCsvField(0)).toBe('0')
    expect(escapeCsvField(3000)).toBe('3000')
    expect(escapeCsvField(false)).toBe('false')
  })
})

describe('buildReceivablesCsv', () => {
  const rows = [
    {
      id: 1,
      work_date: '2026-05-15',
      billing_month: '2026-05-01',
      amount: 3000,
      departure: '白子',
      destination: '南旭が丘',
      note: '',
      invoice_id: null,
      companies: { name: '鈴友', invoice_display_name: '株式会社 鈴友' },
      invoices: null,
    },
    {
      id: 2,
      work_date: '2026-05-18',
      billing_month: '2026-05-01',
      amount: 8500,
      departure: '白子',
      destination: '南旭が丘',
      note: 'P1000円　一ノ宮経由',
      invoice_id: 99,
      companies: { name: '鈴友', invoice_display_name: '株式会社 鈴友' },
      invoices: { paid_at: '2026-06-15' },
    },
  ]

  it('starts with a UTF-8 BOM', () => {
    const csv = buildReceivablesCsv(rows)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('writes the header row followed by data rows', () => {
    const csv = buildReceivablesCsv(rows)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe(RECEIVABLES_CSV_HEADERS.join(','))
    expect(lines).toHaveLength(1 + rows.length + 1) // trailing newline
  })

  it('includes amount, work_date, company name, and note', () => {
    const csv = buildReceivablesCsv(rows)
    expect(csv).toContain('鈴友')
    expect(csv).toContain('3000')
    expect(csv).toContain('8500')
    expect(csv).toContain('2026-05-15')
    expect(csv).toContain('P1000円　一ノ宮経由')
  })

  it('reflects invoice / paid status as labels', () => {
    const csv = buildReceivablesCsv(rows)
    expect(csv).toContain('未請求')
    expect(csv).toContain('入金済')
  })

  it('handles empty input with header only', () => {
    const csv = buildReceivablesCsv([])
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe(RECEIVABLES_CSV_HEADERS.join(','))
    expect(lines).toHaveLength(2) // header + trailing newline
  })
})
