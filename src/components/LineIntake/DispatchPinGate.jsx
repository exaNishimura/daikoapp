import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { callLineIntakeApi } from '@/services/lineIntakeService'
import { isDispatchPinUnlocked, markDispatchPinUnlocked } from '@/lib/lineIntake/dispatchPinSession'

/**
 * 配車画面はセッション中 1 回だけ PIN。予約ごとの承認には使わない。
 */
export function DispatchPinGate({ children }) {
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(() => isDispatchPinUnlocked())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCancel = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  const handleOpenChange = (isOpen) => {
    if (!isOpen) handleCancel()
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    setError('')
    setSubmitting(true)
    try {
      const {
        data,
        error: apiErr,
        raw,
        status,
      } = await callLineIntakeApi({
        action: 'verify_pin',
        pin,
      })
      if (apiErr || !data?.ok) {
        if (status === 423 || raw?.reason === 'LOCKED') {
          throw new Error('PIN がロックされています。しばらく待ってください')
        }
        throw new Error(raw?.error || apiErr?.message || 'PIN が正しくありません')
      }
      markDispatchPinUnlocked()
      setUnlocked(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (unlocked) return children

  return (
    <Dialog isOpen onOpenChange={handleOpenChange} purpose="form">
      <VStack as="form" onSubmit={submit} gap={0}>
        <Layout
          height="auto"
          padding={4}
          header={<DialogHeader title="配車画面のロック解除" onOpenChange={handleOpenChange} />}
          content={
            <LayoutContent>
              <TextInput
                label="PIN（6桁）"
                value={pin}
                onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
                isRequired
                hasAutoFocus
                isDisabled={submitting}
                htmlName="pin"
                width="100%"
                status={error ? { type: 'error', message: error } : undefined}
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  type="button"
                  variant="secondary"
                  isDisabled={submitting}
                  label="キャンセル"
                  onClick={handleCancel}
                />
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={pin.length !== 6 || submitting}
                  isLoading={submitting}
                  label="解除"
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </VStack>
    </Dialog>
  )
}
