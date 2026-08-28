import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Plus, Trash2 } from 'lucide-react'
import { AmountInput } from '@/components/Receivables/AmountInput'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { EMPTY_RECEIVABLE_LINE } from '@/lib/billing/shiftReceivables'

/**
 * 売掛の複数行入力（請求先 + 金額 + 備考）
 *
 * @param {Object} props
 * @param {Array} props.lines
 * @param {(lines: Array) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {Array|null} [props.companies] 指定時に請求先セレクトを表示
 * @param {boolean} [props.creatable] 一致なし時に名前だけで取引先追加
 * @param {(name: string) => Promise<{id: number}|number>} [props.onCreateCompany]
 */
export function ReceivableLinesEditor({
  lines,
  onChange,
  disabled = false,
  companies = null,
  creatable = false,
  onCreateCompany,
}) {
  const showCompany = Array.isArray(companies)

  const updateLine = (index, patch) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    onChange([...lines, { ...EMPTY_RECEIVABLE_LINE }])
  }

  const removeLine = (index) => {
    if (lines.length <= 1) {
      onChange([{ ...EMPTY_RECEIVABLE_LINE }])
      return
    }
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <VStack gap={2}>
      {lines.map((line, index) => (
        <HStack key={line.id ?? `line-${index}`} gap={1} wrap="wrap" vAlign="start">
          {showCompany ? (
            <CompanySelect
              companies={companies}
              value={line.company_id}
              onChange={(company_id) => updateLine(index, { company_id })}
              disabled={disabled}
              label="請求先"
              creatable={creatable}
              onCreate={onCreateCompany}
            />
          ) : null}
          <AmountInput
            label="金額 (円)"
            value={line.amount === '' ? null : line.amount}
            onChange={(amount) => updateLine(index, { amount: amount ?? '' })}
            disabled={disabled}
          />
          <TextInput
            label="備考"
            size="sm"
            value={line.note}
            onChange={(note) => updateLine(index, { note })}
            isDisabled={disabled}
            placeholder="請求書払いなど"
            width="100%"
          />
          <IconButton
            size="sm"
            variant="ghost"
            label="行を削除"
            icon={<Trash2 />}
            onClick={() => removeLine(index)}
            isDisabled={disabled}
          />
        </HStack>
      ))}
      <Button
        size="sm"
        variant="secondary"
        icon={<Plus />}
        label="売掛を追加"
        onClick={addLine}
        isDisabled={disabled}
      />
    </VStack>
  )
}
