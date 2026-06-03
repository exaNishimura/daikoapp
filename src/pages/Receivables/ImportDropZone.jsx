import { useCallback, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import UploadFileIcon from '@mui/icons-material/UploadFile'

/**
 * `.xlsx` ファイル受け取り用ドロップゾーン。
 * - クリックでも選択可
 * - 単一ファイルのみ受け取り
 * - 拡張子 .xlsx チェック
 *
 * @param {Object} props
 * @param {(file: File) => void} props.onFile
 * @param {boolean} [props.disabled]
 */
export function ImportDropZone({ onFile, disabled = false }) {
  const inputRef = useRef(null)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = useCallback(
    (file) => {
      setError(null)
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError('.xlsx ファイルのみ受け付けます')
        return
      }
      onFile(file)
    },
    [onFile]
  )

  const onDrop = (e) => {
    e.preventDefault()
    setHover(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    handleFile(f)
  }

  const onClick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  return (
    <Box
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      sx={{
        border: '2px dashed',
        borderColor: error ? 'error.main' : hover ? 'primary.main' : 'divider',
        bgcolor: hover ? 'action.hover' : 'background.paper',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 120ms ease',
      }}
    >
      <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body1" sx={{ mt: 1 }}>
        ファイルをドロップ、または クリックして選択
      </Typography>
      <Typography variant="caption" color="text.secondary">
        `YYYYMM稼働管理表new.xlsx` 形式
      </Typography>
      {error && (
        <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Box>
  )
}
