/**
 * pdfmake 用に日本語フォント (Noto Sans JP) を /fonts/*.otf から fetch して
 * base64 (vfs) に変換、メモリにキャッシュする。
 *
 * フォント実体は public/fonts/ に配置 (リポジトリ同梱)。
 * 約 9MB あるので「請求書発行時に初回だけ動的 import + fetch」される想定。
 */

let cachedVfs = null
let inflightPromise = null

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function fetchAsBase64(url) {
  const t0 = performance.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fontLoader: failed to fetch ${url} (${res.status})`)
  const buf = await res.arrayBuffer()
  const t1 = performance.now()
  const b64 = arrayBufferToBase64(buf)
  const t2 = performance.now()
  console.log(
    `[fontLoader] ${url} ${(buf.byteLength / 1024 / 1024).toFixed(2)}MB ` +
      `fetch=${Math.round(t1 - t0)}ms b64=${Math.round(t2 - t1)}ms`
  )
  return b64
}

/**
 * pdfmake の vfs (Virtual File System) として使える { fileName: base64 } を返す。
 * 多重呼び出しは同じ Promise を共有する。
 */
export async function loadJapaneseFontVfs() {
  if (cachedVfs) return cachedVfs
  if (inflightPromise) return inflightPromise
  inflightPromise = (async () => {
    const [regular, bold] = await Promise.all([
      fetchAsBase64('/fonts/NotoSansJP-Regular.otf'),
      fetchAsBase64('/fonts/NotoSansJP-Bold.otf'),
    ])
    cachedVfs = {
      'NotoSansJP-Regular.otf': regular,
      'NotoSansJP-Bold.otf': bold,
    }
    return cachedVfs
  })()
  try {
    return await inflightPromise
  } finally {
    inflightPromise = null
  }
}

/**
 * pdfmake の fonts 定義。`createPdf(doc, null, fonts, vfs)` の3つ目に渡す。
 */
export const PDF_FONTS = {
  NotoSansJP: {
    normal: 'NotoSansJP-Regular.otf',
    bold: 'NotoSansJP-Bold.otf',
    italics: 'NotoSansJP-Regular.otf',
    bolditalics: 'NotoSansJP-Bold.otf',
  },
}
