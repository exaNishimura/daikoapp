import { describe, expect, it } from 'vitest'
import {
  BANK_ACCOUNT_TYPES,
  COMPANY_PROFILE_FIELDS,
  EMPTY_COMPANY_PROFILE,
  normalizePostalCode,
  validateCompanyProfileForm,
} from './companyProfileForm'

const validForm = {
  name: 'チョロ急',
  postal_code: '513-0801',
  address: '三重県鈴鹿市算所1-2-3',
  invoice_number: 'T1234567890123',
  bank: '百五銀行',
  bank_branch: '鈴鹿支店',
  bank_account_type: '普通',
  bank_account_number: '1234567',
  bank_account_holder: 'チョロモン',
}

describe('BANK_ACCOUNT_TYPES', () => {
  it('exposes the canonical Japanese bank account types', () => {
    expect(BANK_ACCOUNT_TYPES).toEqual(['普通', '当座', '貯蓄'])
  })
})

describe('COMPANY_PROFILE_FIELDS and EMPTY_COMPANY_PROFILE', () => {
  it('covers all 9 fields required by design.md', () => {
    expect(COMPANY_PROFILE_FIELDS).toEqual([
      'name',
      'postal_code',
      'address',
      'invoice_number',
      'bank',
      'bank_branch',
      'bank_account_type',
      'bank_account_number',
      'bank_account_holder',
    ])
  })

  it('EMPTY_COMPANY_PROFILE has all fields with empty string defaults', () => {
    for (const field of COMPANY_PROFILE_FIELDS) {
      expect(EMPTY_COMPANY_PROFILE).toHaveProperty(field)
    }
    expect(EMPTY_COMPANY_PROFILE.bank_account_type).toBe('普通')
  })
})

describe('normalizePostalCode', () => {
  it('inserts hyphen for 7-digit input', () => {
    expect(normalizePostalCode('5130801')).toBe('513-0801')
  })

  it('keeps already-hyphenated 7-digit input', () => {
    expect(normalizePostalCode('513-0801')).toBe('513-0801')
  })

  it('converts full-width digits to half-width', () => {
    expect(normalizePostalCode('５１３－０８０１')).toBe('513-0801')
  })

  it('trims whitespace', () => {
    expect(normalizePostalCode('  513-0801  ')).toBe('513-0801')
  })

  it('returns input as-is when not a 7-digit pattern', () => {
    expect(normalizePostalCode('5130')).toBe('5130')
    expect(normalizePostalCode('not-a-zip')).toBe('not-a-zip')
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizePostalCode(null)).toBe('')
    expect(normalizePostalCode(undefined)).toBe('')
    expect(normalizePostalCode('')).toBe('')
  })
})

describe('validateCompanyProfileForm', () => {
  it('returns isValid=true for a fully filled form', () => {
    const result = validateCompanyProfileForm(validForm)
    expect(result.errors).toEqual({})
    expect(result.isValid).toBe(true)
  })

  it('flags missing required fields', () => {
    const result = validateCompanyProfileForm({ ...validForm, name: '' })
    expect(result.errors.name).toBeTruthy()
    expect(result.isValid).toBe(false)
  })

  it('treats whitespace-only as missing', () => {
    const result = validateCompanyProfileForm({ ...validForm, address: '   ' })
    expect(result.errors.address).toBeTruthy()
  })

  it('flags every missing field at once', () => {
    const result = validateCompanyProfileForm({})
    for (const field of COMPANY_PROFILE_FIELDS) {
      expect(result.errors[field]).toBeTruthy()
    }
  })

  it('rejects invalid postal_code format', () => {
    const result = validateCompanyProfileForm({ ...validForm, postal_code: '12-34' })
    expect(result.errors.postal_code).toBeTruthy()
  })

  it('accepts postal_code in normalized form 123-4567', () => {
    const result = validateCompanyProfileForm({ ...validForm, postal_code: '513-0801' })
    expect(result.errors.postal_code).toBeUndefined()
  })

  it('rejects bank_account_type outside enum', () => {
    const result = validateCompanyProfileForm({
      ...validForm,
      bank_account_type: '謎口座',
    })
    expect(result.errors.bank_account_type).toBeTruthy()
  })

  it('accepts each canonical bank_account_type', () => {
    for (const t of BANK_ACCOUNT_TYPES) {
      const result = validateCompanyProfileForm({ ...validForm, bank_account_type: t })
      expect(result.errors.bank_account_type).toBeUndefined()
    }
  })

  it('rejects bank_account_number containing non-digits', () => {
    const result = validateCompanyProfileForm({
      ...validForm,
      bank_account_number: '1234-567',
    })
    expect(result.errors.bank_account_number).toBeTruthy()
  })

  it('accepts purely numeric bank_account_number', () => {
    const result = validateCompanyProfileForm({
      ...validForm,
      bank_account_number: '0012345',
    })
    expect(result.errors.bank_account_number).toBeUndefined()
  })
})
