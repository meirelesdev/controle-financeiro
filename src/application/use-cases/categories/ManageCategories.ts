import { getDB } from '../../../infrastructure/database/DatabaseHelper'
import { getCategoriesForType, type CategoryDef } from '../../../domain/constants/Categories'

const SETTINGS_KEY = 'custom_categories'

interface CustomCategoryStore {
  income:  CategoryDef[]
  expense: CategoryDef[]
}

export async function getCustomCategories(): Promise<CustomCategoryStore> {
  const db  = await getDB()
  const row = await db.get('settings', SETTINGS_KEY)
  return (row?.value as CustomCategoryStore) ?? { income: [], expense: [] }
}

export async function saveCustomCategories(data: CustomCategoryStore): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: SETTINGS_KEY, value: data })
}

export async function addCustomCategory(
  label: string,
  emoji: string,
  type: 'income' | 'expense'
): Promise<CategoryDef> {
  const data   = await getCustomCategories()
  const newCat: CategoryDef = {
    id:    `custom_${Date.now()}`,
    label: label.trim(),
    emoji: emoji.trim() || '📌',
    type,
  }
  data[type].push(newCat)
  await saveCustomCategories(data)
  return newCat
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const data = await getCustomCategories()
  data.income  = data.income.filter(c => c.id !== id)
  data.expense = data.expense.filter(c => c.id !== id)
  await saveCustomCategories(data)
}

/** Retorna categorias base (fixas) + personalizadas do usuário para o tipo dado. */
export async function getEffectiveCategories(type: 'income' | 'expense'): Promise<CategoryDef[]> {
  const custom = await getCustomCategories()
  return [...getCategoriesForType(type), ...custom[type]]
}
