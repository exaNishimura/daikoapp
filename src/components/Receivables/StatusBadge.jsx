import { Token } from '@astryxdesign/core/Token'

const STATUS_CONFIG = {
  unbilled: { label: '未請求', color: 'gray' },
  billed: { label: '請求済', color: 'blue' },
  paid: { label: '入金済', color: 'green' },
}

/**
 * 売掛・請求書のステータスバッジ。
 *
 * @param {Object} props
 * @param {'unbilled'|'billed'|'paid'|string} props.status
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] ?? { label: String(status), color: 'default' }
  return <Token size={size} label={config.label} color={config.color} />
}
