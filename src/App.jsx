import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DispatchBoard } from '@/components/DispatchBoard'
import { ShiftCalendar } from '@/components/ShiftCalendar'
import { ShiftEditPage } from '@/components/ShiftEditPage'
import { EmployeeManagement } from '@/components/EmployeeManagement'
import { LoginPage } from '@/components/LoginPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { CompaniesPage } from '@/pages/Receivables/CompaniesPage'
import { CompanyProfilePage } from '@/pages/Receivables/CompanyProfilePage'
import { ReceivablesListPage } from '@/pages/Receivables/ReceivablesListPage'
import { DailySalesPage } from '@/pages/Receivables/DailySalesPage'
import { InvoicesPage } from '@/pages/Receivables/InvoicesPage'
import { ReceivablesImportPage } from '@/pages/Receivables/ReceivablesImportPage'
import Button from '@mui/material/Button'
import './App.css'

function NavBar() {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleLogin = () => {
    navigate('/login')
  }

  return (
    <nav
      style={{
        padding: '10px',
        background: '#2a2a2a',
        borderBottom: '1px solid #444',
        flexShrink: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <Link to="/" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
          配車画面
        </Link>
        <Link to="/shift" style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}>
          シフト表
        </Link>
        {isAuthenticated && (
          <>
            <Link
              to="/shift/edit"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              シフト編集
            </Link>
            <Link
              to="/employees"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              従業員管理
            </Link>
            <Link
              to="/admin/sales"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              日次売上
            </Link>
            <Link
              to="/admin/receivables"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              売掛
            </Link>
            <Link
              to="/admin/invoices"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              請求書
            </Link>
            <Link
              to="/admin/companies"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              取引先マスタ
            </Link>
            <Link
              to="/admin/company-profile"
              style={{ color: '#fff', marginRight: '20px', textDecoration: 'none' }}
            >
              自社情報
            </Link>
          </>
        )}
      </div>
      {isAuthenticated ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.email && <span style={{ color: '#aaa', fontSize: 13 }}>{user.email}</span>}
          <Button
            onClick={handleLogout}
            variant="outlined"
            size="small"
            sx={{
              color: '#fff',
              borderColor: '#fff',
              '&:hover': {
                borderColor: '#fff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            ログアウト
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleLogin}
          variant="contained"
          size="small"
          sx={{ backgroundColor: '#646cff', '&:hover': { backgroundColor: '#535bf2' } }}
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
        <Route
          path="/admin/sales"
          element={
            <ProtectedRoute>
              <DailySalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/receivables"
          element={
            <ProtectedRoute>
              <ReceivablesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/invoices"
          element={
            <ProtectedRoute>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/receivables/import"
          element={
            <ProtectedRoute>
              <ReceivablesImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/companies"
          element={
            <ProtectedRoute>
              <CompaniesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/company-profile"
          element={
            <ProtectedRoute>
              <CompanyProfilePage />
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
        <div
          style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
        >
          <NavBar />
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
