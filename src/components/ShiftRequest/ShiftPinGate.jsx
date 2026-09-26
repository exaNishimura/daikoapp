import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PinDialog } from '@/components/PinDialog'
import { verifyShiftPin } from '@/services/employeeShiftService'
import {
  clearEmployeeShiftSession,
  getEmployeeShiftSession,
  setEmployeeShiftSession,
} from '@/lib/employeeShift/employeeShiftSession'

/**
 * 従業員シフト PIN ゲート（配車 PIN とは別）。
 * シフト希望提出・給与明細閲覧など、同じセッションを共有する画面で使う。
 */
export function ShiftPinGate({
  children,
  title = 'シフト希望提出',
  subtitle = '管理者から通知された6桁のPINを入力してください。',
}) {
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
    <PinDialog
      title={title}
      subtitle={subtitle}
      pin={pin}
      onPinChange={setPin}
      error={error}
      submitting={submitting}
      onSubmit={submit}
      onCancel={handleCancel}
      submitLabel="ログイン"
    />
  )
}

export function logoutEmployeeShiftSession() {
  clearEmployeeShiftSession()
}
