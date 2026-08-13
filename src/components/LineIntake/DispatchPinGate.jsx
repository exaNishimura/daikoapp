import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { callLineIntakeApi } from '@/services/lineIntakeService'
import { isDispatchPinUnlocked, markDispatchPinUnlocked } from '@/lib/lineIntake/dispatchPinSession'

/**
 * 配車画面はセッション中 1 回だけ PIN。予約ごとの承認には使わない。
 */
export function DispatchPinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => isDispatchPinUnlocked())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event?.preventDefault?.()
    setError('')
    setSubmitting(true)
    try {
      const { data, error: apiErr, raw, status } = await callLineIntakeApi({
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
    <Dialog open disableEscapeKeyDown fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>配車画面のロック解除</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="PIN（6桁）"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'one-time-code' }}
            fullWidth
            required
          />
          {error ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" disabled={pin.length !== 6 || submitting}>
            解除
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
