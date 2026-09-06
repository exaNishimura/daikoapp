import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { CompaniesPage } from './CompaniesPage'

const idleMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

vi.mock('@/hooks/billing/useCompanies', () => ({
  useCompanies: vi.fn(),
  useCreateCompany: vi.fn(() => idleMutation),
  useUpdateCompany: vi.fn(() => idleMutation),
  useDeactivateCompany: vi.fn(() => idleMutation),
  useDeleteCompany: vi.fn(() => idleMutation),
  useReorderCompanies: vi.fn(() => idleMutation),
}))

import {
  useCompanies,
  useDeleteCompany,
} from '@/hooks/billing/useCompanies'

function renderPage() {
  return render(
    <MemoryRouter>
      <Theme theme={stoneTheme} mode="light">
        <CompaniesPage />
      </Theme>
    </MemoryRouter>
  )
}

const companies = [
  {
    id: 1,
    name: '有効な取引先',
    invoice_display_name: null,
    aliases: [],
    display_order: 10,
    is_active: true,
    memo: null,
  },
  {
    id: 2,
    name: '無効な取引先',
    invoice_display_name: null,
    aliases: [],
    display_order: 20,
    is_active: false,
    memo: null,
  },
]

describe('CompaniesPage delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCompanies.mockReturnValue({ data: companies, isLoading: false, error: null })
    idleMutation.mutateAsync.mockResolvedValue({})
  })

  it('shows 削除 only on inactive companies', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '無効化' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '有効化' })).toHaveLength(1)
  })

  it('hard-deletes an inactive company after confirm', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({})
    useDeleteCompany.mockReturnValue({ mutateAsync, isPending: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(mutateAsync).toHaveBeenCalledWith(2)
  })

  it('does not delete when confirm is cancelled', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn()
    useDeleteCompany.mockReturnValue({ mutateAsync, isPending: false })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderPage()
    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
