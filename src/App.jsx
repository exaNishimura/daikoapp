import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DispatchBoard } from '@/components/DispatchBoard'
import { ShiftCalendar } from '@/components/ShiftCalendar'
import { ReservationLedgerPage } from '@/components/Reservations/ReservationLedgerPage'
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
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import useMediaQuery from '@mui/material/useMediaQuery'
import MenuIcon from '@mui/icons-material/Menu'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useCompanyProfile } from '@/hooks/billing/useCompanyProfile'
import './App.css'

const SYSTEM_NAME = '運転代行管理システム'

/**
 * ヘッダーメニュー構成（カテゴリ単位）。
 * PC: カテゴリがプルダウン / モバイル: ドロワー内でカテゴリ見出し付き
 */
const NAV_CATEGORIES = [
  {
    id: 'dispatch',
    label: '配車',
    items: [
      { to: '/', label: '配車画面', requiresAuth: false, end: true },
      { to: '/reservations', label: '予約台帳', requiresAuth: false },
    ],
  },
  {
    id: 'shift',
    label: 'シフト',
    items: [
      { to: '/shift', label: 'シフト表', requiresAuth: false, end: true },
      { to: '/shift/edit', label: 'シフト編集', requiresAuth: true },
    ],
  },
  {
    id: 'billing',
    label: '経理',
    items: [
      { to: '/admin/sales', label: '売上管理', requiresAuth: true },
      { to: '/admin/receivables', label: '売掛', requiresAuth: true },
      { to: '/admin/invoices', label: '請求書', requiresAuth: true },
    ],
  },
  {
    id: 'settings',
    label: '設定',
    items: [
      { to: '/employees', label: '従業員マスタ', requiresAuth: true },
      { to: '/admin/companies', label: '取引先マスタ', requiresAuth: true },
      { to: '/admin/company-profile', label: '自社情報', requiresAuth: true },
    ],
  },
]

function isNavItemActive(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function filterVisibleCategories(isAuthenticated) {
  return NAV_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => !item.requiresAuth || isAuthenticated),
  })).filter((cat) => cat.items.length > 0)
}

function NavCategoryDropdown({ category, pathname }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const active = category.items.some((item) => isNavItemActive(pathname, item))

  return (
    <>
      <Button
        id={`nav-cat-${category.id}`}
        aria-controls={open ? `nav-menu-${category.id}` : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
        sx={{
          color: active ? '#5b61e6' : '#1f2733',
          fontWeight: active ? 700 : 500,
          textTransform: 'none',
          px: 1.25,
          minWidth: 0,
          '&:hover': {
            backgroundColor: 'rgba(91, 97, 230, 0.06)',
          },
        }}
      >
        {category.label}
      </Button>
      <Menu
        id={`nav-menu-${category.id}`}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ 'aria-labelledby': `nav-cat-${category.id}` }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 180,
              border: '1px solid #e3e7ec',
              boxShadow: '0 8px 24px rgba(31, 39, 51, 0.1)',
            },
          },
        }}
      >
        {category.items.map((item) => {
          const selected = isNavItemActive(pathname, item)
          return (
            <MenuItem
              key={item.to}
              component={Link}
              to={item.to}
              selected={selected}
              onClick={() => setAnchorEl(null)}
              sx={{
                fontWeight: selected ? 600 : 400,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(91, 97, 230, 0.1)',
                },
              }}
            >
              {item.label}
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

function NavBar() {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [menuOpen, setMenuOpen] = useState(false)

  const categories = filterVisibleCategories(isAuthenticated)
  const profileQuery = useCompanyProfile({
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
  const companyName = profileQuery.data?.name?.trim() || ''
  const brandTitle = companyName ? `${SYSTEM_NAME}　${companyName}` : SYSTEM_NAME

  useEffect(() => {
    document.title = brandTitle
  }, [brandTitle])

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

  const brandBlock = (
    <Box
      component={Link}
      to="/"
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'baseline',
        gap: isMobile ? 0 : 1.25,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
        mr: isMobile ? 1 : 2,
        flex: isMobile ? 1 : 'none',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 700,
          fontSize: isMobile ? 14 : 15,
          color: '#1f2733',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
      >
        {SYSTEM_NAME}
      </Typography>
      {companyName ? (
        <Typography
          component="span"
          sx={{
            fontWeight: 600,
            fontSize: isMobile ? 12 : 14,
            color: '#5b61e6',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: isMobile ? '46vw' : 280,
            lineHeight: 1.3,
          }}
          title={companyName}
        >
          {companyName}
        </Typography>
      ) : null}
    </Box>
  )

  const authActions = isAuthenticated ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      {user?.email && !isMobile && (
        <span style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</span>
      )}
      <Button
        onClick={handleLogout}
        variant="outlined"
        size="small"
        sx={{
          color: '#1f2733',
          borderColor: '#c5cad3',
          '&:hover': {
            borderColor: '#5b61e6',
            backgroundColor: 'rgba(91, 97, 230, 0.06)',
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
      sx={{ backgroundColor: '#5b61e6', '&:hover': { backgroundColor: '#4a50d6' }, flexShrink: 0 }}
    >
      ログイン
    </Button>
  )

  return (
    <nav
      style={{
        padding: '10px 16px',
        background: '#ffffff',
        borderBottom: '1px solid #e3e7ec',
        flexShrink: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {isMobile ? (
        <>
          <IconButton
            aria-label="メニューを開く"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            sx={{ color: '#1f2733' }}
          >
            <MenuIcon />
          </IconButton>
          {brandBlock}
          <Drawer
            anchor="left"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            PaperProps={{
              sx: {
                width: 280,
                backgroundColor: '#ffffff',
                color: '#1f2733',
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e3e7ec' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1f2733' }}>
                {SYSTEM_NAME}
              </Typography>
              {companyName ? (
                <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#5b61e6', mt: 0.25 }}>
                  {companyName}
                </Typography>
              ) : null}
            </Box>
            <List sx={{ pt: 0, pb: 1 }}>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                    <ListSubheader
                      sx={{
                        bgcolor: '#f4f6f8',
                        color: '#6b7280',
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: '0.04em',
                        lineHeight: '36px',
                      }}
                    >
                      {cat.label}
                    </ListSubheader>
                    {cat.items.map((link) => (
                      <ListItemButton
                        key={link.to}
                        component={Link}
                        to={link.to}
                        selected={isNavItemActive(location.pathname, link)}
                        onClick={() => setMenuOpen(false)}
                        sx={{
                          color: '#1f2733',
                          pl: 3,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(91, 97, 230, 0.12)',
                          },
                          '&.Mui-selected:hover': {
                            backgroundColor: 'rgba(91, 97, 230, 0.18)',
                          },
                        }}
                      >
                        <ListItemText primary={link.label} />
                      </ListItemButton>
                    ))}
                  </ul>
                </li>
              ))}
            </List>
            <div
              style={{
                marginTop: 'auto',
                padding: '16px',
                borderTop: '1px solid #e3e7ec',
              }}
            >
              {isAuthenticated && user?.email && (
                <span style={{ color: '#6b7280', fontSize: 13, wordBreak: 'break-all' }}>
                  {user.email}
                </span>
              )}
            </div>
          </Drawer>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {brandBlock}
          {categories.map((cat) => (
            <NavCategoryDropdown
              key={cat.id}
              category={cat}
              pathname={location.pathname}
            />
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
        <Route path="/reservations" element={<ReservationLedgerPage />} />
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
