import { useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Tokenizer } from '@astryxdesign/core/Tokenizer'
import { Save } from 'lucide-react'
import { normalizeAliases, validateCompanyForm } from '@/lib/billing/companyForm'

const EMPTY_FORM = {
  name: '',
  invoice_display_name: '',
  aliases: [],
  display_order: 0,
  is_active: true,
  memo: '',
}

const EMPTY_ALIAS_SOURCE = {
  search: () => [],
  bootstrap: () => [],
}

function initialFormFor(company, existingCompanies) {
  if (company) {
    return {
      name: company.name ?? '',
      invoice_display_name: company.invoice_display_name ?? '',
      aliases: Array.isArray(company.aliases) ? [...company.aliases] : [],
      display_order: company.display_order ?? 0,
      is_active: company.is_active !== false,
      memo: company.memo ?? '',
    }
  }
  const nextOrder =
    existingCompanies.reduce((max, c) => Math.max(max, c.display_order ?? 0), 0) + 10
  return { ...EMPTY_FORM, display_order: nextOrder }
}

function aliasToItem(alias) {
  return { id: alias, label: alias }
}

function DialogBody({ company, existingCompanies, onSave, onClose, loading, handleOpenChange }) {
  const isEdit = company != null
  const [form, setForm] = useState(() => initialFormFor(company, existingCompanies))
  const [submitError, setSubmitError] = useState(null)

  const { errors } = useMemo(
    () => validateCompanyForm(form, existingCompanies, isEdit ? company.id : null),
    [form, existingCompanies, isEdit, company]
  )

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) return
    const payload = {
      name: String(form.name).trim(),
      invoice_display_name:
        form.invoice_display_name?.trim() === '' ? null : String(form.invoice_display_name).trim(),
      aliases: normalizeAliases(form.aliases),
      display_order: Number(form.display_order) || 0,
      is_active: !!form.is_active,
      memo: form.memo?.trim() === '' ? null : String(form.memo).trim(),
    }
    try {
      setSubmitError(null)
      await onSave?.(payload)
      onClose?.()
    } catch (err) {
      setSubmitError(err?.message || '保存に失敗しました')
    }
  }

  const title = isEdit ? '取引先を編集' : '取引先を新規追加'

  return (
    <Layout
      height="auto"
      padding={4}
      header={<DialogHeader title={title} onOpenChange={handleOpenChange} />}
      content={
        <LayoutContent>
          <VStack gap={3}>
            <TextInput
              label="取引先名 (マスタ)"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              status={errors.name ? { type: 'error', message: errors.name } : undefined}
              description={errors.name ? undefined : '社内で識別する正式名称'}
              isRequired
              width="100%"
              isDisabled={loading}
              hasAutoFocus
            />
            <TextInput
              label="請求書表記名 (任意)"
              value={form.invoice_display_name ?? ''}
              onChange={(invoice_display_name) => setForm({ ...form, invoice_display_name })}
              description="空欄ならマスタ名をそのまま使用"
              width="100%"
              isDisabled={loading}
            />
            <Tokenizer
              label="別名 / 表記ゆれ"
              description="Enter で追加。半角化と空白 trim は保存時に自動適用"
              searchSource={EMPTY_ALIAS_SOURCE}
              value={form.aliases.map(aliasToItem)}
              onChange={(items) =>
                setForm({
                  ...form,
                  aliases: normalizeAliases(items.map((i) => i.label ?? i.id)),
                })
              }
              hasCreate
              width="100%"
              isDisabled={loading}
            />
            <TextInput
              label="並び順"
              value={String(form.display_order ?? '')}
              onChange={(display_order) => setForm({ ...form, display_order })}
              status={
                errors.display_order ? { type: 'error', message: errors.display_order } : undefined
              }
              description={errors.display_order ? undefined : '数値が小さいほど上に表示'}
              width="100%"
              isDisabled={loading}
            />
            <Switch
              label="有効"
              value={form.is_active}
              onChange={(is_active) => setForm({ ...form, is_active })}
              isDisabled={loading}
            />
            <TextArea
              label="メモ"
              value={form.memo ?? ''}
              onChange={(memo) => setForm({ ...form, memo })}
              width="100%"
              rows={2}
              isDisabled={loading}
            />
            {submitError ? (
              <Text size="sm" style={{ color: 'var(--color-text-red)' }}>
                {submitError}
              </Text>
            ) : null}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button
              label="キャンセル"
              variant="secondary"
              onClick={onClose}
              isDisabled={loading}
            />
            <Button
              label="保存"
              variant="primary"
              icon={<Save />}
              onClick={handleSave}
              isDisabled={loading || Object.keys(errors).length > 0}
              isLoading={loading}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  )
}

/**
 * 取引先の新規追加 / 編集ダイアログ。
 *
 * 中身は `open=true` のときだけマウントするので、フォーム state は
 * useState の初期値で初期化できる（useEffect での同期不要）。
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.company          編集対象 (null = 新規)
 * @param {Array} props.existingCompanies      重複名チェック用
 * @param {(payload: Object) => Promise<void>} props.onSave
 * @param {boolean} [props.loading]
 */
export function CompanyEditDialog({
  open,
  onClose,
  company,
  existingCompanies = [],
  onSave,
  loading = false,
}) {
  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      {open ? (
        <DialogBody
          company={company}
          existingCompanies={existingCompanies}
          onSave={onSave}
          onClose={onClose}
          loading={loading}
          handleOpenChange={handleOpenChange}
        />
      ) : null}
    </Dialog>
  )
}
