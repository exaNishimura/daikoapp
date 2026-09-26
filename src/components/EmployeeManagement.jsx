import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { IconButton } from '@astryxdesign/core/IconButton'
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
import { Token } from '@astryxdesign/core/Token'
import { EmployeeFormDialog } from '@/components/EmployeeFormDialog'
import { EmployeePinDialog } from '@/components/EmployeePinDialog'
import { PageFrame } from '@/components/PageFrame'
import { PageHeader } from '@/components/PageHeader'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/hooks/useEmployees'
import { setEmployeeShiftPin, clearEmployeeShiftPin } from '@/services/employeeShiftService'
import { TAX_TABLE_KOU, TAX_TABLE_OTSU, TAX_TABLE_LABELS } from '@/lib/payroll/withholdingTax'

const EMPTY_FORM = {
  name: '',
  license_type: '一種',
  color: '#FFA500',
  hourly_wage: 0,
  is_active: true,
  sort_order: 0,
  employment_type: 'EMPLOYED',
  tax_table_type: TAX_TABLE_OTSU,
  dependents_count: 0,
}

const COLOR_SWATCH_STYLE = {
  display: 'inline-block',
  width: 'var(--spacing-4)',
  height: 'var(--spacing-4)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  flexShrink: 0,
}

export function EmployeeManagement() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { fieldSize, actionButtonProps } = useMobileLayout()
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [originalName, setOriginalName] = useState('')
  const [legacyStaffName, setLegacyStaffName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinTarget, setPinTarget] = useState(null)
  const [issuedPin, setIssuedPin] = useState(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const [customPin, setCustomPin] = useState('')
  const [formData, setFormData] = useState({ ...EMPTY_FORM })

  const employeesQuery = useEmployees()
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const deleteMutation = useDeleteEmployee()

  const employees = employeesQuery.data ?? []
  const fetchError = employeesQuery.error
  const isFetching = employeesQuery.isLoading
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const loading = isFetching || isMutating

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditingId(employee.id)
      setOriginalName(employee.name)
      setLegacyStaffName('')
      setFormData({
        name: employee.name,
        license_type: employee.license_type,
        color: employee.color,
        hourly_wage: employee.hourly_wage || 0,
        is_active: employee.is_active !== false,
        sort_order: employee.sort_order || 0,
        employment_type: employee.employment_type || 'EMPLOYED',
        tax_table_type: employee.tax_table_type || TAX_TABLE_OTSU,
        dependents_count: employee.dependents_count ?? 0,
      })
    } else {
      setEditingId(null)
      setOriginalName('')
      setLegacyStaffName('')
      setFormData({
        ...EMPTY_FORM,
        sort_order: employees.length,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setOriginalName('')
    setLegacyStaffName('')
    setFormData({ ...EMPTY_FORM })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('名前は必須です')
      return
    }

    if (!formData.color) {
      setError('色は必須です')
      return
    }

    setError(null)
    setSuccess(null)

    const employeeData = {
      name: formData.name.trim(),
      license_type: formData.license_type,
      color: formData.color,
      hourly_wage: parseFloat(formData.hourly_wage) || 0,
      is_active: formData.is_active,
      sort_order: formData.sort_order || 0,
      employment_type: formData.employment_type || 'EMPLOYED',
      tax_table_type: formData.tax_table_type || TAX_TABLE_OTSU,
      dependents_count:
        formData.tax_table_type === TAX_TABLE_KOU
          ? Math.min(5, Math.max(0, Number(formData.dependents_count) || 0))
          : 0,
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          employeeData,
          legacyStaffName: legacyStaffName.trim() || undefined,
        })
        const nameChanged = originalName.trim() && employeeData.name.trim() !== originalName.trim()
        const legacySync = Boolean(legacyStaffName.trim())
        setSuccess(
          nameChanged || legacySync
            ? '従業員を更新し、売上データのスタッフ名も一括更新しました'
            : '従業員を更新しました'
        )
      } else {
        await createMutation.mutateAsync(employeeData)
        setSuccess('従業員を作成しました')
      }
      handleCloseDialog()
    } catch (err) {
      setError(`${editingId ? '更新' : '作成'}に失敗: ${err.message}`)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) {
      return
    }

    setError(null)
    setSuccess(null)

    try {
      await deleteMutation.mutateAsync(id)
      setSuccess('従業員を削除しました')
    } catch (err) {
      setError(`削除に失敗: ${err.message}`)
    }
  }

  const handleOpenPinDialog = (employee) => {
    setPinTarget(employee)
    setIssuedPin(null)
    setCustomPin('')
    setPinDialogOpen(true)
  }

  const handleClosePinDialog = () => {
    setPinDialogOpen(false)
    setPinTarget(null)
    setIssuedPin(null)
    setCustomPin('')
  }

  const handleIssuePin = async (useCustom = false) => {
    if (!pinTarget) return
    setPinSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const pin = useCustom ? customPin.trim() : undefined
      if (useCustom && pin.length !== 6) {
        throw new Error('PINは6桁の数字で入力してください')
      }
      const { data, error: apiErr } = await setEmployeeShiftPin(pinTarget.id, pin)
      if (apiErr || !data?.ok) throw apiErr || new Error('PINの発行に失敗しました')
      setIssuedPin(data.pin)
      setSuccess(`${pinTarget.name} さんのシフト希望PINを発行しました`)
      employeesQuery.refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setPinSubmitting(false)
    }
  }

  const handleClearPin = async () => {
    if (!pinTarget) return
    if (!confirm(`${pinTarget.name} さんのシフト希望PINを解除しますか？`)) return
    setPinSubmitting(true)
    setError(null)
    try {
      const { data, error: apiErr } = await clearEmployeeShiftPin(pinTarget.id)
      if (apiErr || !data?.ok) throw apiErr || new Error('PINの解除に失敗しました')
      setSuccess(`${pinTarget.name} さんのシフト希望PINを解除しました`)
      handleClosePinDialog()
      employeesQuery.refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setPinSubmitting(false)
    }
  }

  const handleFormOpenChange = (isOpen) => {
    if (!isOpen) handleCloseDialog()
  }

  const handlePinOpenChange = (isOpen) => {
    if (!isOpen) handleClosePinDialog()
  }

  return (
    <PageFrame>
      <VStack gap={4}>
        <PageHeader
          title="従業員マスタ"
          backLabel="シフトへ戻る"
          onBack={() => navigate('/shift')}
          actions={
            <Button
              variant="primary"
              label="新規追加"
              icon={<Plus size={16} />}
              onClick={() => handleOpenDialog()}
              isDisabled={loading}
              {...actionButtonProps}
            />
          }
        />

        {fetchError ? (
          <Banner
            status="error"
            title={`従業員データの取得に失敗: ${fetchError.message}`}
            collapsible={false}
          />
        ) : null}
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

        {loading && !employees.length ? (
          <Center padding={8}>
            <Spinner label="読み込み中..." />
          </Center>
        ) : null}

        {!loading && employees.length > 0 ? (
          isMobile ? (
            <VStack gap={2}>
              {employees.map((employee) => (
                <Card key={employee.id} padding={3}>
                  <VStack gap={2}>
                    <HStack hAlign="between" vAlign="start" gap={2} wrap="wrap">
                      <VStack gap={0}>
                        <Text weight="medium">{employee.name}</Text>
                        <Text color="secondary">並び順: {employee.sort_order || 0}</Text>
                      </VStack>
                      <Token
                        label={employee.is_active ? '有効' : '無効'}
                        size="sm"
                        color={employee.is_active ? 'green' : 'gray'}
                      />
                    </HStack>
                    <HStack gap={2} wrap="wrap" vAlign="center">
                      <Token
                        label={employee.employment_type === 'CONTRACT' ? '業務委託' : '雇用'}
                        size="sm"
                        color={employee.employment_type === 'CONTRACT' ? 'gray' : 'green'}
                      />
                      <Token
                        label={employee.license_type}
                        size="sm"
                        color={employee.license_type === '一種' ? 'blue' : 'purple'}
                      />
                      <HStack gap={1} vAlign="center">
                        <span
                          aria-hidden
                          style={{ ...COLOR_SWATCH_STYLE, backgroundColor: employee.color }}
                        />
                        <Text>{employee.color}</Text>
                      </HStack>
                      <Text type="large" hasTabularNumbers>
                        ¥{Number(employee.hourly_wage || 0).toLocaleString()}
                      </Text>
                      {employee.employment_type !== 'CONTRACT' ? (
                        <Text color="secondary">
                          {TAX_TABLE_LABELS[employee.tax_table_type] || '乙欄'}
                          {employee.tax_table_type === TAX_TABLE_KOU
                            ? ` / 扶養${employee.dependents_count ?? 0}`
                            : ''}
                        </Text>
                      ) : null}
                    </HStack>
                    <Button
                      size="lg"
                      variant="secondary"
                      width="100%"
                      label={
                        employee.shift_pin_configured
                          ? 'シフトPIN（設定済）'
                          : 'シフトPIN（未設定）'
                      }
                      onClick={() => handleOpenPinDialog(employee)}
                    />
                    <HStack gap={1}>
                      <Button
                        label="編集"
                        variant="secondary"
                        size="lg"
                        width="100%"
                        icon={<Pencil size={16} />}
                        onClick={() => handleOpenDialog(employee)}
                        isDisabled={loading}
                      />
                      <Button
                        label="削除"
                        variant="destructive"
                        size="lg"
                        width="100%"
                        icon={<Trash2 size={16} />}
                        onClick={() => handleDelete(employee.id, employee.name)}
                        isDisabled={loading}
                      />
                    </HStack>
                  </VStack>
                </Card>
              ))}
            </VStack>
          ) : (
            <Table hasHover density="compact">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>名前</TableHeaderCell>
                  <TableHeaderCell>雇用形態</TableHeaderCell>
                  <TableHeaderCell>免許種別</TableHeaderCell>
                  <TableHeaderCell>色</TableHeaderCell>
                  <TableHeaderCell>時給</TableHeaderCell>
                  <TableHeaderCell>税額表</TableHeaderCell>
                  <TableHeaderCell>状態</TableHeaderCell>
                  <TableHeaderCell>シフトPIN</TableHeaderCell>
                  <TableHeaderCell>並び順</TableHeaderCell>
                  <TableHeaderCell>操作</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Text weight="medium">{employee.name}</Text>
                    </TableCell>
                    <TableCell>
                      <Token
                        label={employee.employment_type === 'CONTRACT' ? '業務委託' : '雇用'}
                        size="sm"
                        color={employee.employment_type === 'CONTRACT' ? 'gray' : 'green'}
                      />
                    </TableCell>
                    <TableCell>
                      <Token
                        label={employee.license_type}
                        size="sm"
                        color={employee.license_type === '一種' ? 'blue' : 'purple'}
                      />
                    </TableCell>
                    <TableCell>
                      <HStack gap={1} vAlign="center">
                        <span
                          aria-hidden
                          style={{ ...COLOR_SWATCH_STYLE, backgroundColor: employee.color }}
                        />
                        <Text>{employee.color}</Text>
                      </HStack>
                    </TableCell>
                    <TableCell>
                      <Text>¥{Number(employee.hourly_wage || 0).toLocaleString()}</Text>
                    </TableCell>
                    <TableCell>
                      <Text>
                        {employee.employment_type === 'CONTRACT'
                          ? '—'
                          : `${TAX_TABLE_LABELS[employee.tax_table_type] || '乙欄'}${
                              employee.tax_table_type === TAX_TABLE_KOU
                                ? ` (${employee.dependents_count ?? 0})`
                                : ''
                            }`}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Token
                        label={employee.is_active ? '有効' : '無効'}
                        size="sm"
                        color={employee.is_active ? 'green' : 'gray'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        label={employee.shift_pin_configured ? '設定済' : '未設定'}
                        onClick={() => handleOpenPinDialog(employee)}
                      />
                    </TableCell>
                    <TableCell>
                      <Text>{employee.sort_order || 0}</Text>
                    </TableCell>
                    <TableCell>
                      <HStack gap={1}>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          label="編集"
                          tooltip="編集"
                          icon={<Pencil size={14} />}
                          onClick={() => handleOpenDialog(employee)}
                          isDisabled={loading}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          label="削除"
                          tooltip="削除"
                          icon={<Trash2 size={14} />}
                          onClick={() => handleDelete(employee.id, employee.name)}
                          isDisabled={loading}
                        />
                      </HStack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : null}

        {!loading && employees.length === 0 ? (
          <Center padding={8}>
            <Text color="secondary">従業員が登録されていません</Text>
          </Center>
        ) : null}
      </VStack>

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={handleFormOpenChange}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        legacyStaffName={legacyStaffName}
        setLegacyStaffName={setLegacyStaffName}
        loading={loading}
        isMutating={isMutating}
        isMobile={isMobile}
        fieldSize={fieldSize}
        actionButtonProps={actionButtonProps}
        onClose={handleCloseDialog}
        onSave={handleSave}
      />

      <EmployeePinDialog
        open={pinDialogOpen}
        onOpenChange={handlePinOpenChange}
        pinTarget={pinTarget}
        issuedPin={issuedPin}
        customPin={customPin}
        onCustomPinChange={setCustomPin}
        pinSubmitting={pinSubmitting}
        fieldSize={fieldSize}
        onIssuePin={handleIssuePin}
        onClearPin={handleClearPin}
        onClose={handleClosePinDialog}
      />
    </PageFrame>
  )
}
