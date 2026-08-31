import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { Download, FolderArchive } from 'lucide-react'
import { downloadInvoicesZip } from '@/lib/billing/downloadInvoicesZip'
import { useDownloadInvoice } from '@/hooks/billing/useInvoices'

/**
 * 発行結果ダイアログ。
 * - 成功: 個別 DL リンク + 「全件 zip でダウンロード」
 * - 失敗: 企業名 + エラーメッセージ
 */
export function InvoiceIssueResultDialog({ open, result, onClose, year, month }) {
  const dlInvoice = useDownloadInvoice()
  const [zipBusy, setZipBusy] = useState(false)
  const [zipError, setZipError] = useState(null)

  const handleZip = async () => {
    setZipError(null)
    setZipBusy(true)
    try {
      await downloadInvoicesZip(
        result.successes.map((s) => ({
          filePath: s.filePath,
          displayName: s.displayName,
        })),
        `invoices-${year}${String(month).padStart(2, '0')}`
      )
    } catch (err) {
      setZipError(err.message)
    } finally {
      setZipBusy(false)
    }
  }

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const successes = result?.successes ?? []
  const failures = result?.failures ?? []

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="info">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="請求書発行 結果" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {successes.length > 0 ? (
                <VStack gap={2}>
                  <Banner
                    status="success"
                    title={`${successes.length} 件の請求書を発行しました`}
                    endContent={
                      <Button
                        size="sm"
                        icon={<FolderArchive />}
                        label={zipBusy ? 'zip 生成中…' : '全件 zip で DL'}
                        onClick={handleZip}
                        isDisabled={zipBusy || successes.every((s) => !s.filePath)}
                        isLoading={zipBusy}
                      />
                    }
                    collapsible={false}
                  />
                  {zipError ? <Banner status="error" title={zipError} collapsible={false} /> : null}
                  <List>
                    {successes.map((s, idx) => (
                      <ListItem
                        key={`${s.companyId}-${s.sequence?.index ?? 0}-${idx}`}
                        label={
                          s.displayName ||
                          (s.sequence
                            ? `企業 #${s.companyId} (${s.sequence.index}/${s.sequence.total} 枚目)`
                            : `企業 #${s.companyId}`)
                        }
                        description={
                          <>
                            ¥{Number(s.totalAmount ?? 0).toLocaleString('ja-JP')}
                            {' · '}
                            {s.lineCount ?? '?'} 件
                            {s.filePath ? ` · ${s.filePath}` : ' · Storage 未保存'}
                          </>
                        }
                        endContent={
                          s.filePath ? (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              label="ダウンロード"
                              icon={<Download />}
                              onClick={() =>
                                dlInvoice.mutate({
                                  filePath: s.filePath,
                                  displayName: s.displayName,
                                })
                              }
                            />
                          ) : null
                        }
                      />
                    ))}
                  </List>
                </VStack>
              ) : null}

              {failures.length > 0 ? (
                <VStack gap={2}>
                  <Banner
                    status="error"
                    title={`${failures.length} 件の発行に失敗しました`}
                    collapsible={false}
                  />
                  <List>
                    {failures.map((f) => (
                      <ListItem
                        key={f.companyId}
                        label={f.companyName || `企業 #${f.companyId}`}
                        description={f.error}
                      />
                    ))}
                  </List>
                </VStack>
              ) : null}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack hAlign="end">
              <Button label="閉じる" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
