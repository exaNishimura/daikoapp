import * as XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/analyze-excel.mjs <file1.xlsx> [file2.xlsx ...]')
  process.exit(1)
}

for (const filePath of args) {
  const abs = path.resolve(filePath)
  console.log('\n========================================')
  console.log('FILE:', abs)
  console.log('========================================')

  const buf = fs.readFileSync(abs)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })

  console.log('\nSHEETS:', wb.SheetNames)

  for (const name of wb.SheetNames) {
    console.log('\n----- SHEET:', JSON.stringify(name), '-----')
    const ws = wb.Sheets[name]
    const ref = ws['!ref']
    console.log('range:', ref)
    if (!ref) continue

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })
    console.log('rows:', aoa.length)
    aoa.forEach((row, i) => {
      const trimmed = (row || []).map((v) => (v === null || v === undefined ? '' : String(v)))
      while (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop()
      console.log(`  [${i}]`, JSON.stringify(trimmed))
    })

    const merges = ws['!merges']
    if (merges && merges.length) {
      console.log('merges:', merges.length, 'first 10:', merges.slice(0, 10))
    }
  }
}
