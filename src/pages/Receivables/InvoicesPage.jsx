import { useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { PageFrame } from '@/components/PageFrame'
import { PageHeader } from '@/components/PageHeader'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { currentYearMonth, fromMonthString } from '@/components/Receivables/monthUtils'
import { InvoiceIssueTab } from './InvoiceIssueTab'
import { InvoiceIssuedTab } from './InvoiceIssuedTab'
import { InvoiceUnpaidTab } from './InvoiceUnpaidTab'

const TABS = {
  issue: 'issue',
  issued: 'issued',
  unpaid: 'unpaid',
}

export function InvoicesPage() {
  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [tab, setTab] = useState(TABS.issue)

  const { year, month } = fromMonthString(monthValue) ?? { year: 2026, month: 1 }

  return (
    <PageFrame>
      <VStack gap={4}>
        <PageHeader
          title="請求書"
          actions={
            tab !== TABS.unpaid ? (
              <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
            ) : null
          }
        />

        <Card padding={2}>
          <VStack gap={3}>
            <TabList value={tab} onChange={setTab} role="tablist" hasDivider>
              <Tab value={TABS.issue} label="新規発行" panelId="invoice-panel-issue" />
              <Tab value={TABS.issued} label="発行済一覧" panelId="invoice-panel-issued" />
              <Tab value={TABS.unpaid} label="未入金一覧" panelId="invoice-panel-unpaid" />
            </TabList>
            {tab === TABS.issue ? (
              <VStack id="invoice-panel-issue" role="tabpanel" gap={0}>
                <InvoiceIssueTab year={year} month={month} />
              </VStack>
            ) : null}
            {tab === TABS.issued ? (
              <VStack id="invoice-panel-issued" role="tabpanel" gap={0}>
                <InvoiceIssuedTab year={year} month={month} />
              </VStack>
            ) : null}
            {tab === TABS.unpaid ? (
              <VStack id="invoice-panel-unpaid" role="tabpanel" gap={0}>
                <InvoiceUnpaidTab />
              </VStack>
            ) : null}
          </VStack>
        </Card>
      </VStack>
    </PageFrame>
  )
}
