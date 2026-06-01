import { supabase } from '@/lib/supabase'

/**
 * Supabase Storage の `invoices` バケット操作。
 *
 * バケット作成は手動 (supabase/README.md 参照)。
 * - private bucket
 * - 10 MB 上限
 * - mime: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 * - authenticated のみ アップロード/読み取り可
 *
 * パス命名: `YYYY/MM/{company_id}-{display_name}.xlsx`
 */

const BUCKET = 'invoices'

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/**
 * ファイル名に使えない文字を除去 (Windows / S3 の安全側で)。
 */
function safeFileName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').trim()
}

/**
 * 標準的な保存パスを生成する。
 */
export function buildInvoicePath({ year, month, companyId, displayName }) {
  const m = String(month).padStart(2, '0')
  const safeName = safeFileName(displayName || `company-${companyId}`)
  return `${year}/${m}/${companyId}-${safeName}.xlsx`
}

/**
 * .xlsx の ArrayBuffer をアップロードする (同パスは上書き)。
 * @param {string} path
 * @param {ArrayBuffer | Uint8Array | Blob} body
 * @returns {Promise<{ data: { path: string } | null, error: Error | null }>}
 */
export async function uploadInvoiceFile(path, body) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.storage.from(BUCKET).upload(
      path,
      body,
      {
        upsert: true,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    )
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error uploading invoice file:', error)
    return { data: null, error }
  }
}

/**
 * 署名付き URL を発行する (ダウンロード用、デフォルト 5 分)。
 */
export async function getInvoiceFileUrl(path, expiresInSeconds = 300) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating signed url:', error)
    return { data: null, error }
  }
}

export async function deleteInvoiceFile(path) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error
    return { data: { path }, error: null }
  } catch (error) {
    console.error('Error deleting invoice file:', error)
    return { data: null, error }
  }
}
