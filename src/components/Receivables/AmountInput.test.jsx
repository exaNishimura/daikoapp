import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { AmountInput } from './AmountInput'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('AmountInput', () => {
  it('formats numeric value as ¥X,XXX when not focused', () => {
    renderWithTheme(<AmountInput value={2000} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('¥2,000')
  })

  it('renders empty string for null value', () => {
    renderWithTheme(<AmountInput value={null} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('renders 0 as ¥0', () => {
    renderWithTheme(<AmountInput value={0} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('¥0')
  })

  it('accepts plain numeric input and emits number on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<AmountInput value={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, '3000')
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith(3000)
  })

  it('accepts ¥-prefixed comma-separated input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<AmountInput value={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, '¥2,000')
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith(2000)
  })

  it('emits null when cleared', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<AmountInput value={2000} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.clear(input)
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('ignores non-numeric characters during typing', async () => {
    const user = userEvent.setup()
    renderWithTheme(<AmountInput value={null} onChange={() => {}} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, 'abc')

    expect(input).toHaveValue('')
  })

  it('shows raw digits while focused (no comma formatting during edit)', async () => {
    const user = userEvent.setup()
    renderWithTheme(<AmountInput value={2000} onChange={() => {}} />)
    const input = screen.getByRole('textbox')
    await user.click(input)

    expect(input).toHaveValue('2000')
  })

  it('re-formats after blur with new value via re-render', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = renderWithTheme(<AmountInput value={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, '5000')
    await user.tab()
    rerender(
      <Theme theme={stoneTheme} mode="light">
        <AmountInput value={5000} onChange={onChange} />
      </Theme>
    )

    expect(input).toHaveValue('¥5,000')
  })
})
