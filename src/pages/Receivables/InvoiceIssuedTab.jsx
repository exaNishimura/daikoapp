import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
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
import { Download, FolderArchive, RefreshCw, Trash2 } from 'lucide-react'
import {
  useInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
  useRevokeInvoice,
} from '@/hooks/billing/useInvoices'
import { downloadInvoicesZip } from '@/lib/billing/downloadInvoicesZip'
import { InvoiceReissueDialog } from './InvoiceReissueDialog'

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

/** 発行時と同じ命名: `YYYYMM_会社名様_請求書_#id`（同月複数枚を区別） */
function invoiceDisplayName(row, year, month) {
  const ymPrefix = `${year}${String(month).padStart(2, '0')}`
  const baseName =
    row.companies?.invoice_display_name || row.companies?.name || `company-${row.company_id}`
  return `${ymPrefix}_${baseName}様_請求書_#${row.id}`
}

export function InvoiceIssuedTab({ year, month }) {
  const invoicesQuery = useInvoices({ year, month })
  const dlInvoice = useDownloadInvoice()
  const markPaid = useMarkInvoicePaid()
  const revoke = useRevokeInvoice()
  const [error, setError] = useState(null)
  const [zipWarning, setZipWarning] = useState(null)
  const [zipBusy, setZipBusy] = useState(false)
  const [reissueTarget, setReissueTarget] = useState(null)

  const rows = invoicesQuery.data ?? []
  const downloadableCount = rows.filter((r) => r.file_path).length

  const clearAlerts = () => {
    setError(null)
    setZipWarning(null)
  }

  const handleTogglePaid = async (row) => {
    clearAlerts()
    try {
      await markPaid.mutateAsync({
        id: row.id,
        paidAt: row.paid_at ? null : new Date(),
      })
    } catch (err) {
      setError(`入金状態の更新に失敗: ${err.message}`)
    }
  }

  const handleRevoke = async (row) => {
    if (
      !window.confirm(
        `「${row.companies?.name}」の ${fmtMonth(row.billing_month)} 請求書（#${row.id}）を取消します。よろしいですか?`
      )
    ) {
      return
    }
    clearAlerts()
    try {
      await revoke.mutateAsync(row.id)
    } catch (err) {
      setError(`取消に失敗: ${err.message}`)
    }
  }

  const handleDownload = async (row) => {
    clearAlerts()
    if (!row.file_path) {
      setError('この請求書には Storage ファイルが紐づいていません')
      return
    }
    try {
      await dlInvoice.mutateAsync({
        filePath: row.file_path,
        displayName: invoiceDisplayName(row, year, month),
      })
    } catch (err) {
      setError(`ダウンロードに失敗: ${err.message}`)
    }
  }

  const handleZipDownload = async () => {
    clearAlerts()
    setZipBusy(true)
    try {
      const { included, skipped } = await downloadInvoicesZip(
        rows.map((r) => ({
          filePath: r.file_path,
          displayName: invoiceDisplayName(r, year, month),
        })),
        `invoices-${year}${String(month).padStart(2, '0')}`
      )
      if (skipped > 0) {
        setZipWarning(
          `${included} 件を zip に含めました（${skipped} 件はファイルなし／取得失敗のためスキップ）`
        )
      }
    } catch (err) {
      setError(`一括ダウンロードに失敗: ${err.message}`)
    } finally {
      setZipBusy(false)
    }
  }

  if (invoicesQuery.isLoading) {
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
      {zipWarning ? (
        <Banner
          status="warning"
          title={zipWarning}
          isDismissable
          onDismiss={() => setZipWarning(null)}
          collapsible={false}
        />
      ) : null}
      {invoicesQuery.error ? (
        <Banner
          status="error"
          title={`請求書の取得に失敗: ${invoicesQuery.error.message}`}
          collapsible={false}
        />
      ) : null}

      {rows.length === 0 ? (
        <Banner
          status="info"
          title={`${year} 年 ${month} 月の発行済請求書はありません。`}
          collapsible={false}
        />
      ) : (
        <VStack gap={2}>
          <HStack gap={1} wrap="wrap" vAlign="center" hAlign="between">
            <Text color="secondary">
              {rows.length} 件
              {downloadableCount < rows.length ? `（うち DL 可 ${downloadableCount} 件）` : null}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              icon={<FolderArchive />}
              label={zipBusy ? 'zip 生成中…' : '全件 zip で DL'}
              onClick={handleZipDownload}
              isDisabled={zipBusy || downloadableCount === 0}
              isLoading={zipBusy}
            />
          </HStack>
          <Table density="compact" hasHover>
            <TableHeader>
              <TableRow isHeaderRow>
                <TableHeaderCell>請求月</TableHeaderCell>
                <TableHeaderCell>取引先</TableHeaderCell>
                <TableHeaderCell>発行日</TableHeaderCell>
                <TableHeaderCell>件数</TableHeaderCell>
                <TableHeaderCell>金額</TableHeaderCell>
                <TableHeaderCell>入金</TableHeaderCell>
                <TableHeaderCell>操作</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtMonth(r.billing_month)}</TableCell>
                  <TableCell>{r.companies?.invoice_display_name || r.companies?.name}</TableCell>
                  <TableCell>{fmtDate(r.issue_date)}</TableCell>
                  <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.line_count}
                  </TableCell>
                  <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ¥{Number(r.total_amount).toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    <VStack gap={0} hAlign="center">
                      <CheckboxInput
                        label={`${r.companies?.name ?? r.id} 入金済`}
                        isLabelHidden
                        value={!!r.paid_at}
                        onChange={() => handleTogglePaid(r)}
                        isDisabled={markPaid.isPending}
                        size="sm"
                      />
                      {r.paid_at ? (
                        <Text size="sm" color="secondary">
                          {fmtDate(r.paid_at.slice(0, 10))}
                        </Text>
                      ) : null}
                    </VStack>
                  </TableCell>
                  <TableCell>
                    <HStack gap={0} hAlign="center">
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="ダウンロード"
                        tooltip="ダウンロード"
                        icon={<Download />}
                        onClick={() => handleDownload(r)}
                        isDisabled={!r.file_path || dlInvoice.isPending || zipBusy}
                      />
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="修正して再発行"
                        tooltip={
                          r.paid_at ? '入金済みのため修正不可（先に入金解除）' : '修正して再発行'
                        }
                        icon={<RefreshCw />}
                        onClick={() => setReissueTarget(r)}
                        isDisabled={!!r.paid_at || revoke.isPending || zipBusy}
                      />
                      <IconButton
                        size="sm"
                        variant="destructive"
                        label="取消"
                        tooltip={r.paid_at ? '入金済みのため取消不可' : '取消'}
                        icon={<Trash2 />}
                        onClick={() => handleRevoke(r)}
                        isDisabled={!!r.paid_at || revoke.isPending || zipBusy}
                      />
                    </HStack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </VStack>
      )}

      <InvoiceReissueDialog
        open={!!reissueTarget}
        invoice={reissueTarget}
        year={year}
        month={month}
        onClose={() => setReissueTarget(null)}
      />
    </VStack>
  )
}
