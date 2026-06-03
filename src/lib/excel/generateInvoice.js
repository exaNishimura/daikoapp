/**
 * 請求書 .xlsx の生成 (純関数、副作用は ExcelJS 内部のみ)。
 *
 * テンプレ `src/assets/invoice-template.xlsx` を読み込み、以下のセルに値を埋める:
 *
 *   (0-indexed)  | ExcelJS (1-indexed) | 内容
 *   -------------+---------------------+------------------------------------
 *   (2, 7)       | C8/H3                | 請求日 "YYYY年M月D日"
 *   (4, 1)       | B5                   | 取引先名 (invoice_display_name)
 *   (9, 4)       | E10                  | 請求金額合計 "¥XX,XXX- "
 *   (12+i, 1..7) | (B..H)13+i           | 明細行 (最大 18 件)
 *
 * 明細列:
 *   col 1 No.        "1 " 形式 (半角スペース付き)
 *   col 2 日付       "M月D日" (年は付けない / 列幅で ######## 化するため)
 *   col 3 内容       "運転代行" 固定
 *   col 4 出発地
 *   col 5 到着地
 *   col 6 料金       "¥X,XXX"
 *   col 7 備考
 *
 * 18 件超は呼び出し側で「合算 / 分割 / スキップ」を選択する責務とし、
 * このモジュールは超過時に `Error("invoice line count exceeds 18")` を投げる。
 */

import ExcelJS from 'exceljs'

export const INVOICE_MAX_LINES = 18
const TEMPLATE_SHEET = '請求書'

/**
 * @typedef {Object} InvoiceLineInput
 * @property {Date}        workDate
 * @property {string|null} departure
 * @property {string|null} destination
 * @property {number}      amount
 * @property {string|null} note
 */

/**
 * @typedef {Object} InvoiceData
 * @property {Date}                issueDate           請求日 (通常は対象月の月末日)
 * @property {string}              companyDisplayName  請求書に刷り込む取引先名
 * @property {number}              totalAmount         明細合計 (検算用、自動計算と一致するか検証)
 * @property {InvoiceLineInput[]}  lines
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {ArrayBuffer | Uint8Array | Buffer} templateBuffer
 *   `src/assets/invoice-template.xlsx` を呼び出し側で読んで渡す。
 *   (Vite 環境では `import templateUrl from '@/assets/invoice-template.xlsx?url'` で取得して fetch)
 */

/**
 * 請求書 .xlsx をバイナリ (ArrayBuffer) として生成する。
 *
 * @param {InvoiceData} data
 * @param {GenerateOptions} options
 * @returns {Promise<ArrayBuffer>}
 */
export async function generateInvoice(data, options) {
  if (!options?.templateBuffer) {
    throw new Error('generateInvoice: templateBuffer is required')
  }
  if (!Array.isArray(data?.lines)) {
    throw new Error('generateInvoice: data.lines must be an array')
  }
  if (data.lines.length > INVOICE_MAX_LINES) {
    throw new Error(
      `generateInvoice: invoice line count ${data.lines.length} exceeds ${INVOICE_MAX_LINES}`
    )
  }

  const sumLines = data.lines.reduce((s, l) => s + (l.amount ?? 0), 0)
  if (data.totalAmount !== sumLines) {
    throw new Error(
      `generateInvoice: totalAmount mismatch (input=${data.totalAmount}, sum=${sumLines})`
    )
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(options.templateBuffer)
  const ws = wb.getWorksheet(TEMPLATE_SHEET)
  if (!ws) {
    throw new Error(`generateInvoice: sheet "${TEMPLATE_SHEET}" not found in template`)
  }

  // テンプレ側に numFmt が設定されているので、Date / 数値そのものを書き込む。
  // 文字列で入れると書式が再適用されず、リファレンス手動版と型が合わなくなる。

  // 請求日 (2, 7) → ExcelJS (3, 8) : Date / numFmt "yyyy年m月d日"
  ws.getCell(3, 8).value = data.issueDate

  // 取引先名 (4, 1) → ExcelJS (5, 2) : 文字列
  ws.getCell(5, 2).value = data.companyDisplayName ?? ''

  // 合計 (9, 4) → ExcelJS (10, 5) : 数値 / numFmt "¥#,##0-_ "
  ws.getCell(10, 5).value = data.totalAmount

  // 明細 (12+i, 1..7) → ExcelJS (13+i, 2..8)
  // No. (col 2) はテンプレに 1〜18 が既に書かれているので触らない。
  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i]
    const r = 13 + i
    const dateCell = ws.getCell(r, 3)
    dateCell.value = line.workDate
    // テンプレの numFmt は "yyyy年mm月dd日" だが列幅で ######## になるので
    // 年なしに上書き。
    dateCell.numFmt = 'm"月"d"日"'
    ws.getCell(r, 4).value = '運転代行'
    ws.getCell(r, 5).value = line.departure ?? ''
    ws.getCell(r, 6).value = line.destination ?? ''
    ws.getCell(r, 7).value = line.amount
    ws.getCell(r, 8).value = line.note ?? ''
  }

  // 残り明細行 (使わなかった部分) は値を null にして空白化する。
  // No. 列は触らない (テンプレ表示を維持)。
  for (let i = data.lines.length; i < INVOICE_MAX_LINES; i++) {
    const r = 13 + i
    for (let c = 3; c <= 8; c++) {
      ws.getCell(r, c).value = null
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return buf
}
