import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import DownloadIcon from '@mui/icons-material/Download'
import FolderZipIcon from '@mui/icons-material/FolderZip'
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

  const successes = result?.successes ?? []
  const failures = result?.failures ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>請求書発行 結果</DialogTitle>
      <DialogContent>
        {successes.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity="success"
              action={
                <Button
                  startIcon={<FolderZipIcon />}
                  size="small"
                  onClick={handleZip}
                  disabled={zipBusy || successes.every((s) => !s.filePath)}
                >
                  {zipBusy ? 'zip 生成中…' : '全件 zip で DL'}
                </Button>
              }
            >
              {successes.length} 件の請求書を発行しました
            </Alert>
            {zipError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {zipError}
              </Alert>
            )}
            <List dense>
              {successes.map((s, idx) => (
                <ListItem
                  key={`${s.companyId}-${s.sequence?.index ?? 0}-${idx}`}
                  secondaryAction={
                    s.filePath ? (
                      <IconButton
                        size="small"
                        onClick={() =>
                          dlInvoice.mutate({
                            filePath: s.filePath,
                            displayName: s.displayName,
                          })
                        }
                        aria-label="ダウンロード"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={
                      s.displayName ||
                      (s.sequence
                        ? `企業 #${s.companyId} (${s.sequence.index}/${s.sequence.total} 枚目)`
                        : `企業 #${s.companyId}`)
                    }
                    secondary={
                      <>
                        ¥{Number(s.totalAmount ?? 0).toLocaleString('ja-JP')}
                        {' · '}
                        {s.lineCount ?? '?'} 件
                        {s.filePath ? ` · ${s.filePath}` : ' · Storage 未保存'}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {failures.length > 0 && (
          <Box>
            <Alert severity="error">{failures.length} 件の発行に失敗しました</Alert>
            <List dense>
              {failures.map((f) => (
                <ListItem key={f.companyId}>
                  <ListItemText
                    primary={f.companyName || `企業 #${f.companyId}`}
                    secondary={f.error}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  )
}
