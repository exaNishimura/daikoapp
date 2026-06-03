/**
 * generateInvoicePdf の入力バリデーションのみテストする。
 * 実 PDF レンダリングは pdfmake + 日本語フォント vfs (browser fetch) に依存するため
 * Node 環境ではフルレンダの検証はせず、validation の throw だけ確認。
 */

import { describe, it, expect, vi } from 'vitest'

// pdfmake は ESM 不整合で Node 上で import しただけでも壊れるためモック化
vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    addVirtualFileSystem: vi.fn(),
    setFonts: vi.fn(),
    createPdf: vi.fn(() => ({
      getBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]), // "%PDF"
    })),
  },
}))

vi.mock('@/assets/seal.png?url', () => ({ default: 'mock-seal.png' }))

vi.mock('./fontLoader', () => ({
  loadJapaneseFontVfs: vi.fn(async () => ({})),
  PDF_FONTS: { NotoSansJP: { normal: '', bold: '' } },
}))

// fetch は seal の取得で呼ばれるのでモック (空 PNG)
const originalFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(0),
  }))
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

const { generateInvoicePdf } = await import('./generateInvoicePdf')

describe('generateInvoicePdf', () => {
  it('rejects more than INVOICE_MAX_LINES lines', async () => {
    const { INVOICE_MAX_LINES: MAX } = await import('@/lib/billing/invoiceLineStrategies')
    const lines = Array.from({ length: MAX + 1 }, () => ({
      workDate: new Date(2026, 4, 1),
      departure: 'a',
      destination: 'b',
      amount: 1000,
      note: null,
    }))
    await expect(
      generateInvoicePdf(
        {
          issueDate: new Date(2026, 4, 31),
          companyDisplayName: 'X',
          totalAmount: (MAX + 1) * 1000,
          lines,
        },
        { profile: {} }
      )
    ).rejects.toThrow(new RegExp(`exceeds ${MAX}`))
  })

  it('rejects total mismatch', async () => {
    await expect(
      generateInvoicePdf(
        {
          issueDate: new Date(2026, 4, 31),
          companyDisplayName: 'X',
          totalAmount: 99999,
          lines: [
            {
              workDate: new Date(2026, 4, 1),
              departure: 'a',
              destination: 'b',
              amount: 1000,
              note: null,
            },
          ],
        },
        { profile: {} }
      )
    ).rejects.toThrow(/totalAmount mismatch/)
  })

  it('rejects non-array lines', async () => {
    await expect(
      generateInvoicePdf(
        { issueDate: new Date(), companyDisplayName: 'X', totalAmount: 0, lines: null },
        { profile: {} }
      )
    ).rejects.toThrow(/lines must be an array/)
  })
})
