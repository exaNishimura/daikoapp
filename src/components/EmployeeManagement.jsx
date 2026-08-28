import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { IconButton } from '@astryxdesign/core/IconButton'
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
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { PageFrame } from '@/components/PageFrame'
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/hooks/useEmployees'
import { setEmployeeShiftPin, clearEmployeeShiftPin } from '@/services/employeeShiftService'

const LICENSE_TYPES = ['一種', '二種']
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
  const [formData, setFormData] = useState({
    name: '',
    license_type: '一種',
    color: '#FFA500',
    hourly_wage: 0,
    is_active: true,
    sort_order: 0,
  })

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
      })
    } else {
      setEditingId(null)
      setOriginalName('')
      setLegacyStaffName('')
      setFormData({
        name: '',
        license_type: '一種',
        color: '#FFA500',
        hourly_wage: 0,
        is_active: true,
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
    setFormData({
      name: '',
      license_type: '一種',
      color: '#FFA500',
      hourly_wage: 0,
      is_active: true,
      sort_order: 0,
    })
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
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <HStack gap={2} vAlign="center">
            <IconButton
              label="シフトへ戻る"
              tooltip="シフトへ戻る"
              variant="ghost"
              icon={<ArrowLeft size={18} />}
              onClick={() => navigate('/shift')}
            />
            <Heading level={1}>従業員マスタ</Heading>
          </HStack>
          <Button
            variant="primary"
            label="新規追加"
            icon={<Plus size={16} />}
            onClick={() => handleOpenDialog()}
            isDisabled={loading}
          />
        </HStack>

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
          <Table hasHover density="compact">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>名前</TableHeaderCell>
                <TableHeaderCell>免許種別</TableHeaderCell>
                <TableHeaderCell>色</TableHeaderCell>
                <TableHeaderCell>時給</TableHeaderCell>
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
        ) : null}

        {!loading && employees.length === 0 ? (
          <Center padding={8}>
            <Text color="secondary">従業員が登録されていません</Text>
          </Center>
        ) : null}
      </VStack>

      <Dialog isOpen={dialogOpen} onOpenChange={handleFormOpenChange} purpose="form">
        <Layout
          height="auto"
          padding={4}
          header={
            <DialogHeader
              title={editingId ? '従業員編集' : '新規従業員追加'}
              onOpenChange={handleFormOpenChange}
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
                    width="100%"
                  />
                ) : null}
                <Selector
                  label="免許種別"
                  isRequired
                  value={formData.license_type}
                  onChange={(value) => setFormData({ ...formData, license_type: value })}
                  isDisabled={loading}
                  width="100%"
                  options={LICENSE_TYPES.map((type) => ({ value: type, label: type }))}
                />
                <Selector
                  label="色"
                  isRequired
                  value={formData.color}
                  onChange={(value) => setFormData({ ...formData, color: value })}
                  isDisabled={loading}
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
                  width="100%"
                />
                <TextInput
                  label="並び順"
                  value={String(formData.sort_order)}
                  onChange={(value) =>
                    setFormData({ ...formData, sort_order: parseInt(value, 10) || 0 })
                  }
                  description="数値が小さいほど上に表示されます"
                  isDisabled={loading}
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
              <HStack gap={2} hAlign="end" wrap="wrap">
                <Button
                  label="キャンセル"
                  variant="secondary"
                  onClick={handleCloseDialog}
                  isDisabled={loading}
                />
                <Button
                  label="保存"
                  variant="primary"
                  onClick={handleSave}
                  isDisabled={loading}
                  isLoading={isMutating}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={pinDialogOpen} onOpenChange={handlePinOpenChange} purpose="form">
        <Layout
          height="auto"
          padding={4}
          header={
            <DialogHeader
              title={`シフト希望PIN — ${pinTarget?.name ?? ''}`}
              onOpenChange={handlePinOpenChange}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text color="secondary">
                  配車画面のPINとは別です。従業員に本人のみ通知してください。
                </Text>
                {issuedPin ? (
                  <Banner
                    status="warning"
                    title={`発行したPIN: ${issuedPin}`}
                    description="この画面を閉じると再表示できません。"
                    collapsible={false}
                  />
                ) : null}
                {!issuedPin ? (
                  <Button
                    variant="primary"
                    width="100%"
                    label="ランダムPINを発行"
                    onClick={() => handleIssuePin(false)}
                    isDisabled={pinSubmitting}
                    isLoading={pinSubmitting}
                  />
                ) : null}
                {!issuedPin ? (
                  <TextInput
                    label="手動指定（6桁）"
                    value={customPin}
                    onChange={(value) => setCustomPin(value.replace(/\D/g, '').slice(0, 6))}
                    width="100%"
                  />
                ) : null}
                {!issuedPin ? (
                  <Button
                    variant="secondary"
                    width="100%"
                    label="指定PINを設定"
                    onClick={() => handleIssuePin(true)}
                    isDisabled={pinSubmitting || customPin.length !== 6}
                  />
                ) : null}
                {pinTarget?.shift_pin_configured ? (
                  <Button
                    variant="destructive"
                    width="100%"
                    label="PINを解除"
                    onClick={handleClearPin}
                    isDisabled={pinSubmitting}
                  />
                ) : null}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack hAlign="end">
                <Button label="閉じる" variant="secondary" onClick={handleClosePinDialog} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </PageFrame>
  )
}
