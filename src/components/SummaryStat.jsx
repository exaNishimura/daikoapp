import { Divider } from '@astryxdesign/core/Divider'
import { HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'

const TONE_STYLE = {
  danger: { color: 'var(--color-text-red)' },
  success: { color: 'var(--color-text-green)' },
}

const VALUE_STYLE = {
  fontFamily: '"Roboto Condensed", "Figtree", sans-serif',
  fontSize: '1.25rem',
  lineHeight: 1.2,
}

const LEADER_STYLE = {
  flex: '1 1 auto',
  width: 'auto',
  minWidth: 'var(--spacing-4)',
}

/**
 * ページサマリの重要数値。ラベル左・数字右をリーダー線でつなぐ。
 */
export function SummaryStat({ label, value, tone, start }) {
  return (
    <HStack gap={2} vAlign="baseline" width="100%">
      <Text type="supporting">{label}</Text>
      <Divider style={LEADER_STYLE} />
      <HStack gap={1} vAlign="center">
        {start ?? null}
        <Text
          type="large"
          weight="normal"
          hasTabularNumbers
          justify="end"
          style={{ ...VALUE_STYLE, ...TONE_STYLE[tone] }}
        >
          {value}
        </Text>
      </HStack>
    </HStack>
  )
}
