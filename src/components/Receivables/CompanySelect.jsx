import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

const CREATE_OPTION_ID = '__create__'

function labelOf(company) {
  if (!company) return ''
  return company.invoice_display_name || company.name || ''
}

function findExactMatch(opts, trimmed) {
  const q = trimmed.toLowerCase()
  return (
    opts.find((o) => {
      if (o.isCreateOption) return false
      const names = [o.name, o.invoice_display_name, ...(o.aliases || [])]
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase())
      return names.includes(q)
    }) ?? null
  )
}

/**
 * 取引先選択コンポーネント。
 *
 * - companies の `name` `invoice_display_name` `aliases` を全文部分一致で検索
 * - `is_active=false` の取引先は `includeInactive` 指定時のみ表示し、(無効) バッジを付ける
 * - `creatable` + `onCreate` 指定時、一致なしなら「「名前」を新規追加」を出せる
 * - creatable 時は blur（金額欄への移動など）でも入力名を確定・新規追加する
 * - 値の入出力は `company.id`（null = 未選択）
 */
export function CompanySelect({
  companies = [],
  value,
  onChange,
  includeInactive = false,
  creatable = false,
  onCreate,
  label = '取引先',
  size = 'small',
  disabled = false,
  ...rest
}) {
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  /** 作成直後〜親の companies 更新までの隙間埋め */
  const [createdLocal, setCreatedLocal] = useState([])
  const [inputValue, setInputValue] = useState('')

  const options = useMemo(() => {
    const base = companies.filter((c) => includeInactive || c.is_active)
    const extras = createdLocal.filter((e) => !base.some((b) => b.id === e.id))
    return [...base, ...extras]
  }, [companies, includeInactive, createdLocal])

  const selected = options.find((c) => c.id === value) ?? null

  useEffect(() => {
    if (value == null) {
      if (!creating) setInputValue('')
      return
    }
    const row = options.find((c) => c.id === value)
    if (row) setInputValue(labelOf(row))
    // options は一覧再取得で変わる。value 変更時だけ同期する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const filterOptions = (opts, state) => {
    const q = state.inputValue.trim().toLowerCase()
    const filtered = !q
      ? opts
      : opts.filter((o) => {
          if (o.isCreateOption) return false
          const haystack = [o.name, o.invoice_display_name, ...(o.aliases || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })

    const trimmed = state.inputValue.trim()
    if (!creatable || !onCreate || !trimmed) return filtered
    if (findExactMatch(opts, trimmed)) return filtered

    return [
      ...filtered,
      {
        id: CREATE_OPTION_ID,
        name: trimmed,
        invoice_display_name: trimmed,
        is_active: true,
        isCreateOption: true,
      },
    ]
  }

  const applyCreated = (created, name) => {
    const id = typeof created === 'number' ? created : created?.id
    if (id == null) throw new Error('取引先の作成に失敗しました')
    const row =
      typeof created === 'object' && created != null
        ? created
        : {
            id,
            name,
            invoice_display_name: name,
            aliases: [],
            is_active: true,
          }
    setCreatedLocal((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, row]))
    setInputValue(labelOf(row) || name)
    onChange?.(id)
    return id
  }

  const createByName = async (name) => {
    if (!onCreate || creating) return null
    try {
      setCreating(true)
      setCreateError(null)
      const created = await onCreate(name)
      return applyCreated(created, name)
    } catch (err) {
      setCreateError(err?.message || '取引先の追加に失敗しました')
      return null
    } finally {
      setCreating(false)
    }
  }

  /** blur / Enter で未確定の入力を確定する */
  const commitTypedName = async (raw) => {
    if (!creatable || !onCreate || creating) return
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) return
    if (selected && labelOf(selected).trim() === trimmed) return

    const exact = findExactMatch(options, trimmed)
    if (exact) {
      setInputValue(labelOf(exact))
      onChange?.(exact.id)
      return
    }

    await createByName(trimmed)
  }

  const handleChange = async (_event, newValue, reason) => {
    setCreateError(null)
    if (reason === 'clear' || newValue == null) {
      setInputValue('')
      onChange?.(null)
      return
    }
    // freeSolo: Enter で文字列が来る場合がある
    if (typeof newValue === 'string') {
      await commitTypedName(newValue)
      return
    }
    if (newValue.isCreateOption) {
      const name = String(newValue.name || '').trim()
      if (!name) return
      await createByName(name)
      return
    }
    setInputValue(labelOf(newValue))
    onChange?.(newValue.id ?? null)
  }

  return (
    <Autocomplete
      options={options}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_event, next, reason) => {
        if (reason === 'reset') return
        if (reason === 'clear') {
          setInputValue('')
          return
        }
        setInputValue(next)
      }}
      onChange={handleChange}
      onClose={(_event, reason) => {
        // 候補クリックは selectOption。Tab/外クリックは blur → ここで確定
        if (reason !== 'blur') return
        if (!creatable || selected || creating) return
        const pending = inputValue.trim()
        if (!pending) return
        void commitTypedName(pending)
      }}
      filterOptions={filterOptions}
      getOptionLabel={(c) => {
        if (typeof c === 'string') return c
        if (c?.isCreateOption) return c.name || ''
        return labelOf(c)
      }}
      isOptionEqualToValue={(opt, val) => {
        if (!opt || !val) return false
        if (typeof opt === 'string' || typeof val === 'string') return opt === val
        return opt.id === val.id
      }}
      getOptionDisabled={(opt) =>
        typeof opt !== 'string' && creating && opt.isCreateOption
      }
      disabled={disabled || creating}
      clearOnBlur={!creatable}
      selectOnFocus
      handleHomeEndKeys
      freeSolo={creatable}
      renderOption={(props, option) => {
        const { key, ...liProps } = props
        if (option.isCreateOption) {
          return (
            <Box
              component="li"
              key={key ?? CREATE_OPTION_ID}
              {...liProps}
              sx={{ fontWeight: 600 }}
            >
              「{option.name}」を新規追加
            </Box>
          )
        }
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
            <span>{labelOf(option)}</span>
            {!option.is_active && (
              <span style={{ fontSize: 12, color: '#888' }}>(無効)</span>
            )}
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          error={!!createError}
          helperText={createError || undefined}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {creating ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      {...rest}
    />
  )
}
