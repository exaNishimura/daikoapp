import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'

/**
 * 単日コピー用ダイアログ。
 * 選択した日付のシフトを copyTargetDate に上書きコピーする。
 */
export function CopyShiftDialog({
  open,
  onClose,
  days,
  copyTargetDate,
  getShiftsForDate,
  onCopyFromDate,
}) {
  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const options = days
    .filter(({ date }) => date !== copyTargetDate)
    .map(({ date, day, dow }) => {
      const dateShifts = getShiftsForDate(date)
      return {
        value: date,
        label:
          dateShifts.length > 0
            ? `${day}日 (${dow}) · ${dateShifts.length}件`
            : `${day}日 (${dow})`,
        description:
          dateShifts.length > 0
            ? dateShifts.map((shift) => `${shift.staff} / ${shift.start} - ${shift.end}`).join(' / ')
            : 'シフト未設定',
      }
    })

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="他の日からシフトをコピー" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text>
                コピー元の日付を選択してください。この日のシフトでコピー先を上書きします（コピー先の当日データはすべて削除されます）。
              </Text>
              <Selector
                label="日付を選択"
                options={options}
                onChange={onCopyFromDate}
                placeholder="日付を選択"
                width="100%"
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack hAlign="end">
              <Button label="キャンセル" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
