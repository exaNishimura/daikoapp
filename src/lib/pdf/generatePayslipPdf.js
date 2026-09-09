/**
 * 給与明細 PDF (pdfmake)
 */

import pdfMakeModule from 'pdfmake/build/pdfmake'
import { loadJapaneseFontVfs, PDF_FONTS } from './fontLoader'
import { TAX_TABLE_LABELS, formatYen } from '@/lib/payroll/withholdingTax'
import { formatBillingMonth } from '@/components/Receivables/monthUtils'

const pdfMake = pdfMakeModule.default ?? pdfMakeModule

function yen(n) {
  return formatYen(n).replace('￥', '¥')
}

function buildDocDefinition(slip, employeeName) {
  const monthLabel = formatBillingMonth(slip.year_month)
  const taxLabel = TAX_TABLE_LABELS[slip.tax_table_type] || slip.tax_table_type

  const rows = [
    ['稼働時間', `${Number(slip.total_hours)} 時間`],
    ['時給', yen(slip.hourly_wage_snapshot)],
    ['基本給（時間×時給）', yen(slip.base_pay)],
    ['手当', yen(slip.allowance)],
    ['総支給額', yen(slip.gross_pay)],
    ['社会保険料控除', yen(slip.social_insurance)],
    ['基準額（控除後）', yen(slip.taxable_base)],
    [`源泉徴収税額（${taxLabel}）`, yen(slip.withholding_tax)],
    ['その他控除', yen(slip.other_deduction)],
    ['差引支給額', yen(slip.net_pay)],
  ]

  return {
    pageSize: 'A4',
    pageMargins: [48, 48, 48, 48],
    defaultStyle: {
      font: 'NotoSansJP',
      fontSize: 11,
    },
    content: [
      { text: '給与明細書', style: 'title', margin: [0, 0, 0, 16] },
      {
        columns: [
          { text: `対象月: ${monthLabel}`, width: '*' },
          { text: `氏名: ${employeeName}`, width: '*', alignment: 'right' },
        ],
        margin: [0, 0, 0, 20],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: rows.map(([label, value]) => [
            { text: label, border: [false, false, false, true], margin: [0, 6, 0, 6] },
            {
              text: value,
              alignment: 'right',
              border: [false, false, false, true],
              margin: [0, 6, 0, 6],
            },
          ]),
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#CCCCCC',
        },
      },
      slip.note
        ? {
            text: `メモ: ${slip.note}`,
            margin: [0, 24, 0, 0],
            color: '#555555',
            fontSize: 10,
          }
        : null,
      {
        text: '※ 源泉徴収税額は社内概算式によるものです。',
        margin: [0, 32, 0, 0],
        fontSize: 9,
        color: '#888888',
      },
    ].filter(Boolean),
    styles: {
      title: {
        fontSize: 18,
        bold: true,
      },
    },
  }
}

/**
 * @param {object} slip
 * @param {string} employeeName
 * @returns {Promise<ArrayBuffer>}
 */
export async function generatePayslipPdf(slip, employeeName) {
  const vfs = await loadJapaneseFontVfs()
  pdfMake.addVirtualFileSystem(vfs)
  pdfMake.setFonts(PDF_FONTS)
  const docDef = buildDocDefinition(slip, employeeName)
  const pdfDoc = pdfMake.createPdf(docDef)
  return pdfDoc.getBuffer()
}

/**
 * PDF をダウンロード
 */
export async function downloadPayslipPdf(slip, employeeName) {
  const buf = await generatePayslipPdf(slip, employeeName)
  const blob = new Blob([buf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ym = String(slip.year_month || '').slice(0, 7).replace('-', '')
  a.href = url
  a.download = `payslip-${ym}-${employeeName || 'employee'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
