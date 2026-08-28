import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { TabList, Tab } from '@astryxdesign/core/TabList'

/**
 * 請求書プレビューダイアログ。
 * `previews: [{ url, sequence, lineCount, totalAmount }]` を受け取り iframe 表示。
 * split 戦略のときはタブで複数枚切り替え。
 *
 * 閉じる時に各 Blob URL を revoke してメモリ解放する。
 */
export function InvoicePreviewDialog({ open, onClose, companyName, previews }) {
  const [tab, setTab] = useState('0')

  useEffect(() => {
    if (open) setTab('0')
  }, [open])

  // ダイアログが閉じられたタイミングで Blob URL を解放
  useEffect(() => {
    if (!open && previews) {
      for (const p of previews) {
        try {
          URL.revokeObjectURL(p.url)
        } catch {
          /* noop */
        }
      }
    }
  }, [open, previews])

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  if (!previews || previews.length === 0) return null
  const tabIndex = Number(tab) || 0
  const current = previews[tabIndex] ?? previews[0]
  const title = `プレビュー：${companyName}${
    current?.sequence ? `（${current.sequence.index} / ${current.sequence.total} 枚目）` : ''
  }`

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="info">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title={title} onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={2}>
              {previews.length > 1 ? (
                <TabList value={tab} onChange={setTab} role="tablist">
                  {previews.map((p, idx) => (
                    <Tab
                      key={idx}
                      value={String(idx)}
                      label={p.sequence ? `${p.sequence.index} / ${p.sequence.total}` : `${idx + 1}`}
                      panelId={`invoice-preview-panel-${idx}`}
                    />
                  ))}
                </TabList>
              ) : null}
              <iframe
                id={`invoice-preview-panel-${tabIndex}`}
                role="tabpanel"
                src={current.url}
                title={`invoice-preview-${tab}`}
                style={{
                  width: '100%',
                  height: '80vh',
                  border: 'none',
                  display: 'block',
                }}
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                variant="secondary"
                label="このプレビューをダウンロード"
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = current.url
                  a.download = `${companyName}-preview${current.sequence ? `-${current.sequence.index}of${current.sequence.total}` : ''}.pdf`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                }}
              />
              <Button label="閉じる" variant="primary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
