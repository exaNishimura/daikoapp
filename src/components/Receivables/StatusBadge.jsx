import Chip from '@mui/material/Chip'

const STATUS_CONFIG = {
  unbilled: { label: '未請求', color: 'default' },
  billed: { label: '請求済', color: 'primary' },
  paid: { label: '入金済', color: 'success' },
}

/**
 * 売掛・請求書のステータスバッジ。
 *
 * @param {Object} props
 * @param {'unbilled'|'billed'|'paid'|string} props.status
 * @param {string} [props.size]   MUI Chip size (default 'small')
 */
export function StatusBadge({ status, size = 'small', ...rest }) {
  const config = STATUS_CONFIG[status] ?? { label: String(status), color: 'default' }
  return <Chip size={size} label={config.label} color={config.color} {...rest} />
}
