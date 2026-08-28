import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { List, ListItem } from '@astryxdesign/core/List'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Text } from '@astryxdesign/core/Text'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { parseSalesWorkbook } from '@/lib/excel/parseSalesWorkbook'
import { findDuplicates } from '@/lib/billing/duplicateReceivables'
import { buildImportPlan } from '@/lib/billing/buildImportPlan'
import { useCompanies } from '@/hooks/billing/useCompanies'
import { useReceivables } from '@/hooks/billing/useReceivables'
import { useBulkImportReceivables } from '@/hooks/billing/useBulkImportReceivables'
import { resolveCompanyMap } from '@/lib/billing/matchCompany'
import { ImportDropZone } from './ImportDropZone'
import { ImportPreviewTabs } from './ImportPreviewTabs'
import { UnknownCompanyResolver } from './UnknownCompanyResolver'

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
    <PageFrame>
      <VStack gap={4}>
        <HStack gap={2} vAlign="center">
          <IconButton
            label="戻る"
            icon={<ArrowLeft />}
            variant="ghost"
            onClick={() => navigate(-1)}
          />
          <Heading level={1}>Excel インポート</Heading>
        </HStack>

        <Banner
          status="warning"
          title="初期データ移行・運用復旧用"
          description={
            <>
              このページは過去データの移行・運用復旧用です。日々の運用は
              <Link href="/admin/receivables">売掛画面</Link>
              から直接入力してください。
            </>
          }
          collapsible={false}
        />

        {!parsed && !parseError ? (
          <ImportDropZone onFile={handleFile} disabled={importMutation.isPending} />
        ) : null}

        {parseError ? (
          <Banner
            status="error"
            title={parseError}
            endContent={<Button label="もう一度" variant="secondary" onClick={handleReset} />}
            collapsible={false}
          />
        ) : null}

        {parsed ? (
          <VStack gap={3}>
            <Card padding={3}>
              <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
                <HStack gap={2} wrap="wrap" vAlign="center">
                  <Text weight="semibold">{file.name}</Text>
                  <Text color="secondary">
                    {parsed.period.year} 年 {parsed.period.month} 月
                  </Text>
                </HStack>
                <Button
                  variant="secondary"
                  icon={<RefreshCw />}
                  label="やり直し"
                  onClick={handleReset}
                />
              </HStack>
            </Card>

            {parsed.errors.length > 0 ? (
              <Banner
                status="warning"
                title={`パースエラー ${parsed.errors.length} 件`}
                description="エラー行はインポートされません。"
                collapsible={false}
              >
                <List>
                  {parsed.errors.slice(0, 5).map((e, i) => (
                    <ListItem
                      key={i}
                      label={`[${e.sheet} L${e.row} / ${e.field}] ${e.message}`}
                    />
                  ))}
                  {parsed.errors.length > 5 ? (
                    <ListItem label={`…他 ${parsed.errors.length - 5} 件`} />
                  ) : null}
                </List>
              </Banner>
            ) : null}

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

            {hasExistingData ? (
              <Card padding={3}>
                <VStack gap={2}>
                  <Heading level={3}>同月既存データの扱い</Heading>
                  <Banner
                    status={hasInvoicedExisting ? 'error' : 'info'}
                    title={`${parsed.period.year} 年 ${parsed.period.month} 月の売掛が ${existingReceivables.length} 件既に登録されています${hasInvoicedExisting ? '（うち請求書発行済みあり）' : ''}`}
                    collapsible={false}
                  />
                  <RadioList
                    label="同月既存データの扱い"
                    value={mode}
                    onChange={setMode}
                  >
                    <RadioListItem
                      value={MODE.MERGE}
                      label="マージ（重複を除いて追加挿入。既存は残す）"
                    />
                    <RadioListItem
                      value={MODE.OVERWRITE}
                      label={
                        hasInvoicedExisting
                          ? '上書き（請求書発行済みがあるため不可）'
                          : '上書き（同月の既存データを削除してから挿入）'
                      }
                      isDisabled={hasInvoicedExisting}
                    />
                    <RadioListItem
                      value={MODE.SKIP}
                      label="スキップ（既存があるため取り込まない）"
                    />
                  </RadioList>
                </VStack>
              </Card>
            ) : null}

            <ImportPreviewTabs parsed={parsed} receivablesAnnotated={receivablesAnnotated} />

            {runError ? (
              <Banner
                status="error"
                title={runError}
                isDismissable
                onDismiss={() => setRunError(null)}
                collapsible={false}
              />
            ) : null}
            {result ? (
              <Banner
                status="success"
                title="インポート完了"
                description={[
                  `挿入: daily_sales ${result.rpc.inserted?.daily_sales ?? 0} / staff_sales ${result.rpc.inserted?.staff_sales ?? 0} / receivables ${result.rpc.inserted?.receivables ?? 0} / fixed_expenses ${result.rpc.inserted?.fixed_expenses ?? 0}`,
                  result.rpc.overwrite
                    ? `上書き削除: receivables ${result.rpc.deleted?.receivables ?? 0} 件`
                    : null,
                  result.plan.duplicate_count > 0
                    ? `重複スキップ: ${result.plan.duplicate_count} 件`
                    : null,
                  result.plan.skipped_receivables > 0
                    ? `マッピング未解決スキップ: ${result.plan.skipped_receivables} 件`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                collapsible={false}
              />
            ) : null}

            <HStack hAlign="end">
              <Button
                variant="primary"
                icon={<Download />}
                label={importMutation.isPending ? '取り込み中…' : 'この内容で保存'}
                isDisabled={
                  importMutation.isPending || mode === MODE.SKIP || unmatchedNames.length > 0
                }
                isLoading={importMutation.isPending}
                onClick={handleRun}
              />
            </HStack>
          </VStack>
        ) : null}
      </VStack>
    </PageFrame>
  )
}
