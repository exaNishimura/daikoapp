/**
 * 割引ポリシー（拡張可能な JSON モデル）
 * MVP: FIXED_YEN のみ適用。他 type は保存可・適用スキップ。
 */

/**
 * @typedef {{ type: string, amount: number, currency?: string, rules?: unknown }} DiscountConfig
 */

export const DEFAULT_DISCOUNT_CONFIG = Object.freeze({
  type: 'FIXED_YEN',
  amount: 500,
  currency: 'JPY',
})

/**
 * @param {unknown} config
 * @returns {DiscountConfig}
 */
export function normalizeDiscountConfig(config) {
  if (!config || typeof config !== 'object') {
    return { ...DEFAULT_DISCOUNT_CONFIG }
  }
  const type = String(config.type || 'FIXED_YEN')
  const amount = Number(config.amount)
  return {
    type,
    amount: Number.isFinite(amount) ? amount : DEFAULT_DISCOUNT_CONFIG.amount,
    currency: config.currency || 'JPY',
    ...(config.rules != null ? { rules: config.rules } : {}),
  }
}

/**
 * 申込時点のスナップショット（適用可能な割引のみ）
 * @param {unknown} config
 * @returns {{ applied: boolean, type: string, amount: number, currency: string, label: string }}
 */
export function snapshotDiscount(config) {
  const normalized = normalizeDiscountConfig(config)
  if (normalized.type === 'FIXED_YEN' && normalized.amount > 0) {
    return {
      applied: true,
      type: 'FIXED_YEN',
      amount: normalized.amount,
      currency: 'JPY',
      label: `${normalized.amount}円引き`,
    }
  }
  return {
    applied: false,
    type: normalized.type,
    amount: 0,
    currency: 'JPY',
    label: '割引なし',
  }
}
