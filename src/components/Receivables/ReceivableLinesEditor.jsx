import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { EMPTY_RECEIVABLE_LINE } from '@/lib/billing/shiftReceivables'

/**
 * 売掛の複数行入力（請求先 + 金額 + 備考）
 */
export function ReceivableLinesEditor({
  lines,
  onChange,
  disabled = false,
  companies = null,
}) {
  const showCompany = Array.isArray(companies)

  const updateLine = (index, patch) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    onChange([...lines, { ...EMPTY_RECEIVABLE_LINE }])
  }

  const removeLine = (index) => {
    if (lines.length <= 1) {
      onChange([{ ...EMPTY_RECEIVABLE_LINE }])
      return
    }
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <Stack spacing={1.5}>
      {lines.map((line, index) => (
        <Box
          key={line.id ?? `line-${index}`}
          sx={{
            display: 'grid',
            gap: 1,
            alignItems: 'start',
            gridTemplateColumns: {
              xs: '1fr auto',
              sm: showCompany
                ? 'minmax(0, 1.4fr) minmax(0, 0.9fr) minmax(0, 1fr) auto'
                : '1fr 1fr auto',
            },
            p: { xs: 1.5, sm: 0 },
            border: { xs: 1, sm: 0 },
            borderColor: { xs: 'divider', sm: 'transparent' },
            borderRadius: { xs: 1, sm: 0 },
          }}
        >
          {showCompany && (
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
              <CompanySelect
                companies={companies}
                value={line.company_id}
                onChange={(company_id) => updateLine(index, { company_id })}
                disabled={disabled}
                label="請求先"
              />
            </Box>
          )}
          <TextField
            label="金額 (円)"
            type="number"
            size="small"
            value={line.amount}
            onChange={(e) => updateLine(index, { amount: e.target.value })}
            inputProps={{ step: 1, min: 0 }}
            disabled={disabled}
            fullWidth
            sx={{ gridColumn: { xs: '1 / 2', sm: 'auto' } }}
          />
          <TextField
            label="備考"
            size="small"
            value={line.note}
            onChange={(e) => updateLine(index, { note: e.target.value })}
            disabled={disabled}
            placeholder="請求書払いなど"
            fullWidth
            sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          />
          <IconButton
            size="small"
            onClick={() => removeLine(index)}
            disabled={disabled}
            aria-label="行を削除"
            sx={{
              mt: { xs: 0, sm: 0.5 },
              gridColumn: { xs: '2 / 3', sm: 'auto' },
              gridRow: { xs: showCompany ? 2 : 1, sm: 'auto' },
              alignSelf: { xs: 'start', sm: 'auto' },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={addLine}
        disabled={disabled}
        sx={{ alignSelf: 'flex-start' }}
      >
        売掛を追加
      </Button>
    </Stack>
  )
}
