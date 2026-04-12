export function validateAmount(value: string | number): string | null {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value
  if (isNaN(n) || n <= 0) return 'Valor deve ser maior que zero'
  if (n > 10_000_000)     return 'Valor muito alto'
  return null
}

export function validateDescription(value: string): string | null {
  if (!value.trim())          return 'Descrição é obrigatória'
  if (value.trim().length < 2) return 'Descrição muito curta'
  if (value.length > 200)     return 'Descrição muito longa (máx 200)'
  return null
}

export function validateDate(value: string): string | null {
  if (!value) return 'Data é obrigatória'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Formato inválido (YYYY-MM-DD)'
  return null
}

export function validateDay(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 28) return 'Dia deve ser entre 1 e 28'
  return null
}

export function validateName(value: string): string | null {
  if (!value.trim())           return 'Nome é obrigatório'
  if (value.trim().length < 2) return 'Nome muito curto'
  return null
}
