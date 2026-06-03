import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

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
  const [tab, setTab] = useState(0)

  return (
    <Paper>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2 }}>
        <Tab label={`集計 (${parsed.dailySales.length} 日)`} />
        <Tab label={`売掛 (${receivablesAnnotated.length} 行)`} />
        <Tab label={`スタッフ売上 (${parsed.staffSales.length} 行)`} />
        <Tab label={`固定経費 (${parsed.fixedExpenses.length} 件)`} />
      </Tabs>
      <Box sx={{ p: 2 }}>
        {tab === 0 && <DailyTable rows={parsed.dailySales} />}
        {tab === 1 && <ReceivablesTable rows={receivablesAnnotated} />}
        {tab === 2 && <StaffTable rows={parsed.staffSales} />}
        {tab === 3 && <FixedTable rows={parsed.fixedExpenses} />}
      </Box>
    </Paper>
  )
}

function DailyTable({ rows }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>日</TableCell>
            <TableCell align="right">距離(1)</TableCell>
            <TableCell align="right">距離(2)</TableCell>
            <TableCell align="right">燃料(1)</TableCell>
            <TableCell align="right">燃料(2)</TableCell>
            <TableCell align="right">売上(1)</TableCell>
            <TableCell align="right">売上(2)</TableCell>
            <TableCell align="right">売上(3)</TableCell>
            <TableCell align="right">経費</TableCell>
            <TableCell align="right">現金</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDate(r.workDate)}</TableCell>
              <TableCell align="right">{r.vehicle1DistanceKm ?? '—'}</TableCell>
              <TableCell align="right">{r.vehicle2DistanceKm ?? '—'}</TableCell>
              <TableCell align="right">{r.vehicle1FuelYen ?? '—'}</TableCell>
              <TableCell align="right">{r.vehicle2FuelYen ?? '—'}</TableCell>
              <TableCell align="right">{r.vehicle1Sales}</TableCell>
              <TableCell align="right">{r.vehicle2Sales}</TableCell>
              <TableCell align="right">{r.vehicle3Sales}</TableCell>
              <TableCell align="right">{r.expenseAmount}</TableCell>
              <TableCell align="right">{r.cash}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ReceivablesTable({ rows }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>取引先</TableCell>
            <TableCell>作業日</TableCell>
            <TableCell>出発</TableCell>
            <TableCell>到着</TableCell>
            <TableCell align="right">金額</TableCell>
            <TableCell>状態</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow
              key={i}
              sx={{ bgcolor: r.duplicate ? 'action.disabledBackground' : undefined }}
            >
              <TableCell>{r.companyName}</TableCell>
              <TableCell>{fmtDate(r.workDate)}</TableCell>
              <TableCell>{r.departure ?? '—'}</TableCell>
              <TableCell>{r.destination ?? '—'}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                ¥{Number(r.amount).toLocaleString('ja-JP')}
              </TableCell>
              <TableCell>
                {r.duplicate && <Chip label="重複" size="small" color="default" />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StaffTable({ rows }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>日</TableCell>
            <TableCell>スタッフ</TableCell>
            <TableCell align="right">売上</TableCell>
            <TableCell align="right">稼働(h)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{fmtDate(r.workDate)}</TableCell>
              <TableCell>{r.staffName}</TableCell>
              <TableCell align="right">{r.sales}</TableCell>
              <TableCell align="right">{r.hours}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function FixedTable({ rows }) {
  if (rows.length === 0) {
    return <Typography color="text.secondary">固定経費の取り込みはありません</Typography>
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>項目</TableCell>
            <TableCell align="right">金額</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.label}</TableCell>
              <TableCell align="right">¥{Number(r.amount).toLocaleString('ja-JP')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
