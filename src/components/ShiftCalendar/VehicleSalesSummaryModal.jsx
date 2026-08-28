import { useMemo } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Center } from '@astryxdesign/core/Center'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, TableBody, TableCell, TableRow } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { useDailySaleByDate } from '@/hooks/billing/useDailySales'
import { useReceivablesByWorkDate } from '@/hooks/billing/useReceivables'
import { useCompanies } from '@/hooks/billing/useCompanies'
import { getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'
import { filterReceivablesByVehicle, sumReceivableAmounts } from '@/lib/billing/shiftReceivables'
import { getStaffHoursLabelsByCar } from '@/lib/billing/shiftStaffHours'
import { computeCashForVehicle } from '@/lib/billing/dailySalesCalc'
import {
  buildCompanyLookup,
  enrichReceivablesWithCompanies,
  getReceivableDisplayName,
} from '@/lib/billing/receivableForm'

function formatWorkDateLabel(workDate, dow) {
  if (!workDate) return ''
  const [y, m, d] = workDate.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const dowLabel = dow ? `（${dow}）` : ''
  return `${y}年${mm}月${dd}日${dowLabel}`
}

function formatYen(value) {
  if (value == null || value === '') return '—'
  return `¥${Number(value).toLocaleString('ja-JP')}`
}

function formatDistance(value) {
  if (value == null || value === '') return '—'
  return `${Number(value).toLocaleString('ja-JP')} km`
}

function SummaryRow({ label, value, emphasize = false }) {
  return (
    <TableRow>
      <TableCell>
        <Text color="secondary">{label}</Text>
      </TableCell>
      <TableCell>
        <Text weight={emphasize ? 'semibold' : undefined}>{value}</Text>
      </TableCell>
    </TableRow>
  )
}

export function VehicleSalesSummaryModal({
  open,
  workDate,
  dow,
  carNum,
  dayShifts = [],
  employees = [],
  onClose,
}) {
  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const receivablesQuery = useReceivablesByWorkDate(open ? workDate : null)
  const companiesQuery = useCompanies()

  const companyLookup = useMemo(
    () => buildCompanyLookup(companiesQuery.data ?? []),
    [companiesQuery.data]
  )

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const loading = saleQuery.isLoading || receivablesQuery.isLoading || companiesQuery.isLoading
  const salesRow = saleQuery.data ?? null
  const receivables = filterReceivablesByVehicle(
    enrichReceivablesWithCompanies(receivablesQuery.data ?? [], companiesQuery.data ?? []),
    carNum
  )
  const staffLabels = getStaffHoursLabelsByCar(dayShifts, employees, carNum)

  const vehicleKeys = carNum ? getVehicleFieldKeys(carNum) : null
  const distance = vehicleKeys ? salesRow?.[vehicleKeys.distance_km] : null
  const fuel = vehicleKeys ? salesRow?.[vehicleKeys.fuel_yen] : null
  const sales = vehicleKeys ? salesRow?.[vehicleKeys.sales] : null

  const expenseAmount = vehicleKeys ? Number(salesRow?.[vehicleKeys.expense_amount]) || 0 : 0
  const expenseNote = vehicleKeys ? salesRow?.[vehicleKeys.expense_note]?.trim() || '' : ''
  const hasExpense = expenseAmount > 0 || expenseNote !== ''

  const vehicleCash = useMemo(() => {
    if (!salesRow || !carNum) return null
    return computeCashForVehicle(salesRow, carNum, sumReceivableAmounts(receivables))
  }, [salesRow, carNum, receivables])

  const dateLabel = formatWorkDateLabel(workDate, dow)

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="info">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="集計結果" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            {loading ? (
              <Center padding={4}>
                <Spinner />
              </Center>
            ) : (
              <VStack gap={4}>
                <Table density="compact">
                  <TableBody>
                    <SummaryRow label="日付" value={dateLabel} />
                    <SummaryRow label="号車" value={carNum ? `${carNum}号車` : '—'} />
                    <SummaryRow label="走行距離" value={formatDistance(distance)} />
                    <SummaryRow label="燃料代" value={formatYen(fuel)} />
                    <SummaryRow label="売上" value={formatYen(sales)} />
                  </TableBody>
                </Table>

                <VStack gap={1}>
                  <Text color="secondary" weight="semibold">
                    稼働スタッフ
                  </Text>
                  {staffLabels.length === 0 ? (
                    <Text color="secondary">なし</Text>
                  ) : (
                    staffLabels.map((label) => <Text key={label}>{label}</Text>)
                  )}
                </VStack>

                <VStack gap={1}>
                  <Text color="secondary" weight="semibold">
                    未収（売掛）
                  </Text>
                  {receivables.length === 0 ? (
                    <Text color="secondary">なし</Text>
                  ) : (
                    <Table density="compact">
                      <TableBody>
                        {receivables.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{getReceivableDisplayName(row, companyLookup)}</TableCell>
                            <TableCell>{formatYen(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </VStack>

                {hasExpense ? (
                  <VStack gap={1}>
                    <Text color="secondary" weight="semibold">
                      経費
                    </Text>
                    <Table density="compact">
                      <TableBody>
                        {expenseNote ? <SummaryRow label="内容" value={expenseNote} /> : null}
                        {expenseAmount > 0 ? (
                          <SummaryRow label="金額" value={formatYen(expenseAmount)} />
                        ) : null}
                      </TableBody>
                    </Table>
                  </VStack>
                ) : null}

                <Table density="compact">
                  <TableBody>
                    <SummaryRow label="現金" value={formatYen(vehicleCash)} emphasize />
                  </TableBody>
                </Table>
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack hAlign="end">
              <Button label="閉じる" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
