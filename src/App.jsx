import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DispatchBoard } from './components/DispatchBoard'
import { ShiftCalendar } from './components/ShiftCalendar'
import { ShiftEditPage } from './components/ShiftEditPage'
import { EmployeeManagement } from './components/EmployeeManagement'
import { LoginPage } from './components/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import Button from '@mui/material/Button'
import './App.css'

function NavBar() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleLogin = () => {
    navigate('/login')
  }

  return (
    <nav style={{ 
      padding: '10px', 
      background: '#2a2a2a', 
      borderBottom: '1px solid #444',
      flexShrink: 0,
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <Link to="/" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
          配車画面
        </Link>
        <Link to="/shift" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
          シフト表
        </Link>
        {isAuthenticated && (
          <>
            <Link to="/shift/edit" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
              シフト編集
            </Link>
            <Link to="/employees" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
              従業員管理
            </Link>
          </>
        )}
      </div>
      {isAuthenticated ? (
        <Button
          onClick={handleLogout}
          variant="outlined"
          size="small"
          sx={{ color: '#fff', borderColor: '#fff', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
        >
          ログアウト
        </Button>
      ) : (
        <Button
          onClick={handleLogin}
          variant="contained"
          size="small"
          sx={{ 
            backgroundColor: '#646cff',
            '&:hover': { backgroundColor: '#535bf2' }
          }}
        >
          ログイン
        </Button>
      )}
    </nav>
  )
}

function AppRoutes() {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Routes>
        <Route path="/" element={<DispatchBoard />} />
        <Route path="/shift" element={<ShiftCalendar />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/shift/edit"
          element={
            <ProtectedRoute>
              <ShiftEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeeManagement />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <NavBar />
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

