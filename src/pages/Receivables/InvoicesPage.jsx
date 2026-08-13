import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString } from '@/components/Receivables/monthUtils'
import { InvoiceIssueTab } from './InvoiceIssueTab'
import { InvoiceIssuedTab } from './InvoiceIssuedTab'
import { InvoiceUnpaidTab } from './InvoiceUnpaidTab'

function currentYearMonth() {
  return toMonthString(new Date()) ?? '2026-01'
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [tab, setTab] = useState(0)

  const { year, month } = fromMonthString(monthValue) ?? { year: 2026, month: 1 }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          請求書
        </Typography>
        <Box sx={{ flex: 1 }} />
        {tab !== 2 && <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />}
      </Box>

      <Paper>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label="新規発行" />
          <Tab label="発行済一覧" />
          <Tab label="未入金一覧" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <InvoiceIssueTab year={year} month={month} />}
          {tab === 1 && <InvoiceIssuedTab year={year} month={month} />}
          {tab === 2 && <InvoiceUnpaidTab />}
        </Box>
      </Paper>
    </Box>
  )
}
