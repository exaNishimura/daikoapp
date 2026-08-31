import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { CompanySelect } from './CompanySelect'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

const companies = [
  {
    id: 1,
    name: '株式会社 鈴友',
    invoice_display_name: '株式会社 鈴友',
    aliases: ['鈴友', '(株)鈴友'],
    is_active: true,
  },
  {
    id: 2,
    name: '田中商店',
    invoice_display_name: null,
    aliases: ['田中'],
    is_active: true,
  },
  {
    id: 3,
    name: '休止クライアント',
    invoice_display_name: null,
    aliases: [],
    is_active: false,
  },
]

describe('CompanySelect', () => {
  it('renders selected company by id', () => {
    renderWithTheme(<CompanySelect companies={companies} value={1} onChange={() => {}} />)
    expect(screen.getByText('株式会社 鈴友')).toBeInTheDocument()
  })

  it('renders empty when value is null', () => {
    renderWithTheme(<CompanySelect companies={companies} value={null} onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('filters options by alias (鈴友 hits 株式会社 鈴友)', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CompanySelect companies={companies} value={null} onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '鈴友')

    expect(screen.getByText('株式会社 鈴友')).toBeInTheDocument()
    expect(screen.queryByText('田中商店')).not.toBeInTheDocument()
  })

  it('filters options by name fragment', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CompanySelect companies={companies} value={null} onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '田中')

    expect(screen.getByText('田中商店')).toBeInTheDocument()
    expect(screen.queryByText('株式会社 鈴友')).not.toBeInTheDocument()
  })

  it('hides inactive companies by default', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CompanySelect companies={companies} value={null} onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)

    expect(screen.queryByText('休止クライアント')).not.toBeInTheDocument()
  })

  it('shows inactive companies with (無効) badge when includeInactive', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <CompanySelect companies={companies} value={null} onChange={() => {}} includeInactive />
    )
    const input = screen.getByRole('combobox')
    await user.click(input)

    expect(screen.getByText('休止クライアント')).toBeInTheDocument()
    expect(screen.getByText('(無効)')).toBeInTheDocument()
  })

  it('calls onChange with selected company id', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<CompanySelect companies={companies} value={null} onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.click(screen.getByText('田中商店'))

    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('calls onChange with null when cleared', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<CompanySelect companies={companies} value={1} onChange={onChange} />)
    const clearBtn = screen.getByLabelText(/clear/i)
    await user.click(clearBtn)

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows create option when creatable and no exact match', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <CompanySelect
        companies={companies}
        value={null}
        onChange={() => {}}
        creatable
        onCreate={vi.fn()}
      />
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '新規株式会社')

    expect(screen.getByText('「新規株式会社」を新規追加')).toBeInTheDocument()
  })

  it('does not show create option when exact name already exists', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <CompanySelect
        companies={companies}
        value={null}
        onChange={() => {}}
        creatable
        onCreate={vi.fn()}
      />
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '田中商店')

    expect(screen.queryByText('「田中商店」を新規追加')).not.toBeInTheDocument()
    expect(screen.getByText('田中商店')).toBeInTheDocument()
  })

  it('calls onCreate then onChange with new id when create option selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 99, name: '新規株式会社' })
    renderWithTheme(
      <CompanySelect
        companies={companies}
        value={null}
        onChange={onChange}
        creatable
        onCreate={onCreate}
      />
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '新規株式会社')
    await user.click(screen.getByText('「新規株式会社」を新規追加'))

    expect(onCreate).toHaveBeenCalledWith('新規株式会社')
    expect(onChange).toHaveBeenCalledWith(99)
  })

  it('creates company on blur when creatable and name typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 88, name: 'ブラー商事' })
    renderWithTheme(
      <div>
        <CompanySelect
          companies={companies}
          value={null}
          onChange={onChange}
          creatable
          onCreate={onCreate}
        />
        <input aria-label="amount" />
      </div>
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'ブラー商事')
    await user.click(screen.getByLabelText('amount'))

    expect(onCreate).toHaveBeenCalledWith('ブラー商事')
    expect(onChange).toHaveBeenCalledWith(88)
    expect(input).toHaveValue('ブラー商事')
  })
})
