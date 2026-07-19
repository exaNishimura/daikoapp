import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_NAME = '20260719160000_reservation_ledger.sql'
const migrationPath = join(process.cwd(), 'supabase', 'migrations', MIGRATION_NAME)

describe('reservation-ledger migration (1.1)', () => {
  it('マイグレーションファイルが存在する', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('reservations と reservation_day_notifications のスキーマ・RLSを含む', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.reservations/)
    expect(sql).toMatch(/reserved_at\s+TIMESTAMPTZ\s+NOT NULL/i)
    expect(sql).toMatch(/customer_name\s+TEXT\s+NOT NULL/i)
    expect(sql).toMatch(/phone\s+TEXT\s+NOT NULL/i)
    expect(sql).toMatch(/memo\s+TEXT\s+NOT NULL\s+DEFAULT ''/i)

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.reservation_day_notifications/)
    expect(sql).toMatch(/notify_date\s+DATE\s+PRIMARY KEY/i)
    expect(sql).toMatch(/skipped\s+BOOLEAN\s+NOT NULL\s+DEFAULT false/i)

    expect(sql).toMatch(/reservations_reserved_at_idx/)
    expect(sql).toMatch(/reservations_customer_name_idx/)
    expect(sql).toMatch(/reservations_phone_idx/)

    expect(sql).toMatch(/update_updated_at_column/)
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/POLICY "public_read" ON public\.reservations/)
    expect(sql).toMatch(/POLICY "authenticated_write" ON public\.reservations/)
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY[\s\S]*reservation_day_notifications/)

    // 配車テーブルへの結合は作らない
    expect(sql).not.toMatch(/REFERENCES public\.orders/i)
    expect(sql).not.toMatch(/REFERENCES public\.dispatch_slots/i)
  })
})

describe('reservations anon write migration', () => {
  const anonPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260719180000_reservations_anon_write.sql'
  )

  it('anon 書き込みポリシーを含む', () => {
    expect(existsSync(anonPath)).toBe(true)
    const sql = readFileSync(anonPath, 'utf8')
    expect(sql).toMatch(/POLICY "public_write" ON public\.reservations/)
    expect(sql).toMatch(/TO anon, authenticated/)
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.reservations TO anon/)
  })
})
