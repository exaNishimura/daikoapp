/**
 * ヘッダーメニュー・ダッシュボード共通のナビ構成
 */
export const NAV_CATEGORIES = [
  {
    id: 'dispatch',
    label: '配車',
    description: '電話受注の登録・配車確定、予約・LINE受付',
    items: [
      { to: '/dispatch', label: '配車画面', requiresAuth: false, end: true },
      { to: '/reservations', label: '予約台帳', requiresAuth: false },
      { to: '/line-queue', label: 'LINE仮受付', requiresAuth: true },
    ],
  },
  {
    id: 'shift',
    label: 'シフト',
    description: 'シフト表の確認・希望提出・編集',
    items: [
      { to: '/shift', label: 'シフト表', requiresAuth: false, end: true },
      { to: '/shift/request', label: '希望提出', requiresAuth: false },
      { to: '/shift/requests', label: '希望一覧', requiresAuth: true },
      { to: '/shift/edit', label: 'シフト編集', requiresAuth: true },
    ],
  },
  {
    id: 'billing',
    label: '経理',
    description: '売上集計・売掛・請求書',
    items: [
      { to: '/admin/sales', label: '売上管理', requiresAuth: true },
      { to: '/admin/receivables', label: '売掛', requiresAuth: true },
      { to: '/admin/invoices', label: '請求書', requiresAuth: true },
    ],
  },
  {
    id: 'settings',
    label: '設定',
    description: 'マスタデータ・自社情報・LINE設定',
    items: [
      { to: '/employees', label: '従業員マスタ', requiresAuth: true },
      { to: '/admin/companies', label: '取引先マスタ', requiresAuth: true },
      { to: '/admin/company-profile', label: '自社情報', requiresAuth: true },
      { to: '/admin/line-settings', label: 'LINE受注設定', requiresAuth: true },
    ],
  },
]

export function isNavItemActive(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function filterVisibleCategories(isAuthenticated) {
  return NAV_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => !item.requiresAuth || isAuthenticated),
  })).filter((cat) => cat.items.length > 0)
}
