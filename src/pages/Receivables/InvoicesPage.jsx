import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Card } from '@astryxdesign/core/Card'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { ArrowLeft } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString } from '@/components/Receivables/monthUtils'
import { InvoiceIssueTab } from './InvoiceIssueTab'
import { InvoiceIssuedTab } from './InvoiceIssuedTab'
import { InvoiceUnpaidTab } from './InvoiceUnpaidTab'

function currentYearMonth() {
  return toMonthString(new Date()) ?? '2026-01'
}

const TABS = {
  issue: 'issue',
  issued: 'issued',
  unpaid: 'unpaid',
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [tab, setTab] = useState(TABS.issue)

  const { year, month } = fromMonthString(monthValue) ?? { year: 2026, month: 1 }

  return (
    <PageFrame>
      <VStack gap={4}>
        <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            <IconButton
              label="戻る"
              icon={<ArrowLeft />}
              variant="ghost"
              onClick={() => navigate(-1)}
            />
            <Heading level={1}>請求書</Heading>
          </HStack>
          {tab !== TABS.unpaid ? (
            <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
          ) : null}
        </HStack>

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
