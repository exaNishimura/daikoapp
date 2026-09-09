import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { SummaryStat } from './SummaryStat'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('SummaryStat', () => {
  it('renders a supporting label and a condensed numeric value', () => {
    renderWithTheme(<SummaryStat label="件数" value="15" />)
    expect(screen.getByText('件数')).toBeInTheDocument()
    const value = screen.getByText('15')
    expect(value).toHaveStyle({ fontFamily: '"Roboto Condensed", "Figtree", sans-serif' })
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})
