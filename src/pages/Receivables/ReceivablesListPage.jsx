import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString } from '@/components/Receivables/monthUtils'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { useCompanies } from '@/hooks/billing/useCompanies'
import {
  useCreateReceivable,
  useDeleteReceivable,
  useReceivables,
  useUpdateReceivable,
} from '@/hooks/billing/useReceivables'
import { buildReceivablesCsv } from '@/lib/billing/exportReceivablesCsv'
import { summarizeReceivables } from '@/lib/billing/receivablesSummary'
import { ReceivablesTable } from './ReceivablesTable'
import { ReceivablesAddRow } from './ReceivablesAddRow'

function currentYearMonth() {
  const d = new Date()
  return toMonthString(d) ?? '2026-01'
}

function downloadTextFile(filename, content, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const INVOICED_OPTIONS = [
  { value: 'all', label: '全て' },
  { value: 'unbilled', label: '未請求のみ' },
  { value: 'billed', label: '請求済のみ' },
]

const PAID_OPTIONS = [
  { value: 'all', label: '全て' },
  { value: 'paid', label: '入金済のみ' },
  { value: 'unpaid', label: '未入金のみ' },
]

export function ReceivablesListPage() {
  const navigate = useNavigate()

  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [companyId, setCompanyId] = useState(null)
  const [invoicedFilter, setInvoicedFilter] = useState('all') // all | billed | unbilled
  const [paidFilter, setPaidFilter] = useState('all') // all | paid | unpaid
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const parsedMonth = fromMonthString(monthValue) ?? { year: 2026, month: 1 }
  const { year, month } = parsedMonth

  const invoicedFlag =
    invoicedFilter === 'billed' ? true : invoicedFilter === 'unbilled' ? false : undefined

  const companiesQuery = useCompanies()
  const receivablesQuery = useReceivables({
    year,
    month,
    companyId: companyId ?? undefined,
    invoiced: invoicedFlag,
  })
  const createMutation = useCreateReceivable()
  const updateMutation = useUpdateReceivable()
  const deleteMutation = useDeleteReceivable()

  const allCompanies = companiesQuery.data ?? []

  const rows = useMemo(() => {
    const rawRows = receivablesQuery.data ?? []
    let filtered = rawRows
    if (paidFilter === 'paid') {
      filtered = filtered.filter((r) => r.invoices?.paid_at)
    } else if (paidFilter === 'unpaid') {
      filtered = filtered.filter((r) => !r.invoices?.paid_at)
    }
    return [...filtered].sort((a, b) => {
      const cmp = String(b.work_date).localeCompare(String(a.work_date))
      if (cmp !== 0) return cmp
      return (b.id ?? 0) - (a.id ?? 0)
    })
  }, [receivablesQuery.data, paidFilter])

  const summary = useMemo(() => summarizeReceivables(rows), [rows])

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const handleCreate = async (payload) => {
    setError(null)
    try {
      await createMutation.mutateAsync(payload)
      setSuccess('売掛を追加しました')
    } catch (err) {
      setError(`追加に失敗: ${err.message}`)
      throw err
    }
  }

  const handleUpdate = async (payload, row) => {
    setError(null)
    try {
      await updateMutation.mutateAsync({ id: row.id, payload })
      setSuccess('売掛を更新しました')
    } catch (err) {
      setError(`更新に失敗: ${err.message}`)
      throw err
    }
  }

  const handleDelete = async (row) => {
    if (row.invoice_id != null) {
      setError('請求書発行済みの売掛は削除できません。先に請求書を取り消してください')
      return
    }
    if (
      !confirm(
        `${row.work_date} / ${row.companies?.name ?? ''} / ¥${Number(
          row.amount ?? 0
        ).toLocaleString('ja-JP')} を削除しますか？`
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteMutation.mutateAsync(row.id)
      setSuccess('売掛を削除しました')
    } catch (err) {
      setError(`削除に失敗: ${err.message}`)
    }
  }

  const handleExportCsv = () => {
    const csv = buildReceivablesCsv(rows)
    const ym = `${year}${String(month).padStart(2, '0')}`
    downloadTextFile(`receivables-${ym}.csv`, csv)
  }

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
            <Heading level={1}>売掛一覧</Heading>
          </HStack>
          <HStack gap={1} wrap="wrap">
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload />}
              label="Excel インポート"
              onClick={() => navigate('/admin/receivables/import')}
            />
            <Button
              variant="secondary"
              icon={<Download />}
              label="CSV エクスポート"
              onClick={handleExportCsv}
              isDisabled={receivablesQuery.isLoading || rows.length === 0}
            />
          </HStack>
        </HStack>

        <Card padding={3}>
          <HStack gap={2} wrap="wrap" vAlign="start">
            <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
            <CompanySelect
              companies={allCompanies}
              value={companyId}
              onChange={setCompanyId}
              includeInactive
              label="取引先 (全て)"
            />
            <Selector
              label="請求状態"
              options={INVOICED_OPTIONS}
              value={invoicedFilter}
              onChange={setInvoicedFilter}
              size="sm"
            />
            <Selector
              label="入金状態"
              options={PAID_OPTIONS}
              value={paidFilter}
              onChange={setPaidFilter}
              size="sm"
            />
          </HStack>
        </Card>

        <Card padding={3}>
          <HStack gap={3} wrap="wrap" vAlign="start">
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                件数
              </Text>
              <Text weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {summary.count}
              </Text>
            </VStack>
            <Divider orientation="vertical" />
            <VStack gap={0}>
              <Text size="sm" color="secondary">
                合計金額
              </Text>
              <Text weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ¥{summary.totalAmount.toLocaleString('ja-JP')}
              </Text>
            </VStack>
            {summary.byCompany.length > 0 ? (
              <VStack gap={1}>
                <Text size="sm" color="secondary">
                  企業別合計 (上位)
                </Text>
                <HStack gap={1} wrap="wrap">
                  {summary.byCompany.slice(0, 6).map((c) => (
                    <Token
                      key={c.companyId}
                      size="sm"
                      label={`${c.companyName} ×${c.count} / ¥${c.total.toLocaleString('ja-JP')}`}
                    />
                  ))}
                  {summary.byCompany.length > 6 ? (
                    <Text size="sm" color="secondary">
                      ...他 {summary.byCompany.length - 6} 社
                    </Text>
                  ) : null}
                </HStack>
              </VStack>
            ) : null}
          </HStack>
        </Card>

        {error ? (
          <Banner
            status="error"
            title={error}
            isDismissable
            onDismiss={() => setError(null)}
            collapsible={false}
          />
        ) : null}
        {success ? (
          <Banner
            status="success"
            title={success}
            isDismissable
            onDismiss={() => setSuccess(null)}
            collapsible={false}
          />
        ) : null}
        {receivablesQuery.error ? (
          <Banner
            status="error"
            title={`売掛データの取得に失敗: ${receivablesQuery.error.message}`}
            collapsible={false}
          />
        ) : null}

        <ReceivablesAddRow
          companies={allCompanies}
          year={year}
          month={month}
          onCreate={handleCreate}
          isSaving={createMutation.isPending}
        />

        <ReceivablesTable
          rows={rows}
          companies={allCompanies}
          options={{ year, month }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isSaving={isMutating}
        />
      </VStack>
    </PageFrame>
  )
}
