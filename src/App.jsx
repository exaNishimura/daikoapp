import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageSquare,
  Pencil,
  Settings2,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TopNav, TopNavHeading, TopNavMenu } from '@astryxdesign/core/TopNav'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DispatchBoard } from '@/components/DispatchBoard'
import { ShiftCalendar } from '@/components/ShiftCalendar'
import { ReservationLedgerPage } from '@/components/Reservations/ReservationLedgerPage'
import { ShiftEditPage } from '@/components/ShiftEditPage'
import { ShiftRequestPage } from '@/components/ShiftRequest/ShiftRequestPage'
import { ShiftRequestsAdminPage } from '@/components/ShiftRequest/ShiftRequestsAdminPage'
import { EmployeeManagement } from '@/components/EmployeeManagement'
import { LoginPage } from '@/components/LoginPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LineQueuePage } from '@/components/LineIntake/LineQueuePage'
import { LineSettingsPage } from '@/components/LineIntake/LineSettingsPage'
import { LineHoldingAlertHost } from '@/components/LineIntake/LineHoldingAlertHost'
import { DispatchPinGate } from '@/components/LineIntake/DispatchPinGate'
import { LiffOrderForm } from '@/components/Liff/LiffOrderForm'
import { CompaniesPage } from '@/pages/Receivables/CompaniesPage'
import { CompanyProfilePage } from '@/pages/Receivables/CompanyProfilePage'
import { ReceivablesListPage } from '@/pages/Receivables/ReceivablesListPage'
import { DailySalesPage } from '@/pages/Receivables/DailySalesPage'
import { InvoicesPage } from '@/pages/Receivables/InvoicesPage'
import { ReceivablesImportPage } from '@/pages/Receivables/ReceivablesImportPage'
import { useCompanyProfile } from '@/hooks/billing/useCompanyProfile'
import { DashboardPage } from '@/pages/DashboardPage'
import { TravelTimeMapPage } from '@/pages/TravelTimeMapPage'
import { isNavItemActive, filterVisibleCategories } from '@/lib/navConfig'

const SYSTEM_NAME = '運転代行管理システム'

const NAV_ITEM_ICONS = {
  '/dispatch': Truck,
  '/travel-times': MapPin,
  '/reservations': BookOpen,
  '/line-queue': MessageSquare,
  '/shift': CalendarDays,
  '/shift/request': CalendarPlus,
  '/shift/requests': ListChecks,
  '/shift/edit': Pencil,
  '/admin/sales': LayoutDashboard,
  '/admin/receivables': Wallet,
  '/admin/invoices': FileText,
  '/employees': Users,
  '/admin/companies': Building2,
  '/admin/company-profile': ClipboardList,
  '/admin/line-settings': Settings2,
}

function navItemIcon(to) {
  const Icon = NAV_ITEM_ICONS[to]
  if (!Icon) return null
  return <Icon size={20} aria-hidden />
}

function AppTopNav() {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <TopNav
      label="メインナビゲーション"
      heading={
        <TopNavHeading
          heading={SYSTEM_NAME}
          headingHref="/"
          subheading={companyName || undefined}
        />
      }
      startContent={categories.map((category) => (
        <TopNavMenu
          key={category.id}
          label={category.label}
          items={category.items.map((item) => ({
            title: item.label,
            href: item.to,
            icon: navItemIcon(item.to),
            description: isNavItemActive(location.pathname, item) ? '現在のページ' : undefined,
          }))}
        />
      ))}
      endContent={
        isAuthenticated ? (
          <HStack gap={2} vAlign="center">
            {user?.email ? <Text color="secondary">{user.email}</Text> : null}
            <Button label="ログアウト" variant="ghost" size="sm" onClick={handleLogout} />
          </HStack>
        ) : (
          <Button label="ログイン" variant="primary" size="sm" href="/login" />
        )
      }
    />
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route
        path="/dispatch"
        element={
          <DispatchPinGate>
            <DispatchBoard />
          </DispatchPinGate>
        }
      />
      <Route path="/travel-times" element={<TravelTimeMapPage />} />
      <Route path="/shift" element={<ShiftCalendar />} />
      <Route path="/shift/request" element={<ShiftRequestPage />} />
      <Route
        path="/shift/requests"
        element={
          <ProtectedRoute>
            <ShiftRequestsAdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/reservations" element={<ReservationLedgerPage />} />
      <Route path="/liff/order" element={<LiffOrderForm />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/line-queue"
        element={
          <ProtectedRoute>
            <LineQueuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/line-settings"
        element={
          <ProtectedRoute>
            <LineSettingsPage />
          </ProtectedRoute>
        }
      />
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
  )
}

function AppFrame() {
  const location = useLocation()
  const isLiff = location.pathname.startsWith('/liff')

  if (isLiff) {
    return <AppRoutes />
  }

  return (
    <AppShell height="fill" contentPadding={0} variant="section" topNav={<AppTopNav />}>
      <LineHoldingAlertHost />
      <AppRoutes />
    </AppShell>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppFrame />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
