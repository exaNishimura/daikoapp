/**
 * generateInvoicePdf の入力バリデーションのみテストする。
 * 実 PDF レンダリングは pdfmake + 日本語フォント vfs (browser fetch) に依存するため
 * Node 環境ではフルレンダの検証はせず、validation の throw だけ確認。
 */

import { describe, it, expect, vi } from 'vitest'

// pdfmake は ESM 不整合で Node 上で import しただけでも壊れるためモック化
vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    createPdf: vi.fn(() => ({
      getBuffer: (cb) => cb(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // "%PDF"
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
  it('rejects more than 18 lines', async () => {
    const lines = Array.from({ length: 19 }, () => ({
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
          totalAmount: 19000,
          lines,
        },
        { profile: {} }
      )
    ).rejects.toThrow(/exceeds 18/)
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
