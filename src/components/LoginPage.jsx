import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Container from '@mui/material/Container'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { sendMagicLink, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/shift/edit'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      const result = await sendMagicLink(email.trim())
      if (result.success) {
        setInfo(`${email.trim()} 宛にログインリンクを送信しました。メールを確認してください。`)
        setEmail('')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
            ログイン
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            登録済みのメールアドレスを入力すると、
            <br />
            ログイン用のリンクをメールで送信します。
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>
              {info}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoFocus
              autoComplete="email"
              disabled={submitting}
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" fullWidth disabled={submitting || !email}>
              {submitting ? '送信中...' : 'ログインリンクを送信'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}
