import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * 管理画面共通ヘッダ: 戻る + タイトル + 右側アクション。
 *
 * @param {Object} props
 * @param {React.ReactNode} props.title
 * @param {() => void} [props.onBack] 未指定時は navigate(-1)
 * @param {string} [props.backLabel='戻る']
 * @param {React.ReactNode} [props.actions]
 */
export function PageHeader({ title, onBack, backLabel = '戻る', actions }) {
  const navigate = useNavigate()
  const handleBack = onBack ?? (() => navigate(-1))

  return (
    <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
      <HStack gap={2} vAlign="center">
        <IconButton label={backLabel} icon={<ArrowLeft />} variant="ghost" onClick={handleBack} />
        {typeof title === 'string' || typeof title === 'number' ? (
          <Heading level={1}>{title}</Heading>
        ) : (
          title
        )}
      </HStack>
      {actions ?? null}
    </HStack>
  )
}
