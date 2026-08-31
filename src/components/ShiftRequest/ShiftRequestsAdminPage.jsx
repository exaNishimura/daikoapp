import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { listShiftAvailabilityRequests } from '@/services/employeeShiftService'

function RequestDetailRow({ row }) {
  const [open, setOpen] = useState(false)
  const days = row.payload?.days ?? {}
  const entries = Object.entries(days)
    .filter(([, v]) => v?.available)
    .sort(([a], [b]) => a.localeCompare(b))

  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton
            size="sm"
            variant="ghost"
            label="詳細"
            tooltip="詳細"
            icon={open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            onClick={() => setOpen(!open)}
          />
        </TableCell>
        <TableCell>{row.employee_name}</TableCell>
        <TableCell>{row.license_type}</TableCell>
        <TableCell>
          <Token
            size="sm"
            label={row.shift_pin_configured ? 'PIN設定済' : 'PIN未設定'}
            color={row.shift_pin_configured ? 'green' : 'gray'}
          />
        </TableCell>
        <TableCell>{row.has_request ? row.available_days : '—'}</TableCell>
        <TableCell>{row.updated_at ? dayjs(row.updated_at).format('M/D HH:mm') : '—'}</TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell>
            <VStack gap={2}>
              {!row.has_request ? (
                <Text color="secondary">未提出</Text>
              ) : entries.length === 0 ? (
                <Text color="secondary">出勤可の日がありません</Text>
              ) : (
                <VStack gap={1}>
                  {entries.map(([date, d]) => (
                    <Text key={date}>
                      {dayjs(date).format('M/D（ddd）')} {d.start}〜{d.end}
                    </Text>
                  ))}
                </VStack>
              )}
              {row.payload?.notes ? <Text>備考: {row.payload.notes}</Text> : null}
            </VStack>
          </TableCell>
          <TableCell />
          <TableCell />
          <TableCell />
          <TableCell />
          <TableCell />
        </TableRow>
      ) : null}
    </>
  )
}

export function ShiftRequestsAdminPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => dayjs().add(1, 'month').format('YYYY-MM'))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: apiErr } = await listShiftAvailabilityRequests(month)
    if (apiErr) {
      setError(apiErr.message)
      setRows([])
    } else {
      setRows(data?.rows ?? [])
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const shiftMonth = (delta) => {
    setMonth((m) => dayjs(`${m}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  return (
    <PageFrame>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={1}>シフト希望一覧（管理者）</Heading>
          <Button
            label="この月のシフトを編集"
            variant="primary"
            onClick={() => {
              const [y, m] = month.split('-')
              navigate(`/shift/edit?year=${Number(y)}&month=${Number(m)}`)
            }}
          />
        </HStack>

        <Card padding={4}>
          <HStack hAlign="center" vAlign="center" gap={1}>
            <IconButton
              label="前の月"
              tooltip="前の月"
              variant="ghost"
              icon={<ChevronLeft />}
              onClick={() => shiftMonth(-1)}
            />
            <Heading level={3}>{dayjs(`${month}-01`).format('YYYY年M月')}</Heading>
            <IconButton
              label="次の月"
              tooltip="次の月"
              variant="ghost"
              icon={<ChevronRight />}
              onClick={() => shiftMonth(1)}
            />
          </HStack>
        </Card>

        {error ? <Banner status="error" title={error} collapsible={false} /> : null}

        {loading ? (
          <Text>読み込み中...</Text>
        ) : (
          <Table density="compact" hasHover>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>{'\u00a0'}</TableHeaderCell>
                <TableHeaderCell>名前</TableHeaderCell>
                <TableHeaderCell>免許</TableHeaderCell>
                <TableHeaderCell>PIN</TableHeaderCell>
                <TableHeaderCell>出勤可日数</TableHeaderCell>
                <TableHeaderCell>更新日時</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <RequestDetailRow key={row.employee_id} row={row} />
              ))}
            </TableBody>
          </Table>
        )}

        <Button label="再読み込み" variant="secondary" onClick={load} isDisabled={loading} />
      </VStack>
    </PageFrame>
  )
}
