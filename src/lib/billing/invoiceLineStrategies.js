/**
 * 請求書明細の超過行対応戦略 (純関数)。
 *
 * 請求書テンプレは 1 枚あたり最大 25 明細。26 件以上の売掛がある企業については、
 * 以下の 3 戦略のいずれかを選択する:
 *
 *   - NORMAL: 25 件以下のときの通常発行 (そのまま渡す)
 *   - MERGE:  24 件 + "その他" 集約 1 行 = 25 行に圧縮 (1 枚)
 *   - SPLIT:  25 行ずつ複数枚に分割
 *   - SKIP:   発行対象から除外 (戦略未確定の保留用)
 *
 * applyMergeStrategy / applySplitStrategy はどちらも
 *   { lines: InvoiceLine[], sequence?: { index, total } }[]
 * を返し、呼び出し側はこれを 1 件ずつ generateInvoice に渡せる。
 */

export const INVOICE_MAX_LINES = 25

export const STRATEGIES = Object.freeze({
  NORMAL: 'normal',
  MERGE: 'merge',
  SPLIT: 'split',
  SKIP: 'skip',
})

/**
 * 行数に対する推奨戦略。
 * @param {number} lineCount
 * @returns {'normal'|'merge'}
 */
export function recommendedStrategy(lineCount) {
  return lineCount > INVOICE_MAX_LINES ? STRATEGIES.MERGE : STRATEGIES.NORMAL
}

/**
 * 行配列を 1 枚の請求書 (最大 INVOICE_MAX_LINES 行) に集約する。
 * 上限以下: そのまま 1 枚として返す。
 * 上限超: 先頭 (INVOICE_MAX_LINES-1) 行 + 残りを「その他」1 行に合算して計 INVOICE_MAX_LINES 行。
 *
 * @param {Array} lines
 * @returns {[{ lines: Array }]}  必ず 1 件
 */
export function applyMergeStrategy(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('applyMergeStrategy: lines is empty')
  }
  if (lines.length <= INVOICE_MAX_LINES) {
    return [{ lines: [...lines] }]
  }

  const keep = lines.slice(0, INVOICE_MAX_LINES - 1)
  const overflow = lines.slice(INVOICE_MAX_LINES - 1)
  const overflowAmount = overflow.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const mergedLine = {
    work_date: overflow[0].work_date,
    departure: 'その他',
    destination: '',
    amount: overflowAmount,
    note: `他${overflow.length}件`,
  }

  return [{ lines: [...keep, mergedLine] }]
}

/**
 * 行配列を INVOICE_MAX_LINES 行ずつ複数請求書に分割する。
 * 1 枚で収まる場合は sequence なし、複数枚に分かれる場合は sequence={index,total} を付与。
 *
 * @param {Array} lines
 * @returns {Array<{ lines: Array, sequence?: { index: number, total: number } }>}
 */
export function applySplitStrategy(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('applySplitStrategy: lines is empty')
  }
  if (lines.length <= INVOICE_MAX_LINES) {
    return [{ lines: [...lines] }]
  }

  const chunks = []
  for (let i = 0; i < lines.length; i += INVOICE_MAX_LINES) {
    chunks.push(lines.slice(i, i + INVOICE_MAX_LINES))
  }
  const total = chunks.length
  return chunks.map((chunk, idx) => ({
    lines: chunk,
    sequence: { index: idx + 1, total },
  }))
}
