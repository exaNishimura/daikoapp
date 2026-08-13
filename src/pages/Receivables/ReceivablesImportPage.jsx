import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import ReplayIcon from '@mui/icons-material/Replay'

import { parseSalesWorkbook } from '@/lib/excel/parseSalesWorkbook'
import { findDuplicates } from '@/lib/billing/duplicateReceivables'
import { buildImportPlan } from '@/lib/billing/buildImportPlan'
import { useCompanies } from '@/hooks/billing/useCompanies'
import { useReceivables } from '@/hooks/billing/useReceivables'
import { useBulkImportReceivables } from '@/hooks/billing/useBulkImportReceivables'

import { ImportDropZone } from './ImportDropZone'
import { ImportPreviewTabs } from './ImportPreviewTabs'
import { UnknownCompanyResolver } from './UnknownCompanyResolver'
import { resolveCompanyMap } from '@/lib/billing/matchCompany'

const MODE = { SKIP: 'skip', OVERWRITE: 'overwrite', MERGE: 'merge' }

/**
 * Excel インポートページ。
 *
 * 流れ:
 *   1. ファイルをドロップ → parseSalesWorkbook
 *   2. 既存売掛との重複検出 (findDuplicates)
 *   3. 取引先マッピング決定 (UnknownCompanyResolver)
 *   4. 同月既存データがある場合の方針選択 (スキップ / 上書き / マージ)
 *   5. 保存 → bulk_import_receivables RPC
 */
export function ReceivablesImportPage() {
  const navigate = useNavigate()
  const companiesQuery = useCompanies()
  const importMutation = useBulkImportReceivables()

  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [mode, setMode] = useState(MODE.MERGE)
  const [result, setResult] = useState(null)
  const [runError, setRunError] = useState(null)

  const companies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data])

  // 既存売掛を当月分だけ引いて重複検出に使う。
  const existingReceivablesQuery = useReceivables(
    parsed?.period ? { year: parsed.period.year, month: parsed.period.month } : {}
  )
  const existingReceivables = useMemo(
    () => existingReceivablesQuery.data ?? [],
    [existingReceivablesQuery.data]
  )
  const hasExistingData = parsed?.period && existingReceivables.length > 0
  const hasInvoicedExisting = existingReceivables.some((r) => r.invoice_id != null)

  const companyMap = useMemo(() => {
    if (!parsed) return {}
    const names = Array.from(parsed.seenCompanies ?? [])
    return resolveCompanyMap({ companyNames: names, companies, decisions })
  }, [parsed, companies, decisions])

  const receivablesAnnotated = useMemo(() => {
    if (!parsed) return []
    // 既存売掛と重複判定するためには company_id が必要。マップ済みのみ照合。
    const period = parsed.period
      ? `${parsed.period.year}-${String(parsed.period.month).padStart(2, '0')}-01`
      : null
    const incoming = parsed.receivables.map((r) => ({
      ...r,
      billing_month: period,
      company_id: companyMap[r.companyName] ?? null,
      work_date:
        r.workDate instanceof Date
          ? `${r.workDate.getUTCFullYear()}-${String(r.workDate.getUTCMonth() + 1).padStart(2, '0')}-${String(r.workDate.getUTCDate()).padStart(2, '0')}`
          : null,
    }))
    return findDuplicates(incoming, existingReceivables)
  }, [parsed, companyMap, existingReceivables])

  const unmatchedNames = useMemo(() => {
    if (!parsed) return []
    const names = Array.from(parsed.seenCompanies ?? [])
    return names.filter((n) => companyMap[n] == null && decisions[n] !== 'skip')
  }, [parsed, companyMap, decisions])

  const handleFile = async (f) => {
    setFile(f)
    setParseError(null)
    setParsed(null)
    setResult(null)
    setDecisions({})

    try {
      const buf = await f.arrayBuffer()
      const r = parseSalesWorkbook(buf, f.name)
      if (r.period == null) {
        setParseError(
          r.errors.find((e) => e.field === 'fileName')?.message ??
            'ファイル名から年月を抽出できません'
        )
        return
      }
      setParsed(r)
    } catch (err) {
      setParseError(`パース失敗: ${err.message}`)
    }
  }

  const handleReset = () => {
    setFile(null)
    setParsed(null)
    setParseError(null)
    setDecisions({})
    setResult(null)
    setRunError(null)
  }

  const handleRun = async () => {
    setRunError(null)
    setResult(null)

    if (hasInvoicedExisting && mode === MODE.OVERWRITE) {
      setRunError('当月に請求書発行済みの売掛が含まれます。先に該当請求書を取消してください。')
      return
    }
    if (unmatchedNames.length > 0) {
      setRunError(
        `未マッピングの取引先が ${unmatchedNames.length} 件あります。対応方法を選択してください。`
      )
      return
    }

    try {
      // 重複は client 側で確定。duplicate=true の行を Set 化して plan から除外。
      const dupKeys = new Set(
        receivablesAnnotated
          .filter((r) => r.duplicate)
          .map(
            (r) =>
              `${r.billing_month}|${r.company_id ?? 0}|${r.work_date}|${(r.departure ?? '').trim()}|${(r.destination ?? '').trim()}|${Number(r.amount) || 0}`
          )
      )

      const plan = buildImportPlan(parsed, {
        companyMap,
        duplicates: mode === MODE.MERGE ? dupKeys : new Set(),
        // 上書きモードは既存全削除→新規挿入なので重複除外不要
      })

      const out = await importMutation.mutateAsync({
        period: plan.period,
        source_file: plan.source_file,
        overwrite: mode === MODE.OVERWRITE,
        daily_sales: plan.daily_sales,
        staff_sales: plan.staff_sales,
        receivables: plan.receivables,
        fixed_expenses: plan.fixed_expenses,
      })

      setResult({ rpc: out, plan })
    } catch (err) {
      setRunError(err.message)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Excel インポート</Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>初期データ移行・運用復旧用</AlertTitle>
        このページは <strong>過去データの移行・運用復旧</strong> 用です。 日々の運用は{' '}
        <a href="/admin/receivables">売掛画面</a> から直接入力してください。
      </Alert>

      {!parsed && !parseError && (
        <ImportDropZone onFile={handleFile} disabled={importMutation.isPending} />
      )}

      {parseError && (
        <Alert severity="error" action={<Button onClick={handleReset}>もう一度</Button>}>
          {parseError}
        </Alert>
      )}

      {parsed && (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body1">
                <strong>{file.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {parsed.period.year} 年 {parsed.period.month} 月
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button startIcon={<ReplayIcon />} onClick={handleReset}>
                やり直し
              </Button>
            </Box>
          </Paper>

          {parsed.errors.length > 0 && (
            <Alert severity="warning">
              <AlertTitle>パースエラー {parsed.errors.length} 件</AlertTitle>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {parsed.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    [{e.sheet} L{e.row} / {e.field}] {e.message}
                  </li>
                ))}
                {parsed.errors.length > 5 && <li>…他 {parsed.errors.length - 5} 件</li>}
              </ul>
              エラー行はインポートされません。
            </Alert>
          )}

          <UnknownCompanyResolver
            companyNames={Array.from(parsed.seenCompanies ?? [])}
            companies={companies}
            decisions={decisions}
            onChange={(name, d) =>
              setDecisions((prev) => {
                const next = { ...prev }
                if (d === undefined) delete next[name]
                else next[name] = d
                return next
              })
            }
          />

          {hasExistingData && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                同月既存データの扱い
              </Typography>
              <Alert severity={hasInvoicedExisting ? 'error' : 'info'} sx={{ mb: 1 }}>
                {parsed.period.year} 年 {parsed.period.month} 月の売掛が{' '}
                <strong>{existingReceivables.length}</strong> 件既に登録されています
                {hasInvoicedExisting && '（うち請求書発行済みあり）'}
              </Alert>
              <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
                <FormControlLabel
                  value={MODE.MERGE}
                  control={<Radio />}
                  label="マージ（重複を除いて追加挿入。既存は残す）"
                />
                <FormControlLabel
                  value={MODE.OVERWRITE}
                  control={<Radio disabled={hasInvoicedExisting} />}
                  label={
                    hasInvoicedExisting
                      ? '上書き（請求書発行済みがあるため不可）'
                      : '上書き（同月の既存データを削除してから挿入）'
                  }
                />
                <FormControlLabel
                  value={MODE.SKIP}
                  control={<Radio />}
                  label="スキップ（既存があるため取り込まない）"
                />
              </RadioGroup>
            </Paper>
          )}

          <ImportPreviewTabs parsed={parsed} receivablesAnnotated={receivablesAnnotated} />

          {runError && (
            <Alert severity="error" onClose={() => setRunError(null)}>
              {runError}
            </Alert>
          )}
          {result && (
            <Alert severity="success">
              <AlertTitle>インポート完了</AlertTitle>
              挿入: daily_sales {result.rpc.inserted?.daily_sales ?? 0} / staff_sales{' '}
              {result.rpc.inserted?.staff_sales ?? 0} / receivables{' '}
              {result.rpc.inserted?.receivables ?? 0} / fixed_expenses{' '}
              {result.rpc.inserted?.fixed_expenses ?? 0}
              {result.rpc.overwrite && (
                <> · 上書き削除: receivables {result.rpc.deleted?.receivables ?? 0} 件</>
              )}
              {result.plan.duplicate_count > 0 && (
                <> · 重複スキップ: {result.plan.duplicate_count} 件</>
              )}
              {result.plan.skipped_receivables > 0 && (
                <> · マッピング未解決スキップ: {result.plan.skipped_receivables} 件</>
              )}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={
                importMutation.isPending ? <CircularProgress size={16} /> : <SaveAltIcon />
              }
              disabled={importMutation.isPending || mode === MODE.SKIP || unmatchedNames.length > 0}
              onClick={handleRun}
            >
              {importMutation.isPending ? '取り込み中…' : 'この内容で保存'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  )
}
