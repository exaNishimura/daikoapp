import JSZip from 'jszip'
import { getInvoiceFileUrl } from '@/services/billing/invoiceStorageService'

function safeFileName(s) {
  return String(s ?? '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
}

function baseName(filePath) {
  const i = filePath.lastIndexOf('/')
  return i >= 0 ? filePath.slice(i + 1) : filePath
}

/**
 * 複数の請求書 .pdf をまとめて zip に詰めてブラウザでダウンロードさせる。
 *
 * 各 file は { filePath, displayName? } の形式。
 * file_path が null のもの (発行はしたが Storage 失敗) は zip に含めず skipped で返す。
 *
 * @param {Array<{ filePath: string|null, displayName?: string }>} files
 * @param {string} zipName  保存ファイル名 (拡張子 .zip 不要)
 * @returns {Promise<{ included: number, skipped: number }>}
 */
export async function downloadInvoicesZip(files, zipName = 'invoices') {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('downloadInvoicesZip: files is empty')
  }

  const zip = new JSZip()
  let included = 0
  let skipped = 0

  for (const f of files) {
    if (!f?.filePath) {
      skipped += 1
      continue
    }
    const { data, error } = await getInvoiceFileUrl(f.filePath, 300)
    if (error || !data?.signedUrl) {
      skipped += 1
      continue
    }
    try {
      const res = await fetch(data.signedUrl)
      if (!res.ok) {
        skipped += 1
        continue
      }
      const buf = await res.arrayBuffer()
      const name = f.displayName ? `${safeFileName(f.displayName)}.pdf` : baseName(f.filePath)
      zip.file(name, buf)
      included += 1
    } catch {
      skipped += 1
    }
  }

  if (included === 0) {
    throw new Error('zip に含められたファイルが 0 件です')
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileName(zipName)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { included, skipped }
}
