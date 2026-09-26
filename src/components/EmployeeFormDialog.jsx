import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Switch } from '@astryxdesign/core/Switch'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TAX_TABLE_KOU, TAX_TABLE_OTSU, TAX_TABLE_LABELS } from '@/lib/payroll/withholdingTax'

const LICENSE_TYPES = ['一種', '二種']
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'EMPLOYED', label: '雇用' },
  { value: 'CONTRACT', label: '業務委託' },
]
const TAX_TABLE_OPTIONS = [
  { value: TAX_TABLE_OTSU, label: TAX_TABLE_LABELS[TAX_TABLE_OTSU] },
  { value: TAX_TABLE_KOU, label: TAX_TABLE_LABELS[TAX_TABLE_KOU] },
]
const DEPENDENT_OPTIONS = [0, 1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${n}人`,
}))
const DEFAULT_COLORS = [
  { name: 'オレンジ', value: '#FFA500' },
  { name: '黄', value: '#FFD700' },
  { name: '紫', value: '#8A2BE2' },
  { name: '水色', value: '#00BFFF' },
  { name: 'ピンク', value: '#FF69B4' },
  { name: '緑', value: '#32CD32' },
  { name: '赤', value: '#FF0000' },
  { name: '青', value: '#0000FF' },
  { name: '茶', value: '#A52A2A' },
  { name: 'グレー', value: '#808080' },
]

export function EmployeeFormDialog({
  open,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  legacyStaffName,
  setLegacyStaffName,
  loading,
  isMutating,
  isMobile,
  fieldSize,
  actionButtonProps,
  onClose,
  onSave,
}) {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} purpose="form" maxHeight="90dvh">
      <Layout
        padding={4}
        header={
          <DialogHeader
            title={editingId ? '従業員編集' : '新規従業員追加'}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <TextInput
                label="名前"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                isRequired
                isDisabled={loading}
                size={fieldSize}
                width="100%"
              />
              {editingId ? (
                <TextInput
                  label="売上データに残っている旧スタッフ名（任意）"
                  value={legacyStaffName}
                  onChange={setLegacyStaffName}
                  isDisabled={loading}
                  placeholder="例: 北島"
                  description="売上インポート等で古い表記のまま残っている場合に入力（シフトは従業員IDで連携）"
                  size={fieldSize}
                  width="100%"
                />
              ) : null}
              <Selector
                label="免許種別"
                isRequired
                value={formData.license_type}
                onChange={(value) => setFormData({ ...formData, license_type: value })}
                isDisabled={loading}
                size={fieldSize}
                width="100%"
                options={LICENSE_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <Selector
                label="色"
                isRequired
                value={formData.color}
                onChange={(value) => setFormData({ ...formData, color: value })}
                isDisabled={loading}
                size={fieldSize}
                width="100%"
                options={DEFAULT_COLORS.map((color) => ({
                  value: color.value,
                  label: `${color.name} (${color.value})`,
                }))}
              />
              <TextInput
                label="時給"
                value={String(formData.hourly_wage)}
                onChange={(value) => setFormData({ ...formData, hourly_wage: value })}
                description="円単位で入力してください"
                isDisabled={loading}
                size={fieldSize}
                width="100%"
              />
              <Selector
                label="雇用形態"
                isRequired
                value={formData.employment_type}
                onChange={(value) => setFormData({ ...formData, employment_type: value })}
                isDisabled={loading}
                size={fieldSize}
                width="100%"
                options={EMPLOYMENT_TYPE_OPTIONS}
              />
              {formData.employment_type !== 'CONTRACT' ? (
                <>
                  <Selector
                    label="税額表区分"
                    value={formData.tax_table_type}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        tax_table_type: value,
                        dependents_count: value === TAX_TABLE_KOU ? formData.dependents_count : 0,
                      })
                    }
                    isDisabled={loading}
                    size={fieldSize}
                    width="100%"
                    options={TAX_TABLE_OPTIONS}
                  />
                  <Selector
                    label="扶養親族等の数"
                    value={String(formData.dependents_count)}
                    onChange={(value) =>
                      setFormData({
                        ...formData,
                        dependents_count: parseInt(value, 10) || 0,
                      })
                    }
                    isDisabled={loading || formData.tax_table_type !== TAX_TABLE_KOU}
                    size={fieldSize}
                    width="100%"
                    options={DEPENDENT_OPTIONS}
                    description={
                      formData.tax_table_type === TAX_TABLE_KOU ? undefined : '甲欄のときのみ有効'
                    }
                  />
                </>
              ) : null}
              <TextInput
                label="並び順"
                value={String(formData.sort_order)}
                onChange={(value) =>
                  setFormData({ ...formData, sort_order: parseInt(value, 10) || 0 })
                }
                description="数値が小さいほど上に表示されます"
                isDisabled={loading}
                size={fieldSize}
                width="100%"
              />
              <Switch
                label="有効"
                value={formData.is_active}
                onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                isDisabled={loading}
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign={isMobile ? undefined : 'end'} wrap="wrap">
              <Button
                label="キャンセル"
                variant="secondary"
                onClick={onClose}
                isDisabled={loading}
                {...actionButtonProps}
              />
              <Button
                label="保存"
                variant="primary"
                onClick={onSave}
                isDisabled={loading}
                isLoading={isMutating}
                {...actionButtonProps}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
