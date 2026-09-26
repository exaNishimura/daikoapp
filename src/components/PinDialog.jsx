import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'

/**
 * 6桁 PIN の入力枠。認証先は呼び出し側が持つ。
 */
export function PinDialog({
  title,
  subtitle,
  pin,
  onPinChange,
  error,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  return (
    <Dialog isOpen onOpenChange={(isOpen) => !isOpen && onCancel()} purpose="form">
      <Layout
        padding={4}
        header={<DialogHeader title={title} subtitle={subtitle} onOpenChange={() => onCancel()} />}
        content={
          <LayoutContent>
            <TextInput
              label="PIN（6桁）"
              value={pin}
              onChange={(value) => onPinChange(value.replace(/\D/g, '').slice(0, 6))}
              isRequired
              hasAutoFocus
              isDisabled={submitting}
              htmlName="pin"
              size={FORM_FIELD_SIZE}
              width="100%"
              status={error ? { type: 'error', message: error } : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pin.length === 6 && !submitting) onSubmit()
              }}
            />
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                variant="secondary"
                isDisabled={submitting}
                label="キャンセル"
                onClick={onCancel}
              />
              <Button
                variant="primary"
                isDisabled={pin.length !== 6 || submitting}
                isLoading={submitting}
                label={submitLabel}
                onClick={onSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
