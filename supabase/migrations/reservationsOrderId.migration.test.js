import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_NAME = '20260925120000_reservations_order_id.sql'
const migrationPath = join(process.cwd(), 'supabase', 'migrations', MIGRATION_NAME)

describe('reservations.order_id migration', () => {
  it('adds a nullable FK to orders', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public\.orders\(id\) ON DELETE SET NULL/)
    expect(sql).toMatch(/reservations_order_id_idx/)
  })
})
