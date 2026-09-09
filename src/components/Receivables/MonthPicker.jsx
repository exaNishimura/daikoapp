import { useId, useState } from 'react'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { fromMonthString, shiftMonth, toAstryxSize, toMonthString } from './monthUtils'
import styles from './MonthPicker.module.css'

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}))

function buildYearOptions(selectedYear) {
  const current = new Date().getFullYear()
  const start = Math.min(current - 5, selectedYear ?? current)
  const end = Math.max(current + 1, selectedYear ?? current)
  const options = []
  for (let year = start; year <= end; year += 1) {
    options.push({ value: String(year), label: `${year}年` })
  }
  return options
}

/**
 * 対象月選択の共通 UI。
 * I/O は常に 'YYYY-MM'。上段: 前月 / YYYY年M月 / 翌月。
 * 年月ラベルをタップすると年・月セレクトがアニメーションで開く。
 * size / width 未指定時はモバイルで large + 100% を自動適用。
 */
export function MonthPicker({ value, onChange, label = '対象月', size, width }) {
  const isMobile = useIsMobile()
  const selectorsId = useId()
  const [selectorsOpen, setSelectorsOpen] = useState(false)
  const resolvedSize = size ?? (isMobile ? 'large' : 'small')
  const resolvedWidth = width ?? (isMobile ? '100%' : undefined)

  const parsed = fromMonthString(value)
  const controlSize = toAstryxSize(resolvedSize)
  const isFullWidth = Boolean(resolvedWidth)
  const now = new Date()
  const year = parsed?.year ?? now.getFullYear()
  const month = parsed?.month ?? now.getMonth() + 1

  const emit = (nextYear, nextMonth) => {
    onChange?.(toMonthString({ year: nextYear, month: nextMonth }))
  }

  return (
    <VStack gap={1} width={resolvedWidth}>
      {label ? (
        <Text size="sm" color="secondary">
          {label}
        </Text>
      ) : null}
      <VStack gap={1}>
        <HStack gap={1} hAlign={isFullWidth ? 'between' : 'start'} vAlign="center">
          <IconButton
            label="前月"
            tooltip="前月"
            icon={<ChevronLeft />}
            variant="secondary"
            size={controlSize}
            onClick={() => onChange?.(shiftMonth(value, -1))}
          />
          <button
            type="button"
            className={styles.monthLabelButton}
            aria-expanded={selectorsOpen}
            aria-controls={selectorsId}
            onClick={() => setSelectorsOpen((open) => !open)}
          >
            <Text type="large" size="xl" weight="semibold" hasTabularNumbers>
              {year}年{month}月
            </Text>
          </button>
          <IconButton
            label="翌月"
            tooltip="翌月"
            icon={<ChevronRight />}
            variant="secondary"
            size={controlSize}
            onClick={() => onChange?.(shiftMonth(value, 1))}
          />
        </HStack>
        <div
          id={selectorsId}
          className={styles.selectors}
          data-open={selectorsOpen ? 'true' : 'false'}
          aria-hidden={!selectorsOpen}
        >
          <div className={styles.selectorsInner}>
            <HStack gap={1}>
              <Selector
                label="年"
                isLabelHidden
                options={buildYearOptions(year)}
                value={parsed ? String(year) : undefined}
                onChange={(next) => emit(Number(next), month)}
                size={controlSize}
                width={isFullWidth ? '100%' : 128}
                isDisabled={!selectorsOpen}
              />
              <Selector
                label="月"
                isLabelHidden
                options={MONTH_OPTIONS}
                value={parsed ? String(month) : undefined}
                onChange={(next) => emit(year, Number(next))}
                size={controlSize}
                width={isFullWidth ? '100%' : 96}
                isDisabled={!selectorsOpen}
              />
            </HStack>
          </div>
        </div>
      </VStack>
    </VStack>
  )
}
