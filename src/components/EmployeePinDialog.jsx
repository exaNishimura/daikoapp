import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'

export function EmployeePinDialog({
  open,
  onOpenChange,
  pinTarget,
  issuedPin,
  customPin,
  onCustomPinChange,
  pinSubmitting,
  fieldSize,
  onIssuePin,
  onClearPin,
  onClose,
}) {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} purpose="form">
      <Layout
        padding={4}
        header={
          <DialogHeader
            title={`シフト希望PIN — ${pinTarget?.name ?? ''}`}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <Text color="secondary">
                配車画面のPINとは別です。従業員に本人のみ通知してください。
              </Text>
              {issuedPin ? (
                <Banner
                  status="warning"
                  title={`発行したPIN: ${issuedPin}`}
                  description="この画面を閉じると再表示できません。"
                  collapsible={false}
                />
              ) : null}
              {!issuedPin ? (
                <Button
                  variant="primary"
                  width="100%"
                  label="ランダムPINを発行"
                  onClick={() => onIssuePin(false)}
                  isDisabled={pinSubmitting}
                  isLoading={pinSubmitting}
                />
              ) : null}
              {!issuedPin ? (
                <TextInput
                  label="手動指定（6桁）"
                  value={customPin}
                  onChange={(value) => onCustomPinChange(value.replace(/\D/g, '').slice(0, 6))}
                  size={fieldSize}
                  width="100%"
                />
              ) : null}
              {!issuedPin ? (
                <Button
                  variant="secondary"
                  width="100%"
                  label="指定PINを設定"
                  onClick={() => onIssuePin(true)}
                  isDisabled={pinSubmitting || customPin.length !== 6}
                />
              ) : null}
              {pinTarget?.shift_pin_configured ? (
                <Button
                  variant="destructive"
                  width="100%"
                  label="PINを解除"
                  onClick={onClearPin}
                  isDisabled={pinSubmitting}
                />
              ) : null}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack hAlign="end">
              <Button label="閉じる" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
