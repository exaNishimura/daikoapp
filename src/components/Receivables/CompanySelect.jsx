import { useMemo } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'

/**
 * 取引先選択コンポーネント。
 *
 * - companies の `name` `invoice_display_name` `aliases` を全文部分一致で検索
 * - `is_active=false` の取引先は `includeInactive` 指定時のみ表示し、(無効) バッジを付ける
 * - 値の入出力は `company.id`（null = 未選択）
 *
 * @param {Object} props
 * @param {Array}  props.companies          取引先一覧
 * @param {number|null} props.value         選択中の company.id
 * @param {(id: number|null) => void} props.onChange
 * @param {boolean} [props.includeInactive] true で非アクティブも候補に含める
 * @param {string}  [props.label]
 * @param {string}  [props.size]            MUI size (default 'small')
 */
export function CompanySelect({
  companies = [],
  value,
  onChange,
  includeInactive = false,
  label = '取引先',
  size = 'small',
  ...rest
}) {
  const options = useMemo(
    () => companies.filter((c) => includeInactive || c.is_active),
    [companies, includeInactive]
  )

  const selected = options.find((c) => c.id === value) ?? null

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_event, newValue) => onChange?.(newValue?.id ?? null)}
      getOptionLabel={(c) => c?.invoice_display_name || c?.name || ''}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase()
        if (!q) return opts
        return opts.filter((o) => {
          const haystack = [o.name, o.invoice_display_name, ...(o.aliases || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })
      }}
      renderOption={(props, option) => {
        const { key, ...liProps } = props
        return (
          <Box
            component="li"
            key={key ?? option.id}
            {...liProps}
            sx={{
              opacity: option.is_active ? 1 : 0.55,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <span>{option.invoice_display_name || option.name}</span>
            {!option.is_active && (
              <span style={{ fontSize: 12, color: '#888' }}>(無効)</span>
            )}
          </Box>
        )
      }}
      renderInput={(params) => <TextField {...params} label={label} size={size} />}
      {...rest}
    />
  )
}
