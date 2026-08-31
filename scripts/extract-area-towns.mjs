import fs from 'node:fs'
import path from 'node:path'

const CSV_PATH =
  process.env.KEN_ALL_CSV ||
  'C:/Users/Rikiya Nishimura/AppData/Local/Temp/jp_zip_utf/utf_ken_all.csv'

const TARGET_CITIES = ['鈴鹿市', '亀山市', '四日市市', '津市']
const SKIP_TOWN = /以下に掲載がない場合|の次に番地がくる場合/

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQ = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function normalizeTown(town) {
  if (!town) return ''
  let t = town.trim()
  t = t.replace(/（[^）]*$/, '')
  t = t.replace(/（.*?）/g, '')
  t = t.replace(/\(.*?\)/g, '')
  t = t.replace(/　/g, '').trim()
  t = t.replace(/^大字/, '')
  return t
}

function zipHyphen(zip) {
  const d = String(zip || '').replace(/\D/g, '')
  if (d.length !== 7) return d
  return `${d.slice(0, 3)}-${d.slice(3)}`
}

const raw = fs.readFileSync(CSV_PATH, 'utf8')
const lines = raw.split(/\r?\n/).filter(Boolean)

const byCity = new Map(TARGET_CITIES.map((c) => [c, new Map()]))
let matchingRows = 0

for (const line of lines) {
  const cols = parseCsvLine(line)
  const pref = cols[6]
  const city = cols[7]
  const town = cols[8]
  const zip = String(cols[2] || '').replace(/\s/g, '')
  const kana = cols[5] || ''
  if (pref !== '三重県' || !byCity.has(city)) continue
  matchingRows++
  if (SKIP_TOWN.test(town)) continue
  const name = normalizeTown(town)
  if (!name || SKIP_TOWN.test(name)) continue
  const map = byCity.get(city)
  if (!map.has(name)) {
    map.set(name, {
      name,
      kana: SKIP_TOWN.test(kana) ? '' : kana,
      zips: new Set(),
      raws: new Set(),
    })
  }
  const rec = map.get(name)
  rec.zips.add(zip)
  rec.raws.add(town)
}

const extracted = {
  source: '日本郵便 utf_ken_all.csv',
  updatedAt: '2026-08-31',
  prefecture: '三重県',
  cities: {},
}

for (const city of TARGET_CITIES) {
  const towns = [...byCity.get(city).values()]
    .map((t) => ({
      name: t.name,
      kana: t.kana,
      zip: zipHyphen([...t.zips].sort()[0]),
      zipCount: t.zips.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  extracted.cities[city] = towns
  console.log(`${city}: ${towns.length} towns`)
}
console.log('raw matching rows', matchingRows)

const outDir = path.resolve('src/data')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'areaTowns.json'), JSON.stringify(extracted, null, 2), 'utf8')

const mdLines = []
mdLines.push('# 営業エリア町名一覧（鈴鹿・亀山・四日市・津）')
mdLines.push('')
mdLines.push('依頼を取る際の想定所要時間を把握するため、日本郵便の郵便番号データ（utf_ken_all.csv / 2026年8月31日更新）から、三重県の対象4市の町域名を抽出した。')
mdLines.push('')
mdLines.push('## 抽出ルール')
mdLines.push('')
mdLines.push('- 出典: [日本郵便 郵便番号データ（UTF-8・1レコード1行）](https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html)')
mdLines.push('- 対象市区町村: 鈴鹿市 / 亀山市 / 四日市市 / 津市')
mdLines.push('- 「以下に掲載がない場合」など町名ではないレコードは除外')
mdLines.push('- 括弧書きの注記（ビルを除く、次の丁目、など）は除去')
mdLines.push('- 先頭の「大字」は町名として扱うため除去')
mdLines.push('- 同一町名は1件にまとめ、代表郵便番号は番号順の先頭')
mdLines.push('')
mdLines.push('## 件数')
mdLines.push('')
mdLines.push('| 市 | 町名数 |')
mdLines.push('| --- | ---: |')
for (const city of TARGET_CITIES) {
  mdLines.push(`| ${city} | ${extracted.cities[city].length} |`)
}
mdLines.push(`| 合計 | ${TARGET_CITIES.reduce((s, c) => s + extracted.cities[c].length, 0)} |`)
mdLines.push('')

for (const city of TARGET_CITIES) {
  const towns = extracted.cities[city]
  mdLines.push(`## ${city}（${towns.length}件）`)
  mdLines.push('')
  mdLines.push('| 町名 | 代表郵便番号 | 郵便番号数 |')
  mdLines.push('| --- | --- | ---: |')
  for (const t of towns) {
    mdLines.push(`| ${t.name} | ${t.zip} | ${t.zipCount} |`)
  }
  mdLines.push('')
}

const docsDir = path.resolve('docs')
fs.mkdirSync(docsDir, { recursive: true })
fs.writeFileSync(path.join(docsDir, 'area-towns.md'), mdLines.join('\n'), 'utf8')
console.log('wrote src/data/areaTowns.json and docs/area-towns.md')
