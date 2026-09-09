import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { AccountMenu } from './AccountMenu'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('AccountMenu', () => {
  it('keeps email and logout hidden until the avatar is opened', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    renderWithTheme(<AccountMenu email="dev@localhost" onLogout={onLogout} />)

    const trigger = screen.getByRole('button', { name: 'アカウント' })
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()

    await user.click(trigger)

    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeVisible()
    expect(screen.getByText('dev@localhost')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
