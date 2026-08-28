import { useEffect, useMemo, useState } from 'react'
import { Typeahead, TypeaheadItem } from '@astryxdesign/core/Typeahead'

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

function toItem(company) {
  if (!company) return null
  return {
    id: company.isCreateOption ? CREATE_OPTION_ID : String(company.id),
    label: company.isCreateOption ? `「${company.name}」を新規追加` : labelOf(company),
    company,
  }
}

/**
 * 取引先選択。値の入出力は `company.id`（null = 未選択）。
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
}) {
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createdLocal, setCreatedLocal] = useState([])
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const base = companies.filter((c) => includeInactive || c.is_active)
    const extras = createdLocal.filter((e) => !base.some((b) => b.id === e.id))
    return [...base, ...extras]
  }, [companies, includeInactive, createdLocal])

  const selectedCompany = options.find((c) => c.id === value) ?? null
  const selectedItem = toItem(selectedCompany)

  const searchSource = useMemo(
    () => ({
      search: (rawQuery) => {
        const q = String(rawQuery || '').trim().toLowerCase()
        const filtered = !q
          ? options
          : options.filter((o) => {
              const haystack = [o.name, o.invoice_display_name, ...(o.aliases || [])]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              return haystack.includes(q)
            })
        const trimmed = String(rawQuery || '').trim()
        if (creatable && onCreate && trimmed && !findExactMatch(options, trimmed)) {
          return [
            ...filtered.map(toItem),
            toItem({
              id: CREATE_OPTION_ID,
              name: trimmed,
              invoice_display_name: trimmed,
              is_active: true,
              isCreateOption: true,
            }),
          ]
        }
        return filtered.map(toItem)
      },
      bootstrap: () => options.map(toItem),
    }),
    [options, creatable, onCreate]
  )

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

  const commitTypedName = async (raw) => {
    if (!creatable || !onCreate || creating) return
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) return
    if (selectedCompany && labelOf(selectedCompany).trim() === trimmed) return
    const exact = findExactMatch(options, trimmed)
    if (exact) {
      onChange?.(exact.id)
      return
    }
    await createByName(trimmed)
  }

  useEffect(() => {
    if (value == null) setQuery('')
  }, [value])

  return (
    <Typeahead
      label={label}
      searchSource={searchSource}
      value={selectedItem}
      onChange={(item) => {
        setCreateError(null)
        if (!item) {
          onChange?.(null)
          return
        }
        if (item.id === CREATE_OPTION_ID || item.company?.isCreateOption) {
          const name = String(item.company?.name || query).trim()
          if (name) void createByName(name)
          return
        }
        onChange?.(item.company?.id ?? null)
      }}
      onChangeQuery={setQuery}
      onOpenChange={(isOpen) => {
        if (isOpen || !creatable || selectedCompany || creating) return
        const pending = query.trim()
        if (!pending) return
        void commitTypedName(pending)
      }}
      hasEntriesOnFocus
      hasClear
      isDisabled={disabled || creating}
      isLoading={creating}
      size={size === 'small' ? 'sm' : 'md'}
      width="100%"
      debounceMs={0}
      maxMenuItems={50}
      status={createError ? { type: 'error', message: createError } : undefined}
      renderItem={(item) => (
        <TypeaheadItem
          item={item}
          description={
            item.company?.isCreateOption
              ? '新規追加'
              : item.company && item.company.is_active === false
                ? '(無効)'
                : undefined
          }
        />
      )}
    />
  )
}
