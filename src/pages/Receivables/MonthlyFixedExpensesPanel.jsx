import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Field } from '@astryxdesign/core/Field'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Plus, Save, Trash2, X } from 'lucide-react'
import { AmountInput } from '@/components/Receivables/AmountInput'

const DEFAULT_LABELS = ['共済掛金', '損害保険', '駐車場', '携帯', '税理士']

const LABEL_INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  paddingBlock: 'var(--spacing-2)',
  paddingInline: 'var(--spacing-3)',
  font: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
}

/**
 * 月額固定経費パネル。
 * - label + amount のリストで CRUD
 * - 月初表示時はデフォルトラベルを quick-add する選択肢として提示
 *
 * @param {Object} props
 * @param {string} props.billingMonth   'YYYY-MM-01'
 * @param {Array} props.rows
 * @param {(payload) => Promise} props.onUpsert
 * @param {(id) => Promise} props.onDelete
 */
export function MonthlyFixedExpensesPanel({ billingMonth, rows, onUpsert, onDelete }) {
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)), [rows])

  const total = useMemo(() => sorted.reduce((s, r) => s + (Number(r.amount) || 0), 0), [sorted])

  const usedLabels = useMemo(() => new Set(sorted.map((r) => r.label)), [sorted])
  const quickAdds = DEFAULT_LABELS.filter((l) => !usedLabels.has(l))

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', amount: 0 })

  const handleAdd = async () => {
    if (!draft.label.trim()) return
    await onUpsert({
      billing_month: billingMonth,
      label: draft.label.trim(),
      amount: Number(draft.amount) || 0,
    })
    setDraft({ label: '', amount: 0 })
    setAdding(false)
  }

  const handleQuickAdd = async (label) => {
    await onUpsert({ billing_month: billingMonth, label, amount: 0 })
  }

  return (
    <VStack gap={3}>
      <HStack hAlign="between" vAlign="center">
        <Heading level={3}>月額固定経費</Heading>
        <Text size="sm" color="secondary">
          合計 ¥{total.toLocaleString('ja-JP')}
        </Text>
      </HStack>

      <VStack gap={2}>
        {sorted.map((row) => (
          <FixedExpenseRow
            key={row.id ?? row.label}
            row={row}
            billingMonth={billingMonth}
            onUpsert={onUpsert}
            onDelete={onDelete}
          />
        ))}

        {sorted.length === 0 ? (
          <Text size="sm" color="secondary">
            固定経費がまだ登録されていません（前月に登録があれば自動で引き継がれます）
          </Text>
        ) : null}
      </VStack>

      {quickAdds.length > 0 && !adding ? (
        <VStack gap={1}>
          <Text size="sm" color="secondary">
            よく使う項目:
          </Text>
          <HStack gap={1} wrap="wrap">
            {quickAdds.map((label) => (
              <Button
                key={label}
                size="sm"
                variant="secondary"
                icon={<Plus />}
                label={label}
                onClick={() => handleQuickAdd(label)}
              />
            ))}
          </HStack>
        </VStack>
      ) : null}

      {!adding ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus />}
          label="カスタム項目を追加"
          onClick={() => setAdding(true)}
        />
      ) : (
        <HStack gap={2} wrap="wrap" vAlign="end">
          <TextInput
            label="項目名"
            size="sm"
            value={draft.label}
            onChange={(label) => setDraft({ ...draft, label })}
            width="100%"
          />
          <AmountInput
            value={draft.amount}
            onChange={(v) => setDraft({ ...draft, amount: v ?? 0 })}
            label="金額"
          />
          <IconButton
            size="sm"
            variant="primary"
            label="保存"
            tooltip="保存"
            icon={<Save />}
            onClick={handleAdd}
            isDisabled={!draft.label.trim()}
          />
          <IconButton
            size="sm"
            variant="ghost"
            label="キャンセル"
            tooltip="キャンセル"
            icon={<X />}
            onClick={() => setAdding(false)}
          />
        </HStack>
      )}
    </VStack>
  )
}

function FixedExpenseRow({ row, billingMonth, onUpsert, onDelete }) {
  const inputId = useId()
  const [labelDraft, setLabelDraft] = useState(row.label ?? '')
  const [labelSaving, setLabelSaving] = useState(false)

  useEffect(() => {
    setLabelDraft(row.label ?? '')
  }, [row.id, row.label])

  const handleAmountChange = (v) => {
    const next = v ?? 0
    if (next === (row.amount ?? 0)) return
    onUpsert({
      id: row.id,
      billing_month: billingMonth,
      label: row.label,
      amount: next,
    })
  }

  const commitLabel = async () => {
    const next = labelDraft.trim()
    if (!next) {
      setLabelDraft(row.label ?? '')
      return
    }
    if (next === row.label) return
    setLabelSaving(true)
    try {
      await onUpsert({
        id: row.id,
        billing_month: billingMonth,
        label: next,
        amount: row.amount ?? 0,
      })
    } catch {
      setLabelDraft(row.label ?? '')
    } finally {
      setLabelSaving(false)
    }
  }

  return (
    <HStack gap={2} wrap="wrap" vAlign="end">
      <Field label="項目名" inputID={inputId} width="100%">
        <input
          id={inputId}
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setLabelDraft(row.label ?? '')
              e.currentTarget.blur()
            }
          }}
          disabled={labelSaving}
          style={LABEL_INPUT_STYLE}
        />
      </Field>
      <AmountInput value={row.amount ?? 0} onChange={handleAmountChange} label="金額" />
      <IconButton
        size="sm"
        variant="destructive"
        label="削除"
        tooltip="削除"
        icon={<Trash2 />}
        onClick={() => onDelete(row.id)}
      />
    </HStack>
  )
}
