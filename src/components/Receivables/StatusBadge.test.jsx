import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Theme } from '@astryxdesign/core/theme'
import { stoneTheme } from '@/theme/astryx/stoneTheme'
import { StatusBadge } from './StatusBadge'
import { receivableStatus, invoiceStatus } from './statusUtils'

function renderWithTheme(ui) {
  return render(
    <Theme theme={stoneTheme} mode="light">
      {ui}
    </Theme>
  )
}

describe('StatusBadge', () => {
  it.each([
    ['unbilled', '未請求'],
    ['billed', '請求済'],
    ['paid', '入金済'],
  ])('renders status=%s as label %s', (status, label) => {
    renderWithTheme(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('falls back to raw value for unknown status', () => {
    renderWithTheme(<StatusBadge status="weird" />)
    expect(screen.getByText('weird')).toBeInTheDocument()
  })
})

describe('receivableStatus', () => {
  it('returns paid when paid_at is set', () => {
    expect(receivableStatus({ invoice_id: 10, paid_at: '2026-06-01' })).toBe('paid')
  })

  it('returns billed when invoice_id is set and paid_at is null', () => {
    expect(receivableStatus({ invoice_id: 10, paid_at: null })).toBe('billed')
  })

  it('returns unbilled when invoice_id is null', () => {
    expect(receivableStatus({ invoice_id: null, paid_at: null })).toBe('unbilled')
  })

  it('treats missing fields as unbilled', () => {
    expect(receivableStatus({})).toBe('unbilled')
  })
})

describe('invoiceStatus', () => {
  it('returns paid when paid_at is set', () => {
    expect(invoiceStatus({ paid_at: '2026-06-01' })).toBe('paid')
  })

  it('returns billed when paid_at is null', () => {
    expect(invoiceStatus({ paid_at: null })).toBe('billed')
    expect(invoiceStatus({})).toBe('billed')
  })
})
