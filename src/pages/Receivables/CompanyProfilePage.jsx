import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Divider } from '@astryxdesign/core/Divider'
import { Grid, GridSpan } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ArrowLeft, RotateCcw, Save } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { useCompanyProfile, useUpdateCompanyProfile } from '@/hooks/billing/useCompanyProfile'
import {
  BANK_ACCOUNT_TYPES,
  COMPANY_PROFILE_FIELDS,
  EMPTY_COMPANY_PROFILE,
  normalizePostalCode,
  validateCompanyProfileForm,
} from '@/lib/billing/companyProfileForm'

function pickProfileFields(data) {
  if (!data) return { ...EMPTY_COMPANY_PROFILE }
  const out = { ...EMPTY_COMPANY_PROFILE }
  for (const field of COMPANY_PROFILE_FIELDS) {
    if (data[field] != null) out[field] = data[field]
  }
  return out
}

function fieldStatus(message) {
  return message ? { type: 'error', message } : undefined
}

function ProfileForm({ initial, onSave, isSaving }) {
  const [form, setForm] = useState(initial)
  const [serverSnapshot, setServerSnapshot] = useState(initial)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const { errors, isValid } = useMemo(() => validateCompanyProfileForm(form), [form])

  const isDirty = useMemo(
    () => COMPANY_PROFILE_FIELDS.some((f) => (form[f] ?? '') !== (serverSnapshot[f] ?? '')),
    [form, serverSnapshot]
  )

  const handleChange = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleBlurPostal = () =>
    setForm((prev) => ({ ...prev, postal_code: normalizePostalCode(prev.postal_code) }))

  const handleReset = () => {
    setForm(serverSnapshot)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!isValid) return
    setError(null)
    setSuccess(null)
    const payload = COMPANY_PROFILE_FIELDS.reduce((acc, f) => {
      const v = form[f]
      acc[f] = typeof v === 'string' ? v.trim() : v
      return acc
    }, {})
    payload.postal_code = normalizePostalCode(payload.postal_code)

    try {
      const saved = await onSave(payload)
      const next = pickProfileFields(saved ?? payload)
      setForm(next)
      setServerSnapshot(next)
      setSuccess('自社情報を保存しました')
    } catch (err) {
      setError(`保存に失敗: ${err.message}`)
    }
  }

  return (
    <VStack gap={3}>
      {error ? (
        <Banner
          status="error"
          title={error}
          isDismissable
          onDismiss={() => setError(null)}
          collapsible={false}
        />
      ) : null}
      {success ? (
        <Banner
          status="success"
          title={success}
          isDismissable
          onDismiss={() => setSuccess(null)}
          collapsible={false}
        />
      ) : null}
      <Card padding={4}>
        <VStack gap={4}>
          <Grid columns={2} gap={2}>
            <GridSpan columns="full">
              <TextInput
                label="屋号 / 社名"
                value={form.name}
                onChange={handleChange('name')}
                status={fieldStatus(errors.name)}
                description={errors.name ? undefined : '請求書ヘッダに刷り込まれる社名'}
                isRequired
                width="100%"
                isDisabled={isSaving}
              />
            </GridSpan>
            <TextInput
              label="郵便番号"
              value={form.postal_code}
              onChange={handleChange('postal_code')}
              onBlur={handleBlurPostal}
              status={fieldStatus(errors.postal_code)}
              description={errors.postal_code ? undefined : '123-4567 形式（ハイフン無しでも自動補完）'}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <TextInput
              label="インボイス番号"
              value={form.invoice_number}
              onChange={handleChange('invoice_number')}
              status={fieldStatus(errors.invoice_number)}
              description={errors.invoice_number ? undefined : '例: T1234567890123'}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <GridSpan columns="full">
              <TextInput
                label="住所"
                value={form.address}
                onChange={handleChange('address')}
                status={fieldStatus(errors.address)}
                isRequired
                width="100%"
                isDisabled={isSaving}
              />
            </GridSpan>
          </Grid>

          <Divider label="振込先" />

          <Grid columns={2} gap={2}>
            <TextInput
              label="銀行名"
              value={form.bank}
              onChange={handleChange('bank')}
              status={fieldStatus(errors.bank)}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <TextInput
              label="支店名"
              value={form.bank_branch}
              onChange={handleChange('bank_branch')}
              status={fieldStatus(errors.bank_branch)}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <Selector
              label="口座種別"
              options={BANK_ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))}
              value={form.bank_account_type}
              onChange={handleChange('bank_account_type')}
              status={fieldStatus(errors.bank_account_type)}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <TextInput
              label="口座番号"
              value={form.bank_account_number}
              onChange={handleChange('bank_account_number')}
              status={fieldStatus(errors.bank_account_number)}
              description={errors.bank_account_number ? undefined : '数字のみ。先頭 0 も保持'}
              isRequired
              width="100%"
              isDisabled={isSaving}
            />
            <GridSpan columns="full">
              <TextInput
                label="口座名義"
                value={form.bank_account_holder}
                onChange={handleChange('bank_account_holder')}
                status={fieldStatus(errors.bank_account_holder)}
                description={errors.bank_account_holder ? undefined : 'カタカナ推奨'}
                isRequired
                width="100%"
                isDisabled={isSaving}
              />
            </GridSpan>
          </Grid>

          <HStack gap={1} hAlign="end">
            <Button
              label="元に戻す"
              variant="secondary"
              icon={<RotateCcw />}
              onClick={handleReset}
              isDisabled={isSaving || !isDirty}
            />
            <Button
              label={isSaving ? '保存中...' : '保存'}
              variant="primary"
              icon={<Save />}
              onClick={handleSave}
              isDisabled={isSaving || !isValid || !isDirty}
              isLoading={isSaving}
            />
          </HStack>
        </VStack>
      </Card>
    </VStack>
  )
}

export function CompanyProfilePage() {
  const navigate = useNavigate()
  const profileQuery = useCompanyProfile()
  const updateMutation = useUpdateCompanyProfile()

  const initial = useMemo(() => pickProfileFields(profileQuery.data), [profileQuery.data])

  const isLoading = profileQuery.isLoading
  const ready = !isLoading

  return (
    <PageFrame>
      <VStack gap={4}>
        <HStack gap={2} vAlign="center">
          <IconButton
            label="戻る"
            icon={<ArrowLeft />}
            variant="ghost"
            onClick={() => navigate(-1)}
          />
          <Heading level={1}>自社情報</Heading>
        </HStack>

        {profileQuery.error ? (
          <Banner
            status="error"
            title={`自社情報の取得に失敗: ${profileQuery.error.message}`}
            collapsible={false}
          />
        ) : null}

        {!ready ? (
          <Center padding={4}>
            <Spinner />
          </Center>
        ) : (
          <ProfileForm
            key={profileQuery.data?.updated_at ?? 'empty'}
            initial={initial}
            isSaving={updateMutation.isPending}
            onSave={(payload) => updateMutation.mutateAsync(payload)}
          />
        )}
      </VStack>
    </PageFrame>
  )
}
