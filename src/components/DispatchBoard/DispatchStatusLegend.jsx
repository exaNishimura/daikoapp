import { HStack } from '@astryxdesign/core/Layout'
import { Token } from '@astryxdesign/core/Token'

const LEGEND_ITEMS = [
  { label: '配置不可', color: 'gray' },
  { label: '仮配置', color: 'yellow' },
  { label: '確定', color: 'green' },
  { label: '送客中', color: 'purple' },
  { label: '競合', color: 'red' },
]

/**
 * タイムライン上のスロット色の凡例。
 * スロット本体の色は DispatchBoard.css / SlotComponent.css の --dsp-* を使う。
 */
export function DispatchStatusLegend() {
  return (
    <div className="dispatch-legend">
      <HStack gap={1} padding={1} paddingInline={2} vAlign="center" wrap="wrap">
        {LEGEND_ITEMS.map((item) => (
          <Token key={item.label} size="sm" color={item.color} label={item.label} />
        ))}
      </HStack>
    </div>
  )
}
