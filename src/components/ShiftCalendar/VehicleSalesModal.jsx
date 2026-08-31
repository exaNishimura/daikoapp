import { useEffect, useId, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Field } from '@astryxdesign/core/Field'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useDailySaleByDate, useUpsertDailySale } from '@/hooks/billing/useDailySales'
import {
  useDailyStaffSalesByDate,
  useUpsertDailyStaffSalesBatch,
} from '@/hooks/billing/useDailyStaffSales'
import {
  useReceivablesByWorkDate,
  useReplaceShiftReceivables,
} from '@/hooks/billing/useReceivables'
import { useCompanies, useCreateCompany } from '@/hooks/billing/useCompanies'
import { ReceivableLinesEditor } from '@/components/Receivables/ReceivableLinesEditor'
import { useUpdateShiftsBulk } from '@/hooks/useShifts'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { calcDailyDerived } from '@/lib/billing/dailySalesCalc'
import { sumShiftTimesHours } from '@/lib/billing/shiftStaffHours'
import { sumReceivableAmounts, isShiftEditableReceivable } from '@/lib/billing/shiftReceivables'
import { buildVehicleSalesSavePayload, readVehicleSalesForm } from '@/lib/billing/vehicleSalesForm'
import { isVehicleSalesFormDirty } from '@/lib/billing/reassignVehicleSales'
import { useReassignVehicleSales } from '@/hooks/billing/useReassignVehicleSales'
import { useResendDailyClose } from '@/hooks/billing/useDailyClosures'
import { ReassignVehicleDialog } from '@/components/ShiftCalendar/ReassignVehicleDialog'

const EMPTY_FORM = {
  distance_km: '',
  fuel_yen: '',
  sales: '',
  shiftTimes: [],
  expense_note: '',
  expense_amount: '',
  receivables: [{ company_id: null, amount: '', note: '' }],
}

const NATIVE_INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  paddingBlock: 'var(--spacing-2)',
  paddingInline: 'var(--spacing-3)',
  font: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontVariantNumeric: 'tabular-nums',
}

function TimeField({ label, value, onChange, disabled, isLabelHidden = false }) {
  const inputId = useId()
  return (
    <Field
      label={label}
      inputID={inputId}
      width="100%"
      isDisabled={disabled}
      isLabelHidden={isLabelHidden}
    >
      <input
        id={inputId}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={NATIVE_INPUT_STYLE}
      />
    </Field>
  )
}

export function VehicleSalesModal({
  open,
  workDate,
  carNum,
  dayShifts = [],
  employees = [],
  isDayClosed = false,
  isAdmin = false,
  onClose,
}) {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const adminCanEdit = isAdmin || isAuthenticated
  const isLocked = isDayClosed && !adminCanEdit
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignError, setReassignError] = useState(null)

  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const staffSalesQuery = useDailyStaffSalesByDate(open ? workDate : null)
  const receivablesQuery = useReceivablesByWorkDate(open ? workDate : null)
  const companiesQuery = useCompanies({ activeOnly: true })
  const createCompanyMutation = useCreateCompany()
  const upsertMutation = useUpsertDailySale()
  const upsertStaffMutation = useUpsertDailyStaffSalesBatch()
  const replaceReceivablesMutation = useReplaceShiftReceivables()
  const updateShiftsMutation = useUpdateShiftsBulk()
  const reassignMutation = useReassignVehicleSales()
  const resendCloseMutation = useResendDailyClose()

  const dataLoading =
    saleQuery.isLoading ||
    staffSalesQuery.isLoading ||
    receivablesQuery.isLoading ||
    companiesQuery.isLoading
  const saving =
    upsertMutation.isPending ||
    upsertStaffMutation.isPending ||
    replaceReceivablesMutation.isPending ||
    updateShiftsMutation.isPending ||
    reassignMutation.isPending ||
    resendCloseMutation.isPending
  const loading = dataLoading || saving
  const isDirty = isVehicleSalesFormDirty(form, initialForm)

  useEffect(() => {
    if (!open || !carNum) return
    setError(null)
    setSuccess(null)
    setReassignOpen(false)
    setReassignError(null)
  }, [open, workDate, carNum])

  // dayShifts/employees はデータ取得完了時のスナップショットを使用
  useEffect(() => {
    if (!open || !carNum || dataLoading) return
    const next = readVehicleSalesForm({
      dailyRow: saleQuery.data ?? null,
      carNum,
      dayShifts,
      employees,
      savedStaffRows: staffSalesQuery.data ?? [],
      receivableRows: receivablesQuery.data ?? [],
    })
    setForm(next)
    setInitialForm(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 取得完了スナップショットのみ同期
  }, [
    open,
    workDate,
    carNum,
    dataLoading,
    saleQuery.dataUpdatedAt,
    staffSalesQuery.dataUpdatedAt,
    receivablesQuery.dataUpdatedAt,
  ])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleOpenChange = (isOpen) => {
    if (!isOpen) handleClose()
  }

  const handleOpenReassign = () => {
    if (!adminCanEdit) return
    if (isDirty) {
      setError('先に売上を保存してください')
      return
    }
    setReassignError(null)
    setReassignOpen(true)
  }

  const handleConfirmReassign = async ({ toCar }) => {
    if (!workDate || !carNum || !toCar) return
    setReassignError(null)
    try {
      const result = await reassignMutation.mutateAsync({
        workDate,
        fromCar: carNum,
        toCar,
      })
      setReassignOpen(false)
      const modeLabel = result?.mode === 'swap' ? '入れ替え' : '付け替え'
      showToast(`${modeLabel}しました（${carNum}号車 → ${toCar}号車）`, 'success')
      onClose()
    } catch (err) {
      setReassignError(err.message || '号車変更に失敗しました')
    }
  }

  const handleResendCloseReport = async () => {
    if (!workDate || !isDayClosed || !adminCanEdit) return
    if (!window.confirm(`${workDate} の日次締め報告を LINE に再送しますか？`)) return
    setError(null)
    try {
      await resendCloseMutation.mutateAsync(workDate)
      showToast('日次締め報告を再送しました', 'success')
      setSuccess('LINE へ再送しました')
    } catch (err) {
      const msg = err?.message || '再送に失敗しました'
      setError(msg)
      showToast(msg, 'error')
    }
  }

  const handleShiftTimeChange = (shiftId, field, value) => {
    setForm((prev) => ({
      ...prev,
      shiftTimes: prev.shiftTimes.map((row) =>
        row.shiftId === shiftId ? { ...row, [field]: value } : row
      ),
    }))
  }

  const handleSave = async () => {
    if (!workDate || !carNum) return
    if (isLocked) {
      setError('この日は締め済みのため保存できません')
      return
    }
    setError(null)
    setSuccess(null)

    const incompleteShift = form.shiftTimes.find((row) => {
      const hasStart = Boolean(row.start)
      const hasEnd = Boolean(row.end)
      return (hasStart && !hasEnd) || (!hasStart && hasEnd)
    })
    if (incompleteShift) {
      setError('勤務時間は開始・終了を両方入力してください')
      return
    }

    try {
      const receivableResult = await replaceReceivablesMutation.mutateAsync({
        workDate,
        carNum,
        lines: form.receivables,
      })

      const { dailyPayload, staffRows, shiftUpdates } = buildVehicleSalesSavePayload({
        workDate,
        existingRow: saleQuery.data ?? null,
        carNum,
        form,
        dayShifts,
        employees,
        existingStaffRows: staffSalesQuery.data ?? [],
        receivableTotal: receivableResult.receivable_total,
      })

      if (shiftUpdates.length > 0) {
        await updateShiftsMutation.mutateAsync(shiftUpdates)
      }

      const saved = await upsertMutation.mutateAsync(dailyPayload)
      if (staffRows.length > 0) {
        await upsertStaffMutation.mutateAsync({ workDate, rows: staffRows })
      }

      const derived = calcDailyDerived(saved)
      const hasOtherReceivables = (receivablesQuery.data ?? []).some(
        (row) => !isShiftEditableReceivable(row, carNum)
      )
      let message = `保存しました（総売上: ¥${derived.total_sales.toLocaleString('ja-JP')} / 人件費: ¥${saved.labor_cost?.toLocaleString('ja-JP') ?? 0} / 現金: ¥${saved.cash?.toLocaleString('ja-JP') ?? 0} / 売掛: ¥${receivableResult.receivable_total.toLocaleString('ja-JP')}）`
      if (hasOtherReceivables) {
        message += ' ※他号車・売掛一覧の売掛を含む合計です。'
      }
      setSuccess(message)
    } catch (err) {
      setError(`保存に失敗しました: ${err.message}`)
    }
  }

  const dateLabel = workDate
    ? (() => {
        const [y, m, d] = workDate.split('-').map(Number)
        return `${y}年${m}月${d}日`
      })()
    : ''

  const formDisabled = loading || isLocked

  const startActions = (
    <>
      {adminCanEdit ? (
        <Button
          label="号車変更"
          variant="secondary"
          onClick={handleOpenReassign}
          isDisabled={loading}
        />
      ) : null}
      {isDayClosed && adminCanEdit ? (
        <Button
          label={resendCloseMutation.isPending ? '再送中…' : '締め報告を再送'}
          variant="secondary"
          onClick={handleResendCloseReport}
          isDisabled={loading || !workDate}
        />
      ) : null}
    </>
  )
  const endActions = (
    <>
      <Button label="閉じる" variant="secondary" onClick={handleClose} isDisabled={saving} />
      <Button label="保存" variant="primary" onClick={handleSave} isDisabled={formDisabled} />
    </>
  )

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={handleOpenChange}
        purpose="form"
        variant={isMobile ? 'fullscreen' : 'standard'}
      >
        <Layout
          height="fill"
          padding={4}
          header={
            <DialogHeader
              title={`${dateLabel} ${carNum}号車 売上入力`}
              onOpenChange={handleOpenChange}
            />
          }
          content={
            <LayoutContent>
              {dataLoading ? (
                <Center padding={4}>
                  <Spinner />
                </Center>
              ) : (
                <VStack gap={4}>
                  {isDayClosed ? (
                    <Banner
                      status={adminCanEdit ? 'info' : 'warning'}
                      title={
                        adminCanEdit
                          ? '締め済みです。下の「締め報告を再送」で最新内容を LINE に送れます。'
                          : '締め済みのため編集できません。'
                      }
                      collapsible={false}
                    />
                  ) : null}
                  {error ? <Banner status="error" title={error} collapsible={false} /> : null}
                  {success ? <Banner status="success" title={success} collapsible={false} /> : null}

                  <Text color="secondary" weight="semibold">
                    号車売上
                  </Text>
                  <TextInput
                    label="走行距離 (km)"
                    value={form.distance_km}
                    onChange={(value) => setForm((prev) => ({ ...prev, distance_km: value }))}
                    isDisabled={formDisabled}
                    width="100%"
                    size="sm"
                  />
                  <TextInput
                    label="燃料代 (円)"
                    value={form.fuel_yen}
                    onChange={(value) => setForm((prev) => ({ ...prev, fuel_yen: value }))}
                    isDisabled={formDisabled}
                    width="100%"
                    size="sm"
                  />
                  <TextInput
                    label="売上 (円)"
                    value={form.sales}
                    onChange={(value) => setForm((prev) => ({ ...prev, sales: value }))}
                    isDisabled={formDisabled}
                    isRequired
                    width="100%"
                    size="sm"
                  />

                  {isMobile ? (
                    <VStack gap={1}>
                      <Text color="secondary" weight="semibold">
                        {carNum}号車 実績勤務時間
                      </Text>
                      <Text color="secondary">合計 {sumShiftTimesHours(form.shiftTimes)}h</Text>
                    </VStack>
                  ) : (
                    <HStack hAlign="between" vAlign="baseline" wrap="wrap" gap={1}>
                      <Text color="secondary" weight="semibold">
                        {carNum}号車 実績勤務時間
                      </Text>
                      <Text color="secondary">合計 {sumShiftTimesHours(form.shiftTimes)}h</Text>
                    </HStack>
                  )}
                  {form.shiftTimes.length === 0 ? (
                    <Text color="secondary">この号車のシフトがありません</Text>
                  ) : isMobile ? (
                    <VStack gap={2}>
                      {form.shiftTimes.map((row) => (
                        <VStack key={row.shiftId} gap={2}>
                          <Text weight="semibold">
                            {row.staffName}{' '}
                            <Text as="span" color="secondary">
                              {row.role}
                            </Text>
                          </Text>
                          <HStack gap={2}>
                            <TimeField
                              label="開始"
                              value={row.start}
                              onChange={(value) =>
                                handleShiftTimeChange(row.shiftId, 'start', value)
                              }
                              disabled={formDisabled}
                            />
                            <TimeField
                              label="終了"
                              value={row.end}
                              onChange={(value) => handleShiftTimeChange(row.shiftId, 'end', value)}
                              disabled={formDisabled}
                            />
                          </HStack>
                        </VStack>
                      ))}
                    </VStack>
                  ) : (
                    <Table density="compact">
                      <TableHeader>
                        <TableRow>
                          <TableHeaderCell>スタッフ</TableHeaderCell>
                          <TableHeaderCell>役割</TableHeaderCell>
                          <TableHeaderCell>開始</TableHeaderCell>
                          <TableHeaderCell>終了</TableHeaderCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.shiftTimes.map((row) => (
                          <TableRow key={row.shiftId}>
                            <TableCell>{row.staffName}</TableCell>
                            <TableCell>{row.role}</TableCell>
                            <TableCell>
                              <TimeField
                                label="開始"
                                value={row.start}
                                onChange={(value) =>
                                  handleShiftTimeChange(row.shiftId, 'start', value)
                                }
                                disabled={formDisabled}
                                isLabelHidden
                              />
                            </TableCell>
                            <TableCell>
                              <TimeField
                                label="終了"
                                value={row.end}
                                onChange={(value) =>
                                  handleShiftTimeChange(row.shiftId, 'end', value)
                                }
                                disabled={formDisabled}
                                isLabelHidden
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Text color="secondary">保存するとシフト表のタイムラインにも反映されます</Text>

                  <Text color="secondary" weight="semibold">
                    その他経費
                  </Text>
                  <TextInput
                    label="経費内容"
                    value={form.expense_note}
                    onChange={(value) => setForm((prev) => ({ ...prev, expense_note: value }))}
                    isDisabled={formDisabled}
                    width="100%"
                    size="sm"
                  />
                  <TextInput
                    label="経費額 (円)"
                    value={form.expense_amount}
                    onChange={(value) => setForm((prev) => ({ ...prev, expense_amount: value }))}
                    isDisabled={formDisabled}
                    width="100%"
                    size="sm"
                  />

                  <Text color="secondary" weight="semibold">
                    未収（売掛・請求書払い）
                  </Text>
                  <ReceivableLinesEditor
                    lines={form.receivables}
                    onChange={(receivables) => setForm((prev) => ({ ...prev, receivables }))}
                    disabled={formDisabled}
                    companies={companiesQuery.data ?? []}
                    creatable
                    onCreateCompany={async (name) => {
                      const trimmed = name.trim()
                      const findExisting = (list) =>
                        (list ?? []).find(
                          (c) =>
                            String(c.name ?? '')
                              .trim()
                              .toLowerCase() === trimmed.toLowerCase()
                        )
                      const existing = findExisting(companiesQuery.data)
                      if (existing) return existing
                      const nextOrder =
                        (companiesQuery.data ?? []).reduce(
                          (max, c) => Math.max(max, c.display_order ?? 0),
                          0
                        ) + 10
                      try {
                        return await createCompanyMutation.mutateAsync({
                          name: trimmed,
                          invoice_display_name: null,
                          aliases: [],
                          display_order: nextOrder,
                          is_active: true,
                          memo: null,
                        })
                      } catch (err) {
                        const { data: refreshed } = await companiesQuery.refetch()
                        const raced = findExisting(refreshed)
                        if (raced) return raced
                        throw err
                      }
                    }}
                  />
                  <Text color="secondary">
                    複数行入力可。請求先がなければ名前を入力して新規追加できます。
                    {receivablesQuery.data?.length > 0
                      ? ` 当日合計: ¥${sumReceivableAmounts(receivablesQuery.data).toLocaleString('ja-JP')}`
                      : ''}
                  </Text>

                  <Text color="secondary">ログイン不要で保存できます</Text>
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              {isMobile ? (
                <VStack gap={2}>
                  {endActions}
                  {startActions}
                </VStack>
              ) : (
                <HStack gap={2} hAlign="between" wrap="wrap">
                  <HStack gap={2} wrap="wrap">
                    {startActions}
                  </HStack>
                  <HStack gap={2}>{endActions}</HStack>
                </HStack>
              )}
            </LayoutFooter>
          }
        />
      </Dialog>

      <ReassignVehicleDialog
        open={reassignOpen}
        fromCar={carNum}
        dailyRow={saleQuery.data ?? null}
        dayShifts={dayShifts}
        receivableRows={receivablesQuery.data ?? []}
        loading={reassignMutation.isPending}
        error={reassignError}
        onClose={() => {
          if (reassignMutation.isPending) return
          setReassignOpen(false)
          setReassignError(null)
        }}
        onConfirm={handleConfirmReassign}
      />
    </>
  )
}
