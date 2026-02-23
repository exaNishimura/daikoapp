import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    // ログイン後に元のページに戻るために現在のパスを保存
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
