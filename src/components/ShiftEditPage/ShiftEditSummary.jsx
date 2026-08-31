import { Banner } from '@astryxdesign/core/Banner'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, VStack } from '@astryxdesign/core/Layout'
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
import { LICENSE_TYPE1, formatYen } from '@/lib/shiftRequestEdit'

function licenseTokenColor(licenseType) {
  return licenseType === LICENSE_TYPE1 ? 'blue' : 'purple'
}

export function ShiftEditSummary({ staffSummary, monthLaborCost, requestRows }) {
  const submittedCount = (requestRows ?? []).filter((row) => row.has_request).length
  const staffCount = (requestRows ?? []).length
  const totalAdopted = (staffSummary ?? []).reduce((sum, row) => sum + row.adoptedDays, 0)
  const totalRequested = (staffSummary ?? []).reduce((sum, row) => sum + row.requestedDays, 0)
  const totalHours = (staffSummary ?? []).reduce((sum, row) => sum + row.hours, 0)

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={3}>希望採用サマリ</Heading>
          <HStack gap={1} wrap="wrap" vAlign="center">
            <Token size="md" color="green" label={`想定人件費 ${formatYen(monthLaborCost)}`} />
            <Token
              size="sm"
              color="gray"
              label={staffCount > 0 ? `希望提出 ${submittedCount}/${staffCount}人` : '希望未取得'}
            />
          </HStack>
        </HStack>
        <Text color="secondary">
          各日のチェックで希望を採用するとシフトに追加されます。号車・役割は自動割当（あとから編集可）。同じ号車の開始は遅い希望、終了は短い希望に揃えます。想定人件費は予定時間×時給です。
        </Text>

        {staffSummary.length === 0 ? (
          <Text color="secondary">この月に提出された希望はありません</Text>
        ) : (
          <Table density="compact" hasHover>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>名前</TableHeaderCell>
                <TableHeaderCell>免許</TableHeaderCell>
                <TableHeaderCell>希望</TableHeaderCell>
                <TableHeaderCell>採用</TableHeaderCell>
                <TableHeaderCell>時間</TableHeaderCell>
                <TableHeaderCell>想定人件費</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffSummary.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Token
                      size="sm"
                      color={licenseTokenColor(row.licenseType)}
                      label={row.licenseType || '—'}
                    />
                  </TableCell>
                  <TableCell>{row.requestedDays}日</TableCell>
                  <TableCell>
                    {row.adoptedDays}日{row.requestedDays > 0 ? ` / ${row.requestedDays}` : ''}
                  </TableCell>
                  <TableCell>{row.hours}h</TableCell>
                  <TableCell>{formatYen(row.laborCost)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <Text weight="semibold">合計</Text>
                </TableCell>
                <TableCell />
                <TableCell>
                  <Text weight="semibold">{totalRequested}日</Text>
                </TableCell>
                <TableCell>
                  <Text weight="semibold">{totalAdopted}日</Text>
                </TableCell>
                <TableCell>
                  <Text weight="semibold">{Math.round(totalHours * 10) / 10}h</Text>
                </TableCell>
                <TableCell>
                  <Text weight="semibold">{formatYen(monthLaborCost)}</Text>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        {monthLaborCost > 0 && staffSummary.some((row) => row.hours > 0 && row.laborCost === 0) ? (
          <Banner
            status="warning"
            title="時給が未設定のスタッフがいるため、人件費に含まれていません"
            collapsible={false}
          />
        ) : null}
      </VStack>
    </Card>
  )
}
