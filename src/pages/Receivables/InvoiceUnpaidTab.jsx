import { useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
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
import {
  useUnpaidInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
} from '@/hooks/billing/useInvoices'
import { daysOverdue, summarizeUnpaidInvoices } from '@/lib/billing/invoiceAging'

function fmtMonth(billingMonth) {
  if (!billingMonth) return ''
  const m = String(billingMonth).match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}年${m[2]}月` : billingMonth
}

function fmtDate(s) {
  if (!s) return '—'
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s
}

export function InvoiceUnpaidTab() {
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
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                総未収金額
              </Text>
              <Text weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ¥{summary.total_unpaid.toLocaleString('ja-JP')}
              </Text>
            </VStack>
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                件数
              </Text>
              <Text weight="semibold">{summary.invoice_count}</Text>
            </VStack>
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                平均滞留日数
              </Text>
              <Text weight="semibold">{summary.average_days_overdue} 日</Text>
            </VStack>
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                60 日超アラート
              </Text>
              <HStack gap={1} vAlign="center">
                {summary.over_60_count > 0 ? (
                  <CircleAlert size={16} color="var(--color-text-red)" />
                ) : null}
                <Text
                  weight="semibold"
                  style={summary.over_60_count > 0 ? { color: 'var(--color-text-red)' } : undefined}
                >
                  {summary.over_60_count} 件
                </Text>
              </HStack>
            </VStack>
          </Grid>

          {summary.by_company.length > 0 ? (
            <VStack gap={2}>
              <Divider label="企業別未収金" />
              <Grid columns={{ minWidth: 220 }} gap={2}>
                {summary.by_company.map((c) => (
                  <Card
                    key={c.company_id}
                    padding={2}
                    variant={c.max_days_overdue > 60 ? 'red' : 'muted'}
                  >
                    <VStack gap={0}>
                      <Text size="sm" color="secondary">
                        {c.invoice_display_name || c.company_name}
                      </Text>
                      <Text weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        ¥{c.total_unpaid.toLocaleString('ja-JP')}
                      </Text>
                      <Text size="sm" color="secondary">
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
                  <TableCell>{fmtMonth(r.billing_month)}</TableCell>
                  <TableCell>{r.companies?.invoice_display_name || r.companies?.name}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
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
