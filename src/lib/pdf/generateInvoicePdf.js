/**
 * 請求書 PDF 生成 (pdfmake / 純クライアント)。
 *
 * テンプレ Excel (`src/assets/invoice-template.xlsx`) の見た目を pdfmake の
 * docDefinition で再現する。日本語フォントは Noto Sans JP を vfs 経由で埋め込み。
 *
 * 入力:
 *   - issueDate: Date
 *   - companyDisplayName: string  (請求書中央に「御中」付きで表示)
 *   - totalAmount: number  (税込合計、検算用)
 *   - lines: [{ workDate, departure, destination, amount, note }]
 *   - profile: company_profile 行 (自社情報)
 */

import pdfMakeModule from 'pdfmake/build/pdfmake'
import sealUrl from '@/assets/seal.png?url'
import { INVOICE_MAX_LINES } from '@/lib/billing/invoiceLineStrategies'
import { loadJapaneseFontVfs, PDF_FONTS } from './fontLoader'

const pdfMake = pdfMakeModule.default ?? pdfMakeModule

export { INVOICE_MAX_LINES }

const COLOR = {
  bannerBg: '#1F3864',
  totalBoxBg: '#1F3864',
  tableHeader: '#2F5496',
  stripe: '#DEEBF7',
  light: '#EAF1F8',
}

// =============================================================================
// formatters
// =============================================================================

function formatJpDate(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatLineDate(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatYen(n) {
  if (n == null) return ''
  return `¥${Number(n).toLocaleString('ja-JP')}`
}

// =============================================================================
// asset loaders (cache in memory)
// =============================================================================

let cachedSealDataUri = null
async function loadSealDataUri() {
  if (cachedSealDataUri) return cachedSealDataUri
  const res = await fetch(sealUrl)
  if (!res.ok) throw new Error(`failed to fetch seal image: ${res.status}`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  cachedSealDataUri = `data:image/png;base64,${btoa(binary)}`
  return cachedSealDataUri
}

// =============================================================================
// docDefinition builder
// =============================================================================

function buildLineRows(lines) {
  const rows = []
  for (let i = 0; i < INVOICE_MAX_LINES; i++) {
    const line = lines[i]
    const fill = i % 2 === 0 ? null : COLOR.light
    rows.push([
      { text: String(i + 1), alignment: 'center', fillColor: fill, fontSize: 9 },
      {
        text: line ? formatLineDate(line.workDate) : '',
        alignment: 'center',
        fillColor: fill,
        fontSize: 9,
      },
      {
        text: line ? '運転代行' : '',
        alignment: 'center',
        fillColor: fill,
        fontSize: 9,
      },
      {
        text: line?.departure ?? '',
        alignment: 'center',
        fillColor: fill,
        fontSize: 9,
      },
      {
        text: line?.destination ?? '',
        alignment: 'center',
        fillColor: fill,
        fontSize: 9,
      },
      {
        text: line ? formatYen(line.amount) : '',
        alignment: 'right',
        fillColor: fill,
        fontSize: 9,
      },
      {
        text: line?.note ?? '',
        alignment: 'left',
        fillColor: fill,
        fontSize: 9,
      },
    ])
  }
  return rows
}

function buildDocDefinition({ data, profile, sealDataUri }) {
  const totalAmount = Number(data.totalAmount) || 0
  const beforeTax = Math.ceil(totalAmount / 1.1)
  const tax = totalAmount - beforeTax

  return {
    pageSize: 'A4',
    pageMargins: [32, 28, 32, 28],

    content: [
      // -------- Header banner --------
      {
        table: {
          widths: [220, '*'],
          body: [
            [
              {
                text: '請　求　書',
                fillColor: COLOR.bannerBg,
                color: '#FFFFFF',
                bold: true,
                fontSize: 22,
                alignment: 'center',
                margin: [0, 8, 0, 8],
              },
              {
                text: `請求日：${formatJpDate(data.issueDate)}`,
                alignment: 'right',
                fontSize: 10,
                margin: [0, 18, 4, 0],
              },
            ],
          ],
        },
        layout: 'noBorders',
      },

      // -------- Customer + Vendor info --------
      {
        margin: [0, 12, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: data.companyDisplayName, fontSize: 16 },
                  { text: '   御中', fontSize: 12 },
                ],
                alignment: 'center',
                margin: [0, 14, 0, 0],
                decoration: 'underline',
              },
            ],
          },
          {
            width: 220,
            stack: [
              { text: profile?.name ?? '', bold: true, fontSize: 11 },
              { text: `〒 ${profile?.postal_code ?? ''}`, fontSize: 9 },
              { text: profile?.address ?? '', fontSize: 9 },
              {
                text: `登録番号：${profile?.invoice_number ?? ''}`,
                fontSize: 9,
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      },

      // -------- Seal image overlay --------
      {
        image: sealDataUri,
        width: 52,
        absolutePosition: { x: 470, y: 78 },
      },

      // -------- Greeting --------
      {
        text: '毎度ありがとうございます。',
        fontSize: 9,
        margin: [0, 16, 0, 0],
      },
      {
        text: '下記の通りご請求申し上げます。',
        fontSize: 9,
        margin: [0, 0, 0, 6],
      },

      // -------- Total amount box --------
      {
        table: {
          widths: [140, '*'],
          body: [
            [
              {
                text: '請求金額',
                fillColor: COLOR.totalBoxBg,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 13,
                bold: true,
                margin: [0, 6, 0, 6],
              },
              {
                text: `${formatYen(totalAmount)}-`,
                fontSize: 18,
                bold: true,
                alignment: 'center',
                margin: [0, 4, 0, 0],
              },
            ],
          ],
        },
        layout: 'noBorders',
      },

      // -------- Lines table --------
      {
        margin: [0, 8, 0, 0],
        table: {
          headerRows: 1,
          widths: [22, 60, 50, 80, 80, 70, '*'],
          body: [
            [
              {
                text: 'No.',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '日付',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '内容',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '出発地',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '到着地',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '料金（税込）',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
              {
                text: '備考',
                fillColor: COLOR.tableHeader,
                color: '#FFFFFF',
                alignment: 'center',
                fontSize: 9,
                bold: true,
              },
            ],
            ...buildLineRows(data.lines ?? []),
          ],
        },
        layout: {
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => '#9FB7D6',
          vLineColor: () => '#9FB7D6',
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },

      // -------- Tax breakdown --------
      {
        margin: [0, 6, 0, 0],
        columns: [
          { width: '*', text: '' },
          {
            width: 230,
            table: {
              widths: ['*', 90],
              body: [
                [
                  {
                    text: '合計金額',
                    fillColor: COLOR.stripe,
                    alignment: 'right',
                    fontSize: 10,
                    bold: true,
                  },
                  {
                    text: formatYen(totalAmount),
                    alignment: 'right',
                    fontSize: 10,
                    bold: true,
                  },
                ],
                [
                  {
                    text: 'うち消費税(10%)',
                    fillColor: COLOR.stripe,
                    alignment: 'right',
                    fontSize: 10,
                  },
                  { text: formatYen(tax), alignment: 'right', fontSize: 10 },
                ],
                [
                  {
                    text: '本体価格',
                    fillColor: COLOR.stripe,
                    alignment: 'right',
                    fontSize: 10,
                  },
                  {
                    text: formatYen(beforeTax),
                    alignment: 'right',
                    fontSize: 10,
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => '#9FB7D6',
              vLineColor: () => '#9FB7D6',
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
          },
        ],
      },

      // -------- Remarks --------
      { text: '備考欄', fontSize: 8, margin: [0, 16, 0, 0] },

      // -------- Bank info --------
      {
        margin: [0, 16, 0, 0],
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 530,
            y2: 0,
            lineWidth: 0.5,
            lineColor: '#999999',
          },
        ],
      },
      {
        text: 'お支払いは現金、または下記の口座にお振込みください',
        fontSize: 9,
        margin: [0, 6, 0, 2],
      },
      {
        text: `${profile?.bank ?? ''}　${profile?.bank_branch ?? ''}　${profile?.bank_account_type ?? ''} ${profile?.bank_account_number ?? ''}　口座名義：${profile?.bank_account_holder ?? ''}`,
        fontSize: 9,
      },
    ],

    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 9,
    },
  }
}

// =============================================================================
// public API
// =============================================================================

/**
 * 請求書 PDF をバイナリ (ArrayBuffer) で生成する。
 *
 * @param {{
 *   issueDate: Date,
 *   companyDisplayName: string,
 *   totalAmount: number,
 *   lines: Array<{ workDate: Date, departure: string|null, destination: string|null, amount: number, note: string|null }>
 * }} data
 * @param {{ profile: object }} options  自社情報 (company_profile 行)
 * @returns {Promise<ArrayBuffer>}
 */
export async function generateInvoicePdf(data, options) {
  if (!Array.isArray(data?.lines)) {
    throw new Error('generateInvoicePdf: data.lines must be an array')
  }
  if (data.lines.length > INVOICE_MAX_LINES) {
    throw new Error(
      `generateInvoicePdf: invoice line count ${data.lines.length} exceeds ${INVOICE_MAX_LINES}`
    )
  }
  const sumLines = data.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  if (Number(data.totalAmount) !== sumLines) {
    throw new Error(
      `generateInvoicePdf: totalAmount mismatch (input=${data.totalAmount}, sum=${sumLines})`
    )
  }

  const tAssets = performance.now()
  const [vfs, sealDataUri] = await Promise.all([
    loadJapaneseFontVfs(),
    loadSealDataUri(),
  ])
  console.log(`[generateInvoicePdf] assets ready in ${Math.round(performance.now() - tAssets)}ms`)

  // pdfmake 0.3.x API: vfs/fonts はメソッド経由で登録する
  // (`pdfMake.vfs = ...` は内部の VirtualFileSystem インスタンスを差し替えないため効かない)
  pdfMake.addVirtualFileSystem(vfs)
  pdfMake.setFonts(PDF_FONTS)

  const docDef = buildDocDefinition({
    data,
    profile: options?.profile ?? {},
    sealDataUri,
  })

  const tCreate = performance.now()
  const pdfDoc = pdfMake.createPdf(docDef)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('generateInvoicePdf: getBuffer timed out after 60s'))
    }, 60000)
    try {
      pdfDoc.getBuffer((buffer) => {
        clearTimeout(timeout)
        console.log(
          `[generateInvoicePdf] getBuffer done in ${Math.round(performance.now() - tCreate)}ms ` +
            `(${buffer ? buffer.byteLength : 0} bytes)`
        )
        if (!buffer) {
          reject(new Error('generateInvoicePdf: getBuffer returned empty'))
          return
        }
        const ab =
          buffer.buffer instanceof ArrayBuffer
            ? buffer.buffer.slice(
                buffer.byteOffset ?? 0,
                (buffer.byteOffset ?? 0) + buffer.byteLength
              )
            : buffer
        resolve(ab)
      })
    } catch (err) {
      clearTimeout(timeout)
      console.error('[generateInvoicePdf] createPdf/getBuffer threw:', err)
      reject(err)
    }
  })
}
