import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Switch } from '@astryxdesign/core/Switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { PageFrame } from '@/components/PageFrame'
import { PageHeader } from '@/components/PageHeader'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { currentYearMonth } from '@/components/Receivables/monthUtils'
import { WithholdingTaxForm } from '@/components/Payroll/WithholdingTaxForm'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import {
  useGeneratePayrollDrafts,
  usePayrollSlips,
  useSetPayrollStatus,
  useUpdatePayrollSlip,
} from '@/hooks/usePayroll'
import { TAX_TABLE_KOU, TAX_TABLE_OTSU, formatYen } from '@/lib/payroll/withholdingTax'
import { buildPayslipAmounts } from '@/lib/payroll/calculatePayslip'

function previousMonthValue() {
  return dayjs().subtract(1, 'month').format('YYYY-MM')
}

function statusToken(status) {
  if (status === 'PUBLISHED') return { label: '公開済', color: 'green' }
  return { label: '下書き', color: 'gray' }
}

function slipEmployeeName(slip) {
  return slip.employees?.name || slip.employee_name || '—'
}

export function AdminPayrollPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { fieldSize, actionButtonProps } = useMobileLayout()
  const [monthValue, setMonthValue] = useState(() => previousMonthValue() || currentYearMonth())
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const slipsQuery = usePayrollSlips(monthValue)
  const generateMutation = useGeneratePayrollDrafts()
  const updateMutation = useUpdatePayrollSlip()
  const statusMutation = useSetPayrollStatus()

  const slips = slipsQuery.data ?? []
  const loading =
    slipsQuery.isLoading ||
    generateMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending

  const draftIds = useMemo(
    () => slips.filter((s) => s.status === 'DRAFT').map((s) => s.id),
    [slips]
  )
  const publishedIds = useMemo(
    () => slips.filter((s) => s.status === 'PUBLISHED').map((s) => s.id),
    [slips]
  )

  const openEdit = (slip) => {
    setEditing(slip)
    setEditForm({
      allowance: slip.allowance,
      social_insurance: slip.social_insurance,
      other_deduction: slip.other_deduction,
      tax_table_type: slip.tax_table_type || TAX_TABLE_OTSU,
      dependents_count: slip.dependents_count ?? 0,
      withholding_overridden: Boolean(slip.withholding_overridden),
      withholding_tax: slip.withholding_tax,
      note: slip.note || '',
      total_hours: slip.total_hours,
    })
  }

  const previewAmounts = useMemo(() => {
    if (!editing || !editForm) return null
    return buildPayslipAmounts({
      employee: {
        hourly_wage: editing.hourly_wage_snapshot,
        tax_table_type: editForm.tax_table_type,
        dependents_count: editForm.dependents_count,
      },
      totalHours: editForm.total_hours,
      allowance: editForm.allowance,
      socialInsurance: editForm.social_insurance,
      otherDeduction: editForm.other_deduction,
      taxTableType: editForm.tax_table_type,
      dependentsCount: editForm.dependents_count,
      withholdingOverride: editForm.withholding_overridden ? editForm.withholding_tax : null,
    })
  }, [editing, editForm])

  const handleGenerate = async () => {
    setError(null)
    setSuccess(null)
    try {
      const data = await generateMutation.mutateAsync({ yearMonth: monthValue })
      setSuccess(
        `下書きを更新しました（${data.upserted}件）。公開済スキップ: ${data.skippedPublished}件`
      )
    } catch (err) {
      setError(err.message || '計算に失敗しました')
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !editForm) return
    setError(null)
    setSuccess(null)
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        patch: {
          allowance: editForm.allowance,
          social_insurance: editForm.social_insurance,
          other_deduction: editForm.other_deduction,
          tax_table_type: editForm.tax_table_type,
          dependents_count: editForm.dependents_count,
          withholding_overridden: editForm.withholding_overridden,
          withholding_tax: editForm.withholding_tax,
          note: editForm.note,
          total_hours: editForm.total_hours,
        },
        employee: {
          hourly_wage: editing.hourly_wage_snapshot,
          tax_table_type: editForm.tax_table_type,
          dependents_count: editForm.dependents_count,
        },
      })
      setSuccess('明細を更新しました')
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      setError(err.message || '更新に失敗しました')
    }
  }

  const handlePublishDrafts = async () => {
    if (!draftIds.length) return
    if (!confirm(`${draftIds.length}件の下書きを公開しますか？`)) return
    setError(null)
    try {
      await statusMutation.mutateAsync({ ids: draftIds, status: 'PUBLISHED' })
      setSuccess(`${draftIds.length}件を公開しました`)
    } catch (err) {
      setError(err.message || '公開に失敗しました')
    }
  }

  const handleUnpublish = async () => {
    if (!publishedIds.length) return
    if (!confirm(`${publishedIds.length}件を下書きに戻しますか？`)) return
    setError(null)
    try {
      await statusMutation.mutateAsync({ ids: publishedIds, status: 'DRAFT' })
      setSuccess(`${publishedIds.length}件を下書きに戻しました`)
    } catch (err) {
      setError(err.message || '更新に失敗しました')
    }
  }

  const handlePublishOne = async (slip) => {
    setError(null)
    try {
      await statusMutation.mutateAsync({ ids: [slip.id], status: 'PUBLISHED' })
      setSuccess(`${slipEmployeeName(slip)} の明細を公開しました`)
    } catch (err) {
      setError(err.message || '公開に失敗しました')
    }
  }

  return (
    <PageFrame>
      <VStack gap={4}>
        <PageHeader
          title="給与明細"
          backLabel="ダッシュボード"
          onBack={() => navigate('/')}
          actions={<MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />}
        />

        <Text color="secondary">
          対象月のシフト稼働 ×
          時給で下書きを生成します。雇用の従業員のみ対象。公開後、メンバーはシフトPINで閲覧できます。
        </Text>

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
        {slipsQuery.error ? (
          <Banner
            status="error"
            title={`取得失敗: ${slipsQuery.error.message}`}
            collapsible={false}
          />
        ) : null}

        <HStack gap={2} wrap="wrap">
          <Button
            variant="primary"
            label="シフトから計算（下書き）"
            onClick={handleGenerate}
            isDisabled={loading}
            isLoading={generateMutation.isPending}
            {...actionButtonProps}
          />
          <Button
            variant="secondary"
            label={`下書きを一括公開（${draftIds.length}）`}
            onClick={handlePublishDrafts}
            isDisabled={loading || draftIds.length === 0}
            {...actionButtonProps}
          />
          <Button
            variant="ghost"
            label={`公開を下書きに戻す（${publishedIds.length}）`}
            onClick={handleUnpublish}
            isDisabled={loading || publishedIds.length === 0}
            {...actionButtonProps}
          />
        </HStack>

        {slipsQuery.isLoading ? (
          <Center padding={8}>
            <Spinner label="読み込み中..." />
          </Center>
        ) : null}

        {!slipsQuery.isLoading && slips.length === 0 ? (
          <Center padding={8}>
            <Text color="secondary">
              この月の明細はありません。「シフトから計算」を実行してください。
            </Text>
          </Center>
        ) : null}

        {!slipsQuery.isLoading && slips.length > 0 ? (
          isMobile ? (
            <VStack gap={2}>
              {slips.map((slip) => {
                const st = statusToken(slip.status)
                return (
                  <Card key={slip.id} padding={3}>
                    <VStack gap={2}>
                      <HStack hAlign="between" wrap="wrap" gap={2}>
                        <Text weight="medium">{slipEmployeeName(slip)}</Text>
                        <Token label={st.label} size="sm" color={st.color} />
                      </HStack>
                      <Text color="secondary">
                        {Number(slip.total_hours)}h × ¥
                        {Number(slip.hourly_wage_snapshot).toLocaleString()}
                      </Text>
                      <Text>総支給 {formatYen(slip.gross_pay)}</Text>
                      <Text>源泉 {formatYen(slip.withholding_tax)}</Text>
                      <Text weight="medium">差引 {formatYen(slip.net_pay)}</Text>
                      <HStack gap={1}>
                        <Button
                          label="編集"
                          variant="secondary"
                          width="100%"
                          size="lg"
                          onClick={() => openEdit(slip)}
                          isDisabled={loading}
                        />
                        {slip.status === 'DRAFT' ? (
                          <Button
                            label="公開"
                            variant="primary"
                            width="100%"
                            size="lg"
                            onClick={() => handlePublishOne(slip)}
                            isDisabled={loading}
                          />
                        ) : null}
                      </HStack>
                    </VStack>
                  </Card>
                )
              })}
            </VStack>
          ) : (
            <Table hasHover density="compact">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>氏名</TableHeaderCell>
                  <TableHeaderCell>状態</TableHeaderCell>
                  <TableHeaderCell>時間</TableHeaderCell>
                  <TableHeaderCell>時給</TableHeaderCell>
                  <TableHeaderCell>総支給</TableHeaderCell>
                  <TableHeaderCell>源泉</TableHeaderCell>
                  <TableHeaderCell>差引</TableHeaderCell>
                  <TableHeaderCell>操作</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((slip) => {
                  const st = statusToken(slip.status)
                  return (
                    <TableRow key={slip.id}>
                      <TableCell>
                        <Text weight="medium">{slipEmployeeName(slip)}</Text>
                      </TableCell>
                      <TableCell>
                        <Token label={st.label} size="sm" color={st.color} />
                      </TableCell>
                      <TableCell>
                        <Text hasTabularNumbers>{Number(slip.total_hours)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text hasTabularNumbers>
                          ¥{Number(slip.hourly_wage_snapshot).toLocaleString()}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text hasTabularNumbers>{formatYen(slip.gross_pay)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text hasTabularNumbers>{formatYen(slip.withholding_tax)}</Text>
                      </TableCell>
                      <TableCell>
                        <Text hasTabularNumbers weight="medium">
                          {formatYen(slip.net_pay)}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <HStack gap={1}>
                          <Button
                            size="sm"
                            variant="ghost"
                            label="編集"
                            onClick={() => openEdit(slip)}
                            isDisabled={loading}
                          />
                          {slip.status === 'DRAFT' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              label="公開"
                              onClick={() => handlePublishOne(slip)}
                              isDisabled={loading}
                            />
                          ) : null}
                        </HStack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )
        ) : null}
      </VStack>

      <Dialog
        isOpen={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setEditForm(null)
          }
        }}
        purpose="form"
        maxHeight="90dvh"
      >
        <Layout
          padding={4}
          header={
            <DialogHeader
              title={`明細編集 — ${editing ? slipEmployeeName(editing) : ''}`}
              onOpenChange={(open) => {
                if (!open) {
                  setEditing(null)
                  setEditForm(null)
                }
              }}
            />
          }
          content={
            <LayoutContent>
              {editForm && editing ? (
                <VStack gap={4}>
                  <TextInput
                    label="稼働時間（h）"
                    value={String(editForm.total_hours)}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        total_hours: parseFloat(v) || 0,
                      })
                    }
                    size={fieldSize}
                    width="100%"
                  />
                  <TextInput
                    label="手当"
                    value={String(editForm.allowance)}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        allowance: parseInt(String(v).replace(/\D/g, ''), 10) || 0,
                      })
                    }
                    size={fieldSize}
                    width="100%"
                  />
                  <TextInput
                    label="社会保険料控除"
                    value={String(editForm.social_insurance)}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        social_insurance: parseInt(String(v).replace(/\D/g, ''), 10) || 0,
                      })
                    }
                    size={fieldSize}
                    width="100%"
                  />
                  <TextInput
                    label="その他控除"
                    value={String(editForm.other_deduction)}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        other_deduction: parseInt(String(v).replace(/\D/g, ''), 10) || 0,
                      })
                    }
                    size={fieldSize}
                    width="100%"
                  />
                  <Selector
                    label="税額表区分"
                    value={editForm.tax_table_type}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        tax_table_type: v,
                        dependents_count: v === TAX_TABLE_KOU ? editForm.dependents_count : 0,
                      })
                    }
                    size={fieldSize}
                    width="100%"
                    options={[
                      { value: TAX_TABLE_OTSU, label: '乙欄' },
                      { value: TAX_TABLE_KOU, label: '甲欄' },
                    ]}
                  />
                  <Selector
                    label="扶養親族等の数"
                    value={String(editForm.dependents_count)}
                    onChange={(v) =>
                      setEditForm({
                        ...editForm,
                        dependents_count: parseInt(v, 10) || 0,
                      })
                    }
                    isDisabled={editForm.tax_table_type !== TAX_TABLE_KOU}
                    size={fieldSize}
                    width="100%"
                    options={[0, 1, 2, 3, 4, 5].map((n) => ({
                      value: String(n),
                      label: `${n}人`,
                    }))}
                  />
                  <Switch
                    label="源泉税額を手修正する"
                    value={editForm.withholding_overridden}
                    onChange={(checked) =>
                      setEditForm({
                        ...editForm,
                        withholding_overridden: checked,
                        withholding_tax: checked
                          ? editForm.withholding_tax
                          : (previewAmounts?.auto_withholding_tax ?? editForm.withholding_tax),
                      })
                    }
                  />
                  {editForm.withholding_overridden ? (
                    <TextInput
                      label="源泉徴収税額（手修正）"
                      value={String(editForm.withholding_tax)}
                      onChange={(v) =>
                        setEditForm({
                          ...editForm,
                          withholding_tax: parseInt(String(v).replace(/\D/g, ''), 10) || 0,
                        })
                      }
                      size={fieldSize}
                      width="100%"
                    />
                  ) : null}
                  <TextArea
                    label="メモ"
                    value={editForm.note}
                    onChange={(v) => setEditForm({ ...editForm, note: v })}
                    width="100%"
                  />

                  {previewAmounts ? (
                    <Card padding={3}>
                      <VStack gap={1}>
                        <Text weight="medium">再計算プレビュー</Text>
                        <Text>基本給 {formatYen(previewAmounts.base_pay)}</Text>
                        <Text>総支給 {formatYen(previewAmounts.gross_pay)}</Text>
                        <Text>基準額 {formatYen(previewAmounts.taxable_base)}</Text>
                        <Text>
                          源泉 {formatYen(previewAmounts.withholding_tax)}
                          {!editForm.withholding_overridden
                            ? `（自動 ${formatYen(previewAmounts.auto_withholding_tax)}）`
                            : '（手修正）'}
                        </Text>
                        <Text weight="medium">差引 {formatYen(previewAmounts.net_pay)}</Text>
                      </VStack>
                    </Card>
                  ) : null}

                  <WithholdingTaxForm
                    value={{
                      grossPay: previewAmounts?.gross_pay ?? 0,
                      socialInsurance: editForm.social_insurance,
                      otherDeduction: editForm.other_deduction,
                      taxTableType: editForm.tax_table_type,
                      dependentsCount: editForm.dependents_count,
                    }}
                    showOtherDeduction
                    isDisabled
                    fieldSize={fieldSize}
                  />
                </VStack>
              ) : null}
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign={isMobile ? undefined : 'end'} wrap="wrap">
                <Button
                  label="キャンセル"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null)
                    setEditForm(null)
                  }}
                  {...actionButtonProps}
                />
                <Button
                  label="保存"
                  variant="primary"
                  onClick={handleSaveEdit}
                  isLoading={updateMutation.isPending}
                  {...actionButtonProps}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </PageFrame>
  )
}
