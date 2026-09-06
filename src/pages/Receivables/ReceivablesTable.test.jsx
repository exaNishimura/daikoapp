import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { ReceivablesTable } from './ReceivablesTable'

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
    name: '鈴友',
    invoice_display_name: '鈴友',
    aliases: [],
    is_active: true,
  },
]

const septemberRow = {
  id: 1,
  company_id: 1,
  work_date: '2026-09-06',
  vehicle_num: 1,
  departure: '出発',
  destination: '到着',
  amount: 5000,
  note: '',
  invoice_id: null,
  companies: companies[0],
}

describe('ReceivablesTable edit', () => {
  it('does not crash when editing a September row (30-day month)', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <ReceivablesTable
        rows={[septemberRow]}
        companies={companies}
        options={{ year: 2026, month: 9 }}
        onUpdate={async () => {}}
        onDelete={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: '編集' }))

    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
  })
})
