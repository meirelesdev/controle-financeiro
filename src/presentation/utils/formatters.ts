const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const LONG_DATE  = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export function formatCurrency(value: number): string {
  return BRL.format(value)
}

export function formatShortDate(isoDate: string): string {
  return SHORT_DATE.format(new Date(isoDate + 'T12:00:00'))
}

export function formatLongDate(isoDate: string): string {
  return LONG_DATE.format(new Date(isoDate + 'T12:00:00'))
}

export function formatMonthYear(year: number, month: number): string {
  return MONTH_YEAR.format(new Date(year, month - 1, 1))
}

export function formatMonthShort(month: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2024, month - 1, 1))
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}
