import { useCallback, useRef, useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'
import { Upload } from 'lucide-react'

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
    <Card
      padding={4}
      variant={hover ? 'muted' : 'default'}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      style={{
        borderStyle: 'dashed',
        borderWidth: 'var(--border-width-thick, 2px)',
        borderColor: error
          ? 'var(--color-error)'
          : hover
            ? 'var(--color-accent)'
            : 'var(--color-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Center>
        <VStack gap={1} hAlign="center">
          <Upload size={48} color="var(--color-text-secondary)" />
          <Text>ファイルをドロップ、または クリックして選択</Text>
          <Text size="sm" color="secondary">
            `YYYYMM稼働管理表new.xlsx` 形式
          </Text>
          {error ? (
            <Text size="sm" style={{ color: 'var(--color-text-red)' }}>
              {error}
            </Text>
          ) : null}
        </VStack>
      </Center>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Card>
  )
}
