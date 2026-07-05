import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
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
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import useMediaQuery from '@mui/material/useMediaQuery'
import MenuIcon from '@mui/icons-material/Menu'
import './App.css'

const NAV_LINKS = [
  { to: '/', label: '配車画面', requiresAuth: false },
  { to: '/shift', label: 'シフト表', requiresAuth: false },
  { to: '/shift/edit', label: 'シフト編集', requiresAuth: true },
  { to: '/employees', label: '従業員管理', requiresAuth: true },
  { to: '/admin/sales', label: '日次売上', requiresAuth: true },
  { to: '/admin/receivables', label: '売掛', requiresAuth: true },
  { to: '/admin/invoices', label: '請求書', requiresAuth: true },
  { to: '/admin/companies', label: '取引先マスタ', requiresAuth: true },
  { to: '/admin/company-profile', label: '自社情報', requiresAuth: true },
]

const navLinkStyle = { color: '#fff', marginRight: '20px', textDecoration: 'none' }

function NavBar() {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleLinks = NAV_LINKS.filter((link) => !link.requiresAuth || isAuthenticated)

  useEffect(() => {
    const handlePopState = () => setMenuOpen(false)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/')
  }

  const handleLogin = () => {
    setMenuOpen(false)
    navigate('/login')
  }

  const authActions = isAuthenticated ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {user?.email && !isMobile && (
        <span style={{ color: '#aaa', fontSize: 13 }}>{user.email}</span>
      )}
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
  )

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
      {isMobile ? (
        <>
          <IconButton
            aria-label="メニューを開く"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            sx={{ color: '#fff' }}
          >
            <MenuIcon />
          </IconButton>
          <Drawer
            anchor="left"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            PaperProps={{
              sx: {
                width: 280,
                backgroundColor: '#2a2a2a',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <List sx={{ pt: 1 }}>
              {visibleLinks.map((link) => (
                <ListItemButton
                  key={link.to}
                  component={Link}
                  to={link.to}
                  selected={location.pathname === link.to}
                  onClick={() => setMenuOpen(false)}
                  sx={{
                    color: '#fff',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(100, 108, 255, 0.2)',
                    },
                    '&.Mui-selected:hover': {
                      backgroundColor: 'rgba(100, 108, 255, 0.3)',
                    },
                  }}
                >
                  <ListItemText primary={link.label} />
                </ListItemButton>
              ))}
            </List>
            <div
              style={{
                marginTop: 'auto',
                padding: '16px',
                borderTop: '1px solid #444',
              }}
            >
              {isAuthenticated && user?.email && (
                <span style={{ color: '#aaa', fontSize: 13, wordBreak: 'break-all' }}>
                  {user.email}
                </span>
              )}
            </div>
          </Drawer>
        </>
      ) : (
        <div>
          {visibleLinks.map((link) => (
            <Link key={link.to} to={link.to} style={navLinkStyle}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
      {authActions}
    </nav>
  )
}

function AppRoutes() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
