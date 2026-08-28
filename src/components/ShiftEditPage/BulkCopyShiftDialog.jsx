import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'

/**
 * 一括コピー用ダイアログ。
 * 選択された複数の日付に、コピー元日のシフトを上書きする。
 */
export function BulkCopyShiftDialog({
  open,
  onClose,
  days,
  bulkCopySourceDate,
  setBulkCopySourceDate,
  selectedCopyDestCount,
  getShiftsForDate,
  onExecute,
  loading,
}) {
  const noShiftAvailable = days.every(({ date }) => getShiftsForDate(date).length === 0)

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const options = days
    .filter(({ date }) => getShiftsForDate(date).length > 0)
    .map(({ date, day, dow }) => {
      const dateShifts = getShiftsForDate(date)
      return {
        value: date,
        label: `${day}日 (${dow}) · ${dateShifts.length}件`,
        description: dateShifts
          .map((shift) => `${shift.staff} / ${shift.start} - ${shift.end}`)
          .join(' / '),
      }
    })

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="一括コピー" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text>
                チェックした{selectedCopyDestCount}
                日に、コピー元のシフトで上書きします（各コピー先の当日のシフト・ステータスはいったんすべて削除されてから複製されます。コピー元の日は対象外です）。
              </Text>
              {noShiftAvailable ? (
                <Banner
                  status="error"
                  title="この月にコピー元にできるシフトがありません。"
                  collapsible={false}
                />
              ) : (
                <Selector
                  label="コピー元の日付"
                  options={options}
                  value={bulkCopySourceDate}
                  onChange={setBulkCopySourceDate}
                  placeholder="コピー元の日付"
                  width="100%"
                />
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="キャンセル" variant="secondary" onClick={onClose} />
              <Button
                label="複製する"
                variant="primary"
                onClick={onExecute}
                isDisabled={loading || !bulkCopySourceDate || noShiftAvailable}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
