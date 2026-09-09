import { useCallback, useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { LogOut } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { PageHeader } from '@/components/PageHeader'
import { ShiftPinGate } from '@/components/ShiftRequest/ShiftPinGate'
import { formatBillingMonth } from '@/components/Receivables/monthUtils'
import { clearEmployeeShiftSession } from '@/lib/employeeShift/employeeShiftSession'
import { formatYen, TAX_TABLE_LABELS } from '@/lib/payroll/withholdingTax'
import { downloadPayslipPdf, generatePayslipPdf } from '@/lib/pdf/generatePayslipPdf'
import { callEmployeeShiftApi } from '@/services/employeeShiftService'

function PayslipDetail({ slip, employeeName, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadPayslipPdf(slip, employeeName)
    } catch (err) {
      setError(err.message || 'PDFの生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = async () => {
    setBusy(true)
    setError(null)
    try {
      const buf = await generatePayslipPdf(slip, employeeName)
      const blob = new Blob([buf], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) {
        w.addEventListener('load', () => {
          w.focus()
          w.print()
        })
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err.message || '印刷用PDFの生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const taxLabel = TAX_TABLE_LABELS[slip.tax_table_type] || slip.tax_table_type

  return (
    <VStack gap={4}>
      <PageHeader
        title={formatBillingMonth(slip.year_month)}
        backLabel="一覧へ"
        onBack={onBack}
        actions={
          <HStack gap={2} wrap="wrap">
            <Button
              variant="secondary"
              label="印刷"
              onClick={handlePrint}
              isDisabled={busy}
              isLoading={busy}
            />
            <Button
              variant="primary"
              label="PDFダウンロード"
              onClick={handleDownload}
              isDisabled={busy}
              isLoading={busy}
            />
          </HStack>
        }
      />
      {error ? <Banner status="error" title={error} collapsible={false} /> : null}
      <Card padding={4}>
        <VStack gap={2}>
          <Text weight="medium">{employeeName}</Text>
          <Text color="secondary">
            {Number(slip.total_hours)}h × ¥{Number(slip.hourly_wage_snapshot).toLocaleString()}
          </Text>
          <HStack hAlign="between">
            <Text color="secondary">基本給</Text>
            <Text hasTabularNumbers>{formatYen(slip.base_pay)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text color="secondary">手当</Text>
            <Text hasTabularNumbers>{formatYen(slip.allowance)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text weight="medium">総支給額</Text>
            <Text hasTabularNumbers weight="medium">
              {formatYen(slip.gross_pay)}
            </Text>
          </HStack>
          <HStack hAlign="between">
            <Text color="secondary">社会保険料控除</Text>
            <Text hasTabularNumbers>{formatYen(slip.social_insurance)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text color="secondary">基準額</Text>
            <Text hasTabularNumbers>{formatYen(slip.taxable_base)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text color="secondary">源泉徴収（{taxLabel}）</Text>
            <Text hasTabularNumbers>{formatYen(slip.withholding_tax)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text color="secondary">その他控除</Text>
            <Text hasTabularNumbers>{formatYen(slip.other_deduction)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text weight="medium">差引支給額</Text>
            <Text hasTabularNumbers weight="medium" type="large">
              {formatYen(slip.net_pay)}
            </Text>
          </HStack>
          {slip.note ? (
            <Text color="secondary" type="small">
              メモ: {slip.note}
            </Text>
          ) : null}
        </VStack>
      </Card>
    </VStack>
  )
}

function PayslipList({ employee, onLogout }) {
  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: apiErr } = await callEmployeeShiftApi(
      { action: 'list_payslips' },
      { employeeSession: true }
    )
    if (apiErr || !data?.ok) {
      setError(apiErr?.message || data?.error || '明細の取得に失敗しました')
      setSlips([])
    } else {
      setSlips(data.slips || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (selected) {
    return (
      <PayslipDetail
        slip={selected}
        employeeName={employee?.name || ''}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <VStack gap={4}>
      <PageHeader
        title="給与明細"
        actions={
          <Button
            variant="ghost"
            label="ログアウト"
            icon={<LogOut size={16} />}
            onClick={onLogout}
          />
        }
      />
      <Text color="secondary">{employee?.name} さん — 公開済みの明細のみ表示されます</Text>
      {error ? <Banner status="error" title={error} collapsible={false} /> : null}
      {loading ? (
        <Center padding={8}>
          <Spinner label="読み込み中..." />
        </Center>
      ) : null}
      {!loading && slips.length === 0 ? (
        <Center padding={8}>
          <Text color="secondary">公開された給与明細はありません</Text>
        </Center>
      ) : null}
      <VStack gap={2}>
        {slips.map((slip) => (
          <Card key={slip.id} padding={3}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <VStack gap={0}>
                <Text weight="medium">{formatBillingMonth(slip.year_month)}</Text>
                <Text color="secondary">差引 {formatYen(slip.net_pay)}</Text>
              </VStack>
              <Button variant="secondary" label="詳細" onClick={() => setSelected(slip)} />
            </HStack>
          </Card>
        ))}
      </VStack>
    </VStack>
  )
}

export function PayslipMemberPage() {
  return (
    <ShiftPinGate>
      {({ employee }) => (
        <PageFrame>
          <PayslipList
            employee={employee}
            onLogout={() => {
              clearEmployeeShiftSession()
              window.location.reload()
            }}
          />
        </PageFrame>
      )}
    </ShiftPinGate>
  )
}
