import { useEffect, useMemo, useState } from 'react'
import { Typeahead, TypeaheadItem } from '@astryxdesign/core/Typeahead'

const FREE_OPTION_ID = '__free__'

function labelOf(company) {
  if (!company) return ''
  return company.invoice_display_name || company.name || ''
}

function namesOf(company) {
  return [company.name, company.invoice_display_name, ...(company.aliases || [])].filter(Boolean)
}

function findExactMatch(opts, trimmed) {
  const q = String(trimmed || '')
    .trim()
    .toLowerCase()
  if (!q) return null
  return (
    opts.find((o) => {
      if (o.isFreeOption) return false
      return namesOf(o)
        .map((s) => String(s).trim().toLowerCase())
        .includes(q)
    }) ?? null
  )
}

function toItem(company) {
  if (!company) return null
  if (company.isFreeOption) {
    return {
      id: FREE_OPTION_ID,
      label: `「${company.name}」をそのまま使う`,
      company,
    }
  }
  return {
    id: String(company.id),
    label: labelOf(company),
    company,
  }
}

function toFreeItem(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return null
  return { id: `free:${trimmed}`, label: trimmed, company: null, isFreeText: true }
}

/**
 * 顧客名。取引先マスタから選択、該当なしは自由入力。
 * 値は名前文字列（マスタへは追加しない）。
 */
export function CustomerNameSelect({
  companies = [],
  value = '',
  onChange,
  label = '顧客名',
  isRequired = false,
  isLoading = false,
  disabled = false,
  status,
  onChangeQuery,
}) {
  const [query, setQuery] = useState('')

  const handleQuery = (next) => {
    setQuery(next)
    onChangeQuery?.(next)
  }

  const options = useMemo(
    () => (companies || []).filter((c) => c.is_active !== false),
    [companies]
  )

  const trimmedValue = String(value || '').trim()
  const selectedCompany = findExactMatch(options, trimmedValue)
  const selectedItem = selectedCompany
    ? toItem(selectedCompany)
    : trimmedValue
      ? toFreeItem(trimmedValue)
      : null

  const searchSource = useMemo(
    () => ({
      search: (rawQuery) => {
        const q = String(rawQuery || '')
          .trim()
          .toLowerCase()
        const filtered = !q
          ? options
          : options.filter((o) => namesOf(o).join(' ').toLowerCase().includes(q))
        const trimmed = String(rawQuery || '').trim()
        const items = filtered.map(toItem)
        if (trimmed && !findExactMatch(options, trimmed)) {
          items.push(
            toItem({
              id: FREE_OPTION_ID,
              name: trimmed,
              isFreeOption: true,
            })
          )
        }
        return items
      },
      bootstrap: () => options.map(toItem),
    }),
    [options]
  )

  const commitTypedName = (raw) => {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) {
      onChange?.('')
      return
    }
    const exact = findExactMatch(options, trimmed)
    onChange?.(exact ? labelOf(exact) : trimmed)
  }

  useEffect(() => {
    if (!trimmedValue) setQuery('')
  }, [trimmedValue])

  return (
    <Typeahead
      label={label}
      searchSource={searchSource}
      value={selectedItem}
      onChange={(item) => {
        if (!item) {
          onChange?.('')
          return
        }
        if (item.id === FREE_OPTION_ID || item.company?.isFreeOption) {
          const name = String(item.company?.name || query).trim()
          onChange?.(name)
          return
        }
        onChange?.(item.label || labelOf(item.company) || '')
      }}
      onChangeQuery={handleQuery}
      onOpenChange={(isOpen) => {
        if (isOpen) return
        const pending = query.trim()
        if (!pending) return
        if (trimmedValue === pending) return
        commitTypedName(pending)
      }}
      hasEntriesOnFocus
      hasClear
      isRequired={isRequired}
      isDisabled={disabled}
      isLoading={isLoading}
      size="sm"
      width="100%"
      debounceMs={0}
      maxMenuItems={50}
      emptySearchResultsText="該当なし。名前を入力してそのまま使えます。"
      description="取引先マスタから選べます。該当がなければ入力した名前をそのまま使います。"
      status={status}
      renderItem={(item) => (
        <TypeaheadItem
          item={item}
          description={item.company?.isFreeOption ? 'マスタに追加せず登録' : undefined}
        />
      )}
    />
  )
}
