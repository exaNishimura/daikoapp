import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './MonthNav.module.css'

function shiftYearMonth(year, month, delta) {
  const next = new Date(year, month - 1 + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() + 1 }
}

/**
 * 前月 / YYYY年M月 / 次月。ラベルサイズはシフト編集の Heading level={1} に揃える。
 */
export function MonthNav({ year, month, onChange, isDisabled = false, accessibilityLevel }) {
  const go = (delta) => {
    onChange?.(shiftYearMonth(year, month, delta))
  }

  return (
    <HStack gap={1} vAlign="center">
      <IconButton
        label="前月"
        tooltip="前月"
        variant="ghost"
        icon={<ChevronLeft />}
        onClick={() => go(-1)}
        isDisabled={isDisabled}
      />
      <Heading level={1} accessibilityLevel={accessibilityLevel}>
        {year}年{month}月
      </Heading>
      <IconButton
        label="次月"
        tooltip="次月"
        variant="ghost"
        icon={<ChevronRight />}
        onClick={() => go(1)}
        isDisabled={isDisabled}
      />
    </HStack>
  )
}

/**
 * 左右スロット付きの中央寄せバー。シフト表・シフト編集ヘッダで共用する。
 */
export function MonthNavBar({ start = null, end = null, className, ...navProps }) {
  return (
    <div className={`${styles.bar}${className ? ` ${className}` : ''}`}>
      <div className={styles.start}>{start}</div>
      <div className={styles.center}>
        <MonthNav {...navProps} />
      </div>
      <div className={styles.end}>{end}</div>
    </div>
  )
}
