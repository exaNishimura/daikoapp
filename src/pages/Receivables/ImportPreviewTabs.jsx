import { useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import { TabList, Tab } from '@astryxdesign/core/TabList'
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

const TABS = {
  daily: 'daily',
  receivables: 'receivables',
  staff: 'staff',
  fixed: 'fixed',
}

function fmtDate(d) {
  if (!d) return ''
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return String(d)
}

/**
 * パース結果プレビュー (集計タブ / 売掛タブ)。
 */
export function ImportPreviewTabs({ parsed, receivablesAnnotated }) {
  const [tab, setTab] = useState(TABS.daily)

  return (
    <Card padding={2}>
      <VStack gap={3}>
        <TabList value={tab} onChange={setTab} role="tablist" hasDivider>
          <Tab
            value={TABS.daily}
            label={`集計 (${parsed.dailySales.length} 日)`}
            panelId="import-panel-daily"
          />
          <Tab
            value={TABS.receivables}
            label={`売掛 (${receivablesAnnotated.length} 行)`}
            panelId="import-panel-receivables"
          />
          <Tab
            value={TABS.staff}
            label={`スタッフ売上 (${parsed.staffSales.length} 行)`}
            panelId="import-panel-staff"
          />
          <Tab
            value={TABS.fixed}
            label={`固定経費 (${parsed.fixedExpenses.length} 件)`}
            panelId="import-panel-fixed"
          />
        </TabList>
        {tab === TABS.daily ? (
          <VStack id="import-panel-daily" role="tabpanel" gap={0}>
            <DailyTable rows={parsed.dailySales} />
          </VStack>
        ) : null}
        {tab === TABS.receivables ? (
          <VStack id="import-panel-receivables" role="tabpanel" gap={0}>
            <ReceivablesTable rows={receivablesAnnotated} />
          </VStack>
        ) : null}
        {tab === TABS.staff ? (
          <VStack id="import-panel-staff" role="tabpanel" gap={0}>
            <StaffTable rows={parsed.staffSales} />
          </VStack>
        ) : null}
        {tab === TABS.fixed ? (
          <VStack id="import-panel-fixed" role="tabpanel" gap={0}>
            <FixedTable rows={parsed.fixedExpenses} />
          </VStack>
        ) : null}
      </VStack>
    </Card>
  )
}

function DailyTable({ rows }) {
  return (
    <Table density="compact" hasHover>
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell>日</TableHeaderCell>
          <TableHeaderCell>距離(1号車)</TableHeaderCell>
          <TableHeaderCell>距離(2号車)</TableHeaderCell>
          <TableHeaderCell>燃料(1号車)</TableHeaderCell>
          <TableHeaderCell>燃料(2号車)</TableHeaderCell>
          <TableHeaderCell>売上(1号車)</TableHeaderCell>
          <TableHeaderCell>売上(2号車)</TableHeaderCell>
          <TableHeaderCell>経費</TableHeaderCell>
          <TableHeaderCell>人件費</TableHeaderCell>
          <TableHeaderCell>現金</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{fmtDate(r.workDate)}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle1DistanceKm ?? '—'}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle2DistanceKm ?? '—'}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle1FuelYen ?? '—'}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle2FuelYen ?? '—'}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle1Sales}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.vehicle2Sales}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.expenseAmount}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.laborCost ?? 0}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.cash}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ReceivablesTable({ rows }) {
  return (
    <Table density="compact" hasHover>
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell>取引先</TableHeaderCell>
          <TableHeaderCell>作業日</TableHeaderCell>
          <TableHeaderCell>出発</TableHeaderCell>
          <TableHeaderCell>到着</TableHeaderCell>
          <TableHeaderCell>金額</TableHeaderCell>
          <TableHeaderCell>状態</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow
            key={i}
            style={
              r.duplicate ? { backgroundColor: 'var(--color-background-muted)' } : undefined
            }
          >
            <TableCell>{r.companyName}</TableCell>
            <TableCell>{fmtDate(r.workDate)}</TableCell>
            <TableCell>{r.departure ?? '—'}</TableCell>
            <TableCell>{r.destination ?? '—'}</TableCell>
            <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              ¥{Number(r.amount).toLocaleString('ja-JP')}
            </TableCell>
            <TableCell>{r.duplicate ? <Token size="sm" label="重複" color="gray" /> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StaffTable({ rows }) {
  return (
    <Table density="compact" hasHover>
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell>日</TableHeaderCell>
          <TableHeaderCell>スタッフ</TableHeaderCell>
          <TableHeaderCell>売上</TableHeaderCell>
          <TableHeaderCell>稼働(h)</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{fmtDate(r.workDate)}</TableCell>
            <TableCell>{r.staffName}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.sales}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>{r.hours}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FixedTable({ rows }) {
  if (rows.length === 0) {
    return <Text color="secondary">固定経費の取り込みはありません</Text>
  }
  return (
    <Table density="compact" hasHover>
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell>項目</TableHeaderCell>
          <TableHeaderCell>金額</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.label}</TableCell>
            <TableCell style={{ textAlign: 'right' }}>
              ¥{Number(r.amount).toLocaleString('ja-JP')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
