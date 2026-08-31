import { useMemo } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { matchCompany, findCandidateCompanies } from '@/lib/billing/matchCompany'

/**
 * 売掛シートの企業名 ↔ companies.id のマッピングを決定するパネル。
 *
 * - 自動マッチ (name / alias / display_name 完全一致) は読み取り専用で表示
 * - 未マッチは Selector で 3 択
 *     - 既存企業に統合 (候補リストから選択)
 *     - 新規企業として追加 (= 新規 id をモーダル外で割り当て、ここでは "new" マーカー)
 *     - スキップ
 *
 * @param {Object} props
 * @param {string[]} props.companyNames  パース結果の (重複除去済) 企業名一覧
 * @param {Array} props.companies        既存 companies マスタ
 * @param {Object} props.decisions       { [companyName]: 'skip' | { companyId } | 'new' }
 * @param {(name: string, decision: any) => void} props.onChange
 */
export function UnknownCompanyResolver({ companyNames, companies, decisions, onChange }) {
  const matchedMap = useMemo(() => {
    const map = new Map()
    for (const name of companyNames ?? []) {
      const m = matchCompany(name, companies ?? [])
      map.set(name, m)
    }
    return map
  }, [companyNames, companies])

  const matchedCount = Array.from(matchedMap.values()).filter((m) => m?.matched).length
  const unmatchedNames = (companyNames ?? []).filter((n) => !matchedMap.get(n)?.matched)

  if (!companyNames || companyNames.length === 0) {
    return <Banner status="info" title="マッピング対象の企業がありません" collapsible={false} />
  }

  const totalToResolve = unmatchedNames.length
  const resolvedCount = unmatchedNames.filter((n) => decisions[n] !== undefined).length
  const allResolved = totalToResolve === 0 || resolvedCount === totalToResolve

  return (
    <Card padding={3}>
      <VStack gap={2}>
        <Heading level={3}>取引先マッピング</Heading>
        <Banner
          status={allResolved ? 'success' : 'warning'}
          title={`自動マッチ: ${matchedCount} / ${companyNames.length}${
            totalToResolve > 0 ? ` · 要解決: ${totalToResolve - resolvedCount} 件` : ''
          }`}
          collapsible={false}
        />

        <Table density="compact" hasHover>
          <TableHeader>
            <TableRow isHeaderRow>
              <TableHeaderCell>Excel 上の企業名</TableHeaderCell>
              <TableHeaderCell>マッチ結果</TableHeaderCell>
              <TableHeaderCell>対応</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(companyNames ?? []).map((name) => {
              const m = matchedMap.get(name)
              const matched = m?.matched
              const current = decisions[name]
              const candidates = findCandidateCompanies(name, companies ?? [])
              const selectorValue =
                current === 'skip'
                  ? 'skip'
                  : current === 'new'
                    ? 'new'
                    : current?.companyId
                      ? `id:${current.companyId}`
                      : undefined

              return (
                <TableRow
                  key={name}
                  style={
                    matched ? undefined : { backgroundColor: 'var(--color-background-yellow)' }
                  }
                >
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {matched ? (
                      <Text style={{ color: 'var(--color-text-green)' }}>
                        ✓ {m.company.invoice_display_name || m.company.name} ({m.kind})
                      </Text>
                    ) : (
                      <Text size="sm" color="secondary">
                        未マッチ (候補 {candidates.length} 件)
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    {matched ? (
                      <Text size="sm" color="secondary">
                        自動マッチ
                      </Text>
                    ) : (
                      <Selector
                        label={`${name} の対応`}
                        isLabelHidden
                        placeholder="選択してください"
                        size="sm"
                        width="100%"
                        value={selectorValue}
                        onChange={(v) => {
                          if (v === 'skip') onChange(name, 'skip')
                          else if (v === 'new') onChange(name, 'new')
                          else if (typeof v === 'string' && v.startsWith('id:')) {
                            onChange(name, { companyId: Number(v.slice(3)) })
                          } else {
                            onChange(name, undefined)
                          }
                        }}
                        options={[
                          { value: 'skip', label: 'スキップ (取り込まない)' },
                          {
                            value: 'new',
                            label: '新規企業として追加 (取引先マスタから先に追加)',
                            disabled: true,
                          },
                          ...candidates.map((c) => ({
                            value: `id:${c.id}`,
                            label: `${c.invoice_display_name || c.name} に統合`,
                          })),
                          ...(candidates.length === 0
                            ? [
                                {
                                  value: 'none',
                                  label: '(候補なし - スキップを選択)',
                                  disabled: true,
                                },
                              ]
                            : []),
                        ]}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </VStack>
    </Card>
  )
}
