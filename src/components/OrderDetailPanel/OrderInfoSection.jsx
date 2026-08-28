import { Heading } from '@astryxdesign/core/Heading'
import { Token } from '@astryxdesign/core/Token'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'

const MUI_TO_TOKEN_COLOR = {
  default: 'gray',
  warning: 'yellow',
  success: 'green',
  info: 'cyan',
  error: 'red',
  primary: 'blue',
}

export function OrderInfoSection({ order, statusLabel, statusColor }) {
  const tokenColor = MUI_TO_TOKEN_COLOR[statusColor] || 'gray'

  return (
    <VStack gap={2}>
      <Heading level={3}>基本情報</Heading>
      <VStack gap={2}>
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            ステータス
          </Text>
          <Token size="sm" label={statusLabel} color={tokenColor} />
        </VStack>
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            予約種別
          </Text>
          <Text>
            {order.order_type === 'NOW'
              ? '今すぐ'
              : order.scheduled_at
                ? new Date(order.scheduled_at).toLocaleString('ja-JP')
                : '日時指定'}
          </Text>
        </VStack>
      </VStack>
    </VStack>
  )
}
