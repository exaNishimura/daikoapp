import { supabase } from '@/lib/supabase'

/**
 * Supabase Storage の `invoices` バケット操作。
 *
 * バケット定義は migration `20260603074500_add_invoices_bucket.sql` で管理。
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
 * 標準的な保存パスを生成する。
 *
 * Supabase Storage のキー検証は ASCII (`\w / ! - . * ' ( ) & $ @ = ; : + , ?` と空白) に
 * 限定されており、日本語(マルチバイト)は弾かれる。
 * そのため path には company_id と sequence のみ使う。
 * 表示用の日本語ファイル名はダウンロード時の Content-Disposition で付与する
 * (`getInvoiceFileUrl` の `download` オプション)。
 *
 * @param {{ year: number, month: number, companyId: number,
 *           sequence?: { index: number, total: number } }} args
 */
export function buildInvoicePath({ year, month, companyId, sequence }) {
  const m = String(month).padStart(2, '0')
  const seq = sequence ? `-${sequence.index}of${sequence.total}` : ''
  return `${year}/${m}/${companyId}${seq}.xlsx`
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
 *
 * @param {string} path
 * @param {number} expiresInSeconds
 * @param {{ download?: string | true }} [options]
 *   download に文字列を渡すと Content-Disposition の filename になる
 *   (日本語 OK / Storage 側で RFC 5987 エンコードされる)。
 */
export async function getInvoiceFileUrl(path, expiresInSeconds = 300, options) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds, options)
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
