import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * DispatchBoard 上部の固定ヘッダー。
 */
export function DispatchHeader({
  businessDayText,
  earliestAvailableTime,
  isCurrentNight = true,
  vehicles,
  conflictCount = 0,
  onPrevNight,
  onNextNight,
  onToday,
  onOpenSettings,
  onOpenOrderForm,
}) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  return (
    <header className="dispatch-header">
      <HStack padding={2} gap={2} vAlign="center" hAlign="between" wrap="wrap">
        <HStack gap={2} vAlign="center" wrap="wrap">
          <HStack gap={1} vAlign="center">
            <IconButton
              size="sm"
              label="前の営業夜"
              tooltip="前の営業夜"
              variant="ghost"
              icon={<ChevronLeft />}
              onClick={onPrevNight}
              isDisabled={isCurrentNight}
            />
            <Text weight="semibold">{businessDayText}</Text>
            <IconButton
              size="sm"
              label="次の営業夜"
              tooltip="次の営業夜"
              variant="ghost"
              icon={<ChevronRight />}
              onClick={onNextNight}
            />
          </HStack>
          {isCurrentNight ? (
            <>
              <Text color="secondary">受付:</Text>
              <Text weight="bold">{earliestAvailableTime}</Text>
            </>
          ) : (
            <>
              <Text color="secondary">予約夜</Text>
              <Button size="sm" variant="ghost" label="今日" onClick={onToday} />
            </>
          )}
          {conflictCount > 0 ? (
            <Token
              size="sm"
              color="red"
              label={isMobile ? `競合${conflictCount}` : `競合 ${conflictCount}件`}
            />
          ) : null}
        </HStack>
        <HStack gap={1} vAlign="center">
          <Button
            variant="secondary"
            size="sm"
            label="稼働状況"
            onClick={onOpenSettings}
            isDisabled={vehicles.length === 0}
          />
          <Button variant="primary" size="sm" label="新規依頼" onClick={onOpenOrderForm} />
        </HStack>
      </HStack>
    </header>
  )
}
