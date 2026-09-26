import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PinDialog } from '@/components/PinDialog'
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
    <PinDialog
      title="配車画面のロック解除"
      pin={pin}
      onPinChange={setPin}
      error={error}
      submitting={submitting}
      onSubmit={submit}
      onCancel={handleCancel}
      submitLabel="解除"
    />
  )
}
