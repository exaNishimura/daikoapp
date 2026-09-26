import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_NAME = '20260926120000_company_profile_operating_hours.sql'
const migrationPath = join(process.cwd(), 'supabase', 'migrations', MIGRATION_NAME)

describe('company_profile operating hours migration', () => {
  it('adds reservation and business start hours with 19/20 defaults', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/reservation_start_hour SMALLINT NOT NULL DEFAULT 19/)
    expect(sql).toMatch(/business_start_hour SMALLINT NOT NULL DEFAULT 20/)
    expect(sql).toMatch(/reservation_start_hour BETWEEN 7 AND 23/)
    expect(sql).toMatch(/business_start_hour BETWEEN 7 AND 23/)
  })
})
