import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { MonthNav } from './MonthNav'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('MonthNav', () => {
  it('renders the year-month label and nav buttons', () => {
    renderWithTheme(<MonthNav year={2026} month={10} onChange={() => {}} />)
    expect(screen.getByRole('heading', { name: '2026年10月' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前月' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次月' })).toBeInTheDocument()
  })

  it('emits the previous month from the 前月 button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<MonthNav year={2026} month={1} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '前月' }))
    expect(onChange).toHaveBeenCalledWith({ year: 2025, month: 12 })
  })

  it('emits the next month from the 次月 button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithTheme(<MonthNav year={2026} month={12} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '次月' }))
    expect(onChange).toHaveBeenCalledWith({ year: 2027, month: 1 })
  })
})
