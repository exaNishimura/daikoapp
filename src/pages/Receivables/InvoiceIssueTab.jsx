import { useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
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
import { Send, Eye } from 'lucide-react'
import { useUnbilledByCompany } from '@/hooks/billing/useReceivables'
import { useIssueInvoices, usePreviewInvoice } from '@/hooks/billing/useInvoices'
import {
  STRATEGIES,
  INVOICE_MAX_LINES,
  recommendedStrategy,
} from '@/lib/billing/invoiceLineStrategies'
import { InvoiceIssueResultDialog } from './InvoiceIssueResultDialog'
import { InvoicePreviewDialog } from './InvoicePreviewDialog'

const STRATEGY_LABEL = {
  [STRATEGIES.NORMAL]: '通常発行',
  [STRATEGIES.MERGE]: '合算（"その他" 1 行に集約）',
  [STRATEGIES.SPLIT]: '分割（複数枚に分ける）',
  [STRATEGIES.SKIP]: 'スキップ',
}

/**
 * 月選択 → 未請求売掛を企業別に集約してプレビュー → 戦略選択 → 発行。
 */
export function InvoiceIssueTab({ year, month }) {
  const unbilledQuery = useUnbilledByCompany(year, month)
  const issueMutation = useIssueInvoices()
  const previewMutation = usePreviewInvoice()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [previewBusyId, setPreviewBusyId] = useState(null)

  const rows = useMemo(() => unbilledQuery.data ?? [], [unbilledQuery.data])

  // 各企業の { selected, strategy } を保持
  const [decisions, setDecisions] = useState({})

  const decisionFor = (row) => {
    const existing = decisions[row.company_id]
    if (existing) return existing
    return {
      selected: true,
      strategy: recommendedStrategy(row.line_count),
    }
  }

  const update = (companyId, patch) => {
    setDecisions((prev) => ({
      ...prev,
      [companyId]: { ...(prev[companyId] ?? {}), ...patch },
    }))
  }

  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState(null)

  const handlePreview = async (row) => {
    setPreviewError(null)
    setPreviewBusyId(row.company_id)
    try {
      const d = decisionFor(row)
      const data = await previewMutation.mutateAsync({
        year,
        month,
        companyId: row.company_id,
        strategy: d.strategy,
      })
      setPreviewData(data)
      setPreviewOpen(true)
    } catch (err) {
      setPreviewError(`プレビュー生成に失敗: ${err.message}`)
    } finally {
      setPreviewBusyId(null)
    }
  }

  const handleIssue = async () => {
    const targets = rows
      .map((r) => {
        const d = decisionFor(r)
        if (!d.selected) return null
        return { companyId: r.company_id, strategy: d.strategy }
      })
      .filter(Boolean)

    if (targets.length === 0) return

    try {
      const out = await issueMutation.mutateAsync({ year, month, targets })
      setResult(out)
      setResultOpen(true)
    } catch (err) {
      setResult({
        successes: [],
        failures: [{ companyId: 0, companyName: '全体エラー', error: err.message }],
      })
      setResultOpen(true)
    }
  }

  if (unbilledQuery.isLoading) {
    return (
      <Center padding={4}>
        <Spinner />
      </Center>
    )
  }

  if (rows.length === 0) {
    return (
      <Banner
        status="info"
        title={`${year} 年 ${month} 月の未請求売掛はありません。`}
        collapsible={false}
      />
    )
  }

  const selectedCount = rows.filter(
    (r) => decisionFor(r).selected && decisionFor(r).strategy !== STRATEGIES.SKIP
  ).length
  const totalAmount = rows
    .filter((r) => decisionFor(r).selected && decisionFor(r).strategy !== STRATEGIES.SKIP)
    .reduce((s, r) => s + r.total_amount, 0)
  const hasOverflow = rows.some((r) => r.line_count > INVOICE_MAX_LINES)

  return (
    <VStack gap={3}>
      {previewError ? (
        <Banner
          status="error"
          title={previewError}
          isDismissable
          onDismiss={() => setPreviewError(null)}
          collapsible={false}
        />
      ) : null}
      <Banner
        status="info"
        title="未請求の売掛だけが対象です。同月・同取引先でも、追加分を後から都度発行できます。"
        collapsible={false}
      />
      {hasOverflow ? (
        <Banner
          status="warning"
          title={`明細が ${INVOICE_MAX_LINES} 件を超える企業があります。`}
          description="請求書テンプレの行数を超過するため、対応方針を選択してください。"
          collapsible={false}
        />
      ) : null}

      <Card padding={3}>
        <HStack gap={3} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={3} wrap="wrap">
            <Text>
              対象企業: <Text weight="semibold">{selectedCount}</Text> / {rows.length} 社
            </Text>
            <Text>
              合計金額:{' '}
              <Text weight="semibold">¥{totalAmount.toLocaleString('ja-JP')}</Text>
            </Text>
          </HStack>
          <Button
            variant="primary"
            icon={<Send />}
            isDisabled={selectedCount === 0 || issueMutation.isPending}
            isLoading={issueMutation.isPending}
            onClick={handleIssue}
            label={issueMutation.isPending ? '発行中…' : `${selectedCount} 社を発行`}
          />
        </HStack>
      </Card>

      <Table density="compact" hasHover>
        <TableHeader>
          <TableRow isHeaderRow>
            <TableHeaderCell />
            <TableHeaderCell>取引先</TableHeaderCell>
            <TableHeaderCell>件数</TableHeaderCell>
            <TableHeaderCell>合計</TableHeaderCell>
            <TableHeaderCell>戦略</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const d = decisionFor(r)
            const isOverflow = r.line_count > INVOICE_MAX_LINES
            return (
              <TableRow
                key={r.company_id}
                style={
                  isOverflow
                    ? { backgroundColor: 'var(--color-background-yellow)' }
                    : undefined
                }
              >
                <TableCell>
                  <CheckboxInput
                    label={`${r.invoice_display_name || r.company_name} を発行対象にする`}
                    isLabelHidden
                    value={d.selected}
                    onChange={(checked) => update(r.company_id, { selected: checked })}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <VStack gap={0}>
                    <Text>{r.invoice_display_name || r.company_name}</Text>
                    {isOverflow ? (
                      <Text size="sm" style={{ color: 'var(--color-text-yellow)' }}>
                        {INVOICE_MAX_LINES} 件超過
                      </Text>
                    ) : null}
                  </VStack>
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.line_count}
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ¥{r.total_amount.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell>
                  {isOverflow ? (
                    <RadioList
                      label="発行戦略"
                      isLabelHidden
                      value={d.strategy}
                      onChange={(strategy) => update(r.company_id, { strategy })}
                      orientation="horizontal"
                      size="sm"
                    >
                      <RadioListItem
                        value={STRATEGIES.MERGE}
                        label={STRATEGY_LABEL[STRATEGIES.MERGE]}
                      />
                      <RadioListItem
                        value={STRATEGIES.SPLIT}
                        label={STRATEGY_LABEL[STRATEGIES.SPLIT]}
                      />
                      <RadioListItem
                        value={STRATEGIES.SKIP}
                        label={STRATEGY_LABEL[STRATEGIES.SKIP]}
                      />
                    </RadioList>
                  ) : (
                    <Text size="sm" color="secondary">
                      {STRATEGY_LABEL[STRATEGIES.NORMAL]}
                    </Text>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="プレビュー (発行はしません)"
                    tooltip="プレビュー (発行はしません)"
                    icon={<Eye />}
                    isDisabled={previewBusyId === r.company_id}
                    isLoading={previewBusyId === r.company_id}
                    onClick={() => handlePreview(r)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {result ? (
        <InvoiceIssueResultDialog
          open={resultOpen}
          result={result}
          onClose={() => setResultOpen(false)}
          year={year}
          month={month}
        />
      ) : null}

      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        companyName={previewData?.companyName}
        previews={previewData?.previews}
      />
    </VStack>
  )
}
