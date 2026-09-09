import { useId, useMemo, useState } from 'react'
import { Field } from '@astryxdesign/core/Field'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import {
  TAX_TABLE_KOU,
  TAX_TABLE_OTSU,
  formatYen,
  normalizeTaxTableType,
  summarizeWithholding,
} from '@/lib/payroll/withholdingTax'

const TAX_OPTIONS = [
  { value: TAX_TABLE_OTSU, label: '乙欄' },
  { value: TAX_TABLE_KOU, label: '甲欄' },
]

const DEPENDENT_OPTIONS = [0, 1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${n}人`,
}))

/**
 * 源泉徴収の試算フォーム（入力変更でリアルタイム再計算）
 *
 * @param {object} [props]
 * @param {object} [props.value] 制御コンポーネント用（未指定なら内部 state）
 * @param {(next: object) => void} [props.onChange]
 * @param {boolean} [props.showOtherDeduction=false]
 * @param {string} [props.fieldSize]
 * @param {boolean} [props.isDisabled]
 */
export function WithholdingTaxForm({
  value,
  onChange,
  showOtherDeduction = false,
  fieldSize,
  isDisabled = false,
} = {}) {
  const [internal, setInternal] = useState({
    grossPay: 0,
    socialInsurance: 0,
    otherDeduction: 0,
    taxTableType: TAX_TABLE_OTSU,
    dependentsCount: 0,
  })

  const isControlled = value != null
  const state = isControlled
    ? {
        grossPay: Number(value.grossPay) || 0,
        socialInsurance: Number(value.socialInsurance) || 0,
        otherDeduction: Number(value.otherDeduction) || 0,
        taxTableType: normalizeTaxTableType(value.taxTableType ?? TAX_TABLE_OTSU),
        dependentsCount: Number(value.dependentsCount) || 0,
      }
    : internal

  const update = (patch) => {
    const next = { ...state, ...patch }
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const summary = useMemo(
    () =>
      summarizeWithholding({
        grossPay: state.grossPay,
        socialInsurance: state.socialInsurance,
        otherDeduction: showOtherDeduction ? state.otherDeduction : 0,
        taxTableType: state.taxTableType,
        dependentsCount: state.dependentsCount,
      }),
    [
      state.grossPay,
      state.socialInsurance,
      state.otherDeduction,
      state.taxTableType,
      state.dependentsCount,
      showOtherDeduction,
    ]
  )

  const resultId = useId()
  const isKou = state.taxTableType === TAX_TABLE_KOU

  return (
    <VStack gap={3}>
      <TextInput
        label="総支給額"
        value={String(state.grossPay)}
        onChange={(v) => update({ grossPay: parseInt(String(v).replace(/\D/g, ''), 10) || 0 })}
        isDisabled={isDisabled}
        size={fieldSize}
        width="100%"
        description="円"
      />
      <TextInput
        label="社会保険料控除額"
        value={String(state.socialInsurance)}
        onChange={(v) =>
          update({ socialInsurance: parseInt(String(v).replace(/\D/g, ''), 10) || 0 })
        }
        isDisabled={isDisabled}
        size={fieldSize}
        width="100%"
        description="デフォルト 0"
      />
      <Selector
        label="税額表区分"
        value={state.taxTableType}
        onChange={(v) => update({ taxTableType: normalizeTaxTableType(v) })}
        isDisabled={isDisabled}
        size={fieldSize}
        width="100%"
        options={TAX_OPTIONS}
      />
      <Selector
        label="扶養親族等の数"
        value={String(state.dependentsCount)}
        onChange={(v) => update({ dependentsCount: parseInt(v, 10) || 0 })}
        isDisabled={isDisabled || !isKou}
        size={fieldSize}
        width="100%"
        options={DEPENDENT_OPTIONS}
        description={isKou ? undefined : '甲欄のときのみ有効'}
      />
      {showOtherDeduction ? (
        <TextInput
          label="その他控除"
          value={String(state.otherDeduction)}
          onChange={(v) =>
            update({ otherDeduction: parseInt(String(v).replace(/\D/g, ''), 10) || 0 })
          }
          isDisabled={isDisabled}
          size={fieldSize}
          width="100%"
        />
      ) : null}

      <Field label="計算結果" inputID={resultId}>
        <VStack gap={1} id={resultId}>
          <HStack hAlign="between" wrap="wrap" gap={2}>
            <Text color="secondary">基準額（社会保険料控除後）</Text>
            <Text type="large" hasTabularNumbers weight="medium">
              {formatYen(summary.taxableBase)}
            </Text>
          </HStack>
          <HStack hAlign="between" wrap="wrap" gap={2}>
            <Text color="secondary">源泉徴収税額</Text>
            <Text type="large" hasTabularNumbers weight="medium">
              {formatYen(summary.withholdingTax)}
            </Text>
          </HStack>
          <HStack hAlign="between" wrap="wrap" gap={2}>
            <Text color="secondary">差引支給額（手取り）</Text>
            <Text type="large" hasTabularNumbers weight="medium">
              {formatYen(summary.netPay)}
            </Text>
          </HStack>
        </VStack>
      </Field>
    </VStack>
  )
}
