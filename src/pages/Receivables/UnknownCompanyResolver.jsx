import { useMemo } from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import { matchCompany, findCandidateCompanies } from '@/lib/billing/matchCompany'

/**
 * 売掛シートの企業名 ↔ companies.id のマッピングを決定するパネル。
 *
 * - 自動マッチ (name / alias / display_name 完全一致) は読み取り専用で表示
 * - 未マッチは Select で 3 択
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
    return <Alert severity="info">マッピング対象の企業がありません</Alert>
  }

  const totalToResolve = unmatchedNames.length
  const resolvedCount = unmatchedNames.filter((n) => decisions[n] !== undefined).length

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        取引先マッピング
      </Typography>
      <Alert severity={totalToResolve === 0 || resolvedCount === totalToResolve ? 'success' : 'warning'} sx={{ mb: 2 }}>
        自動マッチ: {matchedCount} / {companyNames.length}
        {totalToResolve > 0 && ` · 要解決: ${totalToResolve - resolvedCount} 件`}
      </Alert>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Excel 上の企業名</TableCell>
              <TableCell>マッチ結果</TableCell>
              <TableCell>対応</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(companyNames ?? []).map((name) => {
              const m = matchedMap.get(name)
              const matched = m?.matched
              const current = decisions[name]
              return (
                <TableRow key={name} sx={{ bgcolor: matched ? undefined : 'warning.50' }}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {matched ? (
                      <Typography variant="body2" color="success.main">
                        ✓ {m.company.invoice_display_name || m.company.name} ({m.kind})
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        未マッチ (候補 {findCandidateCompanies(name, companies ?? []).length} 件)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {matched ? (
                      <Typography variant="caption" color="text.secondary">
                        自動マッチ
                      </Typography>
                    ) : (
                      <FormControl size="small" fullWidth>
                        <Select
                          value={
                            current === 'skip'
                              ? 'skip'
                              : current === 'new'
                                ? 'new'
                                : current?.companyId
                                  ? `id:${current.companyId}`
                                  : ''
                          }
                          displayEmpty
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === 'skip') onChange(name, 'skip')
                            else if (v === 'new') onChange(name, 'new')
                            else if (typeof v === 'string' && v.startsWith('id:')) {
                              onChange(name, { companyId: Number(v.slice(3)) })
                            } else {
                              onChange(name, undefined)
                            }
                          }}
                        >
                          <MenuItem value="" disabled>
                            選択してください
                          </MenuItem>
                          <MenuItem value="skip">スキップ (取り込まない)</MenuItem>
                          <MenuItem value="new" disabled>
                            新規企業として追加 (取引先マスタから先に追加)
                          </MenuItem>
                          {findCandidateCompanies(name, companies ?? []).map((c) => (
                            <MenuItem key={c.id} value={`id:${c.id}`}>
                              {c.invoice_display_name || c.name} に統合
                            </MenuItem>
                          ))}
                          {findCandidateCompanies(name, companies ?? []).length === 0 && (
                            <MenuItem disabled>(候補なし - スキップを選択)</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

