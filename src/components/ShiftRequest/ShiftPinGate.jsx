import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'
import { verifyShiftPin } from '@/services/employeeShiftService'
import {
  clearEmployeeShiftSession,
  getEmployeeShiftSession,
  setEmployeeShiftSession,
} from '@/lib/employeeShift/employeeShiftSession'

/**
 * シフト希望提出画面用 PIN ゲート（配車 PIN とは別）
 */
export function ShiftPinGate({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getEmployeeShiftSession())
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
      const { data, error: apiErr, raw, status } = await verifyShiftPin(pin)
      if (apiErr || !data?.ok) {
        if (status === 423 || raw?.reason === 'LOCKED') {
          throw new Error('PINがロックされています。しばらく待ってください')
        }
        throw new Error(raw?.error || apiErr?.message || 'PINが正しくありません')
      }
      const next = { token: data.token, employee: data.employee }
      setEmployeeShiftSession(next)
      setSession(next)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (session?.token) {
    return children({ employee: session.employee })
  }

  return (
    <Dialog isOpen onOpenChange={handleOpenChange} purpose="form">
      <Layout
        padding={4}
        header={
          <DialogHeader
            title="シフト希望提出"
            subtitle="管理者から通知された6桁のPINを入力してください。"
            onOpenChange={handleOpenChange}
          />
        }
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
              size={FORM_FIELD_SIZE}
              width="100%"
              status={error ? { type: 'error', message: error } : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pin.length === 6 && !submitting) submit()
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
                onClick={handleCancel}
              />
              <Button
                variant="primary"
                isDisabled={pin.length !== 6 || submitting}
                isLoading={submitting}
                label="ログイン"
                onClick={submit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}

export function logoutEmployeeShiftSession() {
  clearEmployeeShiftSession()
}
