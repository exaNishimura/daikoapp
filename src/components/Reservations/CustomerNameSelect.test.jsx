import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { CustomerNameSelect } from './CustomerNameSelect'

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

describe('CustomerNameSelect', () => {
  it('renders selected company name', () => {
    renderWithTheme(
      <CustomerNameSelect companies={companies} value="株式会社 鈴友" onChange={() => {}} />
    )
    expect(screen.getByText('株式会社 鈴友')).toBeInTheDocument()
  })

  it('renders free-text value that is not in master', () => {
    renderWithTheme(
      <CustomerNameSelect companies={companies} value="山田太郎" onChange={() => {}} />
    )
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
  })

  it('filters options by alias', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '鈴友')

    expect(screen.getByText('株式会社 鈴友')).toBeInTheDocument()
    expect(screen.queryByText('田中商店')).not.toBeInTheDocument()
  })

  it('hides inactive companies', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)

    expect(screen.queryByText('休止クライアント')).not.toBeInTheDocument()
  })

  it('calls onChange with company display name on select', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.click(screen.getByText('田中商店'))

    expect(onChange).toHaveBeenCalledWith('田中商店')
  })

  it('shows free-text option when no exact match', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '山田太郎')

    expect(screen.getByText('「山田太郎」をそのまま使う')).toBeInTheDocument()
  })

  it('does not show free-text option when exact name exists', async () => {
    const user = userEvent.setup()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={() => {}} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '田中商店')

    expect(screen.queryByText('「田中商店」をそのまま使う')).not.toBeInTheDocument()
    expect(screen.getByText('田中商店')).toBeInTheDocument()
  })

  it('commits free text when that option is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<CustomerNameSelect companies={companies} value="" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, '山田太郎')
    await user.click(screen.getByText('「山田太郎」をそのまま使う'))

    expect(onChange).toHaveBeenCalledWith('山田太郎')
  })

  it('commits typed name on blur without adding to master', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(
      <div>
        <CustomerNameSelect companies={companies} value="" onChange={onChange} />
        <input aria-label="phone" />
      </div>
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'ブラー商事')
    await user.click(screen.getByLabelText('phone'))

    expect(onChange).toHaveBeenCalledWith('ブラー商事')
  })

  it('calls onChange with empty string when cleared', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(
      <CustomerNameSelect companies={companies} value="田中商店" onChange={onChange} />
    )
    const clearBtn = screen.getByLabelText(/clear/i)
    await user.click(clearBtn)

    expect(onChange).toHaveBeenCalledWith('')
  })
})
