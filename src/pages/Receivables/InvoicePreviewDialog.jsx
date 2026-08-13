import { useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useState } from 'react'

/**
 * 請求書プレビューダイアログ。
 * `previews: [{ url, sequence, lineCount, totalAmount }]` を受け取り iframe 表示。
 * split 戦略のときはタブで複数枚切り替え。
 *
 * 閉じる時に各 Blob URL を revoke してメモリ解放する。
 */
export function InvoicePreviewDialog({ open, onClose, companyName, previews }) {
  const [tab, setTab] = useState(0)

  useEffect(() => {
    if (open) setTab(0)
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

  if (!previews || previews.length === 0) return null
  const current = previews[tab] ?? previews[0]

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        プレビュー：{companyName}
        {current?.sequence ? `（${current.sequence.index} / ${current.sequence.total} 枚目）` : ''}
      </DialogTitle>
      {previews.length > 1 && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
          {previews.map((p, idx) => (
            <Tab
              key={idx}
              label={p.sequence ? `${p.sequence.index} / ${p.sequence.total}` : `${idx + 1}`}
            />
          ))}
        </Tabs>
      )}
      <DialogContent dividers sx={{ p: 0, height: '80vh' }}>
        <Box
          component="iframe"
          src={current.url}
          title={`invoice-preview-${tab}`}
          sx={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const a = document.createElement('a')
            a.href = current.url
            a.download = `${companyName}-preview${current.sequence ? `-${current.sequence.index}of${current.sequence.total}` : ''}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
          }}
        >
          このプレビューをダウンロード
        </Button>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  )
}
