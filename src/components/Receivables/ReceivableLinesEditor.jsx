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
            gridTemplateColumns: showCompany
              ? 'minmax(0, 1.4fr) minmax(0, 0.9fr) minmax(0, 1fr) auto'
              : '1fr 1fr auto',
            gap: 1,
            alignItems: 'start',
          }}
        >
          {showCompany && (
            <CompanySelect
              companies={companies}
              value={line.company_id}
              onChange={(company_id) => updateLine(index, { company_id })}
              disabled={disabled}
              label="請求先"
            />
          )}
          <TextField
            label="金額 (円)"
            type="number"
            size="small"
            value={line.amount}
            onChange={(e) => updateLine(index, { amount: e.target.value })}
            inputProps={{ step: 1, min: 0 }}
            disabled={disabled}
          />
          <TextField
            label="備考"
            size="small"
            value={line.note}
            onChange={(e) => updateLine(index, { note: e.target.value })}
            disabled={disabled}
            placeholder="請求書払いなど"
          />
          <IconButton
            size="small"
            onClick={() => removeLine(index)}
            disabled={disabled}
            aria-label="行を削除"
            sx={{ mt: 0.5 }}
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
