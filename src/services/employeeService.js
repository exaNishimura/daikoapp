import { supabase } from '@/lib/supabase'

/**
 * スタッフ名の変更を売上関連テーブルへ反映（シフトは employee_id で連携）
 */
export async function renameStaffReferences(oldName, newName) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  const oldN = typeof oldName === 'string' ? oldName.trim() : ''
  const newN = typeof newName === 'string' ? newName.trim() : ''
  if (!oldN || !newN || oldN === newN) {
    return { data: { updated: 0 }, error: null }
  }

  try {
    const { error: staffSalesError } = await supabase
      .from('daily_staff_sales')
      .update({ staff_name: newN })
      .eq('staff_name', oldN)

    if (staffSalesError) {
      console.error('Error renaming daily_staff_sales staff_name:', staffSalesError)
    }

    const { error: staffRatesError } = await supabase
      .from('staff_rates')
      .update({ staff_name: newN })
      .eq('staff_name', oldN)

    if (staffRatesError) {
      console.error('Error renaming staff_rates staff_name:', staffRatesError)
    }

    return { data: { updated: 1 }, error: null }
  } catch (error) {
    console.error('Error renaming staff references:', error)
    return { data: null, error }
  }
}

/**
 * 従業員一覧を取得
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getEmployees() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching employees:', error)
    return { data: null, error }
  }
}

/**
 * アクティブな従業員一覧を取得
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getActiveEmployees() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching active employees:', error)
    return { data: null, error }
  }
}

/**
 * 従業員を作成
 * @param {Object} employeeData - 従業員データ
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createEmployee(employeeData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase.from('employees').insert(employeeData).select().single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating employee:', error)
    return { data: null, error }
  }
}

/**
 * 従業員を更新
 * @param {string} id - 従業員ID
 * @param {Object} employeeData - 更新する従業員データ
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateEmployee(id, employeeData, options = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  const { legacyStaffName } = options

  try {
    const { data: current, error: currentError } = await supabase
      .from('employees')
      .select('name')
      .eq('id', id)
      .single()

    if (currentError) throw currentError

    const { data, error } = await supabase
      .from('employees')
      .update(employeeData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const oldName = current?.name?.trim()
    const newName = (employeeData?.name ?? data?.name)?.trim()

    if (oldName && newName && oldName !== newName) {
      const { error: renameError } = await renameStaffReferences(oldName, newName)
      if (renameError) throw renameError
    }

    const legacy = typeof legacyStaffName === 'string' ? legacyStaffName.trim() : ''
    if (legacy && newName && legacy !== newName) {
      const { error: legacyRenameError } = await renameStaffReferences(legacy, newName)
      if (legacyRenameError) throw legacyRenameError
    }

    if (newName) {
      const { error: staffSyncError } = await supabase
        .from('shifts')
        .update({ staff: newName })
        .eq('employee_id', id)

      if (staffSyncError) {
        console.error('Error syncing shift staff snapshot:', staffSyncError)
      }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating employee:', error)
    return { data: null, error }
  }
}

/**
 * 従業員を削除
 * @param {string} id - 従業員ID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function deleteEmployee(id) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase.from('employees').delete().eq('id', id).select().single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting employee:', error)
    return { data: null, error }
  }
}
