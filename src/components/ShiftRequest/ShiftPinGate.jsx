import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
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
  const [session, setSession] = useState(() => getEmployeeShiftSession())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <Dialog open disableEscapeKeyDown fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>シフト希望提出</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            管理者から通知された6桁のPINを入力してください。
          </Typography>
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
            ログイン
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function logoutEmployeeShiftSession() {
  clearEmployeeShiftSession()
}
