import { supabase } from '@/lib/supabase'

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
    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single()

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
export async function updateEmployee(id, employeeData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .update(employeeData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
    const { data, error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting employee:', error)
    return { data: null, error }
  }
}
