import { useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Divider } from '@astryxdesign/core/Divider'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { CircleAlert, Download } from 'lucide-react'
import { SummaryStat } from '@/components/SummaryStat'
import {
  useUnpaidInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
} from '@/hooks/billing/useInvoices'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { formatBillingMonth, formatIsoDate } from '@/components/Receivables/monthUtils'
import { daysOverdue, summarizeUnpaidInvoices } from '@/lib/billing/invoiceAging'

function UnpaidCard({ row, days, overdue, onMarkPaid, onDownload, markPaidPending, dlPending }) {
  const companyLabel = row.companies?.invoice_display_name || row.companies?.name
  return (
    <Card
      padding={3}
      style={overdue ? { backgroundColor: 'var(--color-background-red)' } : undefined}
    >
      <VStack gap={2}>
        <HStack hAlign="between" vAlign="start" gap={2} wrap="wrap">
          <VStack gap={0}>
            <Text weight="medium">{companyLabel}</Text>
            <Text color="secondary">
              {formatBillingMonth(row.billing_month)} / 発行 {formatIsoDate(row.issue_date)}
            </Text>
          </VStack>
          <VStack gap={0} hAlign="end">
            <Text type="large" hasTabularNumbers>
              ¥{Number(row.total_amount).toLocaleString('ja-JP')}
            </Text>
            {overdue ? (
              <Token size="sm" color="red" label={`滞留 ${days} 日`} />
            ) : (
              <Text color="secondary">滞留 {days} 日</Text>
            )}
          </VStack>
        </HStack>
        <CheckboxInput
          label="入金済にする"
          value={false}
          onChange={() => onMarkPaid(row)}
          isDisabled={markPaidPending}
          size="lg"
        />
        <Button
          label="ダウンロード"
          variant="secondary"
          size="lg"
          width="100%"
          icon={<Download />}
          onClick={() => onDownload(row)}
          isDisabled={!row.file_path || dlPending}
        />
      </VStack>
    </Card>
  )
}

export function InvoiceUnpaidTab() {
  const isMobile = useIsMobile()
  const query = useUnpaidInvoices()
  const dlInvoice = useDownloadInvoice()
  const markPaid = useMarkInvoicePaid()
  const [error, setError] = useState(null)

  const rows = useMemo(() => query.data ?? [], [query.data])
  const today = useMemo(() => new Date(), [])

  const summary = useMemo(() => summarizeUnpaidInvoices(rows, today), [rows, today])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(a.billing_month) - new Date(b.billing_month)),
    [rows]
  )

  const handleMarkPaid = async (row) => {
    setError(null)
    try {
      await markPaid.mutateAsync({ id: row.id, paidAt: new Date() })
    } catch (err) {
      setError(`入金記録の更新に失敗: ${err.message}`)
    }
  }

  const handleDownload = async (row) => {
    setError(null)
    if (!row.file_path) {
      setError('この請求書には Storage ファイルが紐づいていません')
      return
    }
    try {
      await dlInvoice.mutateAsync({
        filePath: row.file_path,
        displayName: row.companies?.invoice_display_name || row.companies?.name || null,
      })
    } catch (err) {
      setError(`ダウンロードに失敗: ${err.message}`)
    }
  }

  if (query.isLoading) {
    return (
      <Center padding={4}>
        <Spinner />
      </Center>
    )
  }

  return (
    <VStack gap={3}>
      {error ? (
        <Banner
          status="error"
          title={error}
          isDismissable
          onDismiss={() => setError(null)}
          collapsible={false}
        />
      ) : null}
      {query.error ? (
        <Banner
          status="error"
          title={`未入金請求書の取得に失敗: ${query.error.message}`}
          collapsible={false}
        />
      ) : null}

      <Card padding={3}>
        <VStack gap={3}>
          <Heading level={3}>未入金サマリ</Heading>
          <Grid columns={{ minWidth: 140 }} gap={2}>
            <SummaryStat
              label="総未収金額"
              value={`¥${summary.total_unpaid.toLocaleString('ja-JP')}`}
            />
            <SummaryStat label="件数" value={summary.invoice_count} />
            <SummaryStat label="平均滞留日数" value={`${summary.average_days_overdue} 日`} />
            <SummaryStat
              label="60 日超アラート"
              value={`${summary.over_60_count} 件`}
              tone={summary.over_60_count > 0 ? 'danger' : undefined}
              start={
                summary.over_60_count > 0 ? (
                  <CircleAlert size={20} color="var(--color-text-red)" />
                ) : null
              }
            />
          </Grid>

          {summary.by_company.length > 0 ? (
            <VStack gap={2}>
              <Divider label="企業別未収金" />
              <Grid columns={isMobile ? 1 : { minWidth: 220 }} gap={2}>
                {summary.by_company.map((c) => (
                  <Card
                    key={c.company_id}
                    padding={2}
                    variant={c.max_days_overdue > 60 ? 'red' : 'muted'}
                  >
                    <VStack gap={0}>
                      <Text type="supporting">
                        {c.invoice_display_name || c.company_name}
                      </Text>
                      <Text type="large" hasTabularNumbers>
                        ¥{c.total_unpaid.toLocaleString('ja-JP')}
                      </Text>
                      <Text type="supporting">
                        {c.invoice_count} 件 · 最長 {c.max_days_overdue} 日
                      </Text>
                    </VStack>
                  </Card>
                ))}
              </Grid>
            </VStack>
          ) : null}
        </VStack>
      </Card>

      {sortedRows.length === 0 ? (
        <Banner status="success" title="未入金の請求書はありません。" collapsible={false} />
      ) : isMobile ? (
        <VStack gap={2}>
          {sortedRows.map((r) => {
            const days = daysOverdue(r.issue_date, today) ?? 0
            const overdue = days > 60
            return (
              <UnpaidCard
                key={r.id}
                row={r}
                days={days}
                overdue={overdue}
                onMarkPaid={handleMarkPaid}
                onDownload={handleDownload}
                markPaidPending={markPaid.isPending}
                dlPending={dlInvoice.isPending}
              />
            )
          })}
        </VStack>
      ) : (
        <Table density="compact" hasHover>
          <TableHeader>
            <TableRow isHeaderRow>
              <TableHeaderCell>請求月</TableHeaderCell>
              <TableHeaderCell>取引先</TableHeaderCell>
              <TableHeaderCell>発行日</TableHeaderCell>
              <TableHeaderCell>金額</TableHeaderCell>
              <TableHeaderCell>滞留日数</TableHeaderCell>
              <TableHeaderCell>入金済</TableHeaderCell>
              <TableHeaderCell>操作</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((r) => {
              const days = daysOverdue(r.issue_date, today) ?? 0
              const overdue = days > 60
              return (
                <TableRow
                  key={r.id}
                  style={overdue ? { backgroundColor: 'var(--color-background-red)' } : undefined}
                >
                  <TableCell>{formatBillingMonth(r.billing_month)}</TableCell>
                  <TableCell>{r.companies?.invoice_display_name || r.companies?.name}</TableCell>
                  <TableCell>{formatIsoDate(r.issue_date)}</TableCell>
                  <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ¥{Number(r.total_amount).toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    {overdue ? (
                      <Token size="sm" color="red" label={`${days} 日`} />
                    ) : (
                      <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{days} 日</Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Center>
                      <CheckboxInput
                        label={`${r.companies?.name ?? r.id} を入金済にする`}
                        isLabelHidden
                        value={false}
                        onChange={() => handleMarkPaid(r)}
                        isDisabled={markPaid.isPending}
                        size="sm"
                      />
                    </Center>
                  </TableCell>
                  <TableCell>
                    <Center>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="ダウンロード"
                        tooltip="ダウンロード"
                        icon={<Download />}
                        onClick={() => handleDownload(r)}
                        isDisabled={!r.file_path || dlInvoice.isPending}
                      />
                    </Center>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </VStack>
  )
}
