import type { Transaction } from '../entities/Transaction'
import type { CreditCard }  from '../entities/CreditCard'
import type { Account }     from '../entities/Account'
import type { Savings }     from '../entities/Savings'

export interface MonthlySummary {
  totalIncome:    number
  totalExpense:   number
  saldoReal:      number       // confirmado + pago
  saldoProjetado: number       // confirmado + pago + pendente
  /** Saldo acumulado de todos os meses anteriores (carryover) */
  openingBalance: number
  /** saldoProjetado + openingBalance */
  saldoAcumulado: number
  byCategory:     Record<string, number>
  pendingCount:   number
}

export interface MonthlyHistory {
  year:         number
  month:        number
  totalIncome:  number
  totalExpense: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna true se a transação é considerada efetivada (afeta o saldo real). */
export function isSettled(t: Transaction): boolean {
  return t.status === 'confirmado' || t.status === 'pago'
}

// ─── Selectors (padrão Redux-like: derivam estado da lista de transações) ────

/**
 * Selector: saldo de uma conta bancária por event sourcing.
 *  – initialBalance
 *  + Σ receitas onde accountId===id AND status in {confirmado,pago}
 *  − Σ despesas onde accountId===id AND status === 'pago'
 *  + Σ saldos dos cofrinhos vinculados (passados como parâmetro opcional)
 */
export function selectAccountBalance(
  account: Account,
  transactions: Transaction[],
  linkedSavings: Savings[] = []
): number {
  const txBalance = transactions
    .filter(t => t.accountId === account.id && t.type !== 'transfer')
    .reduce((sum, t) => {
      if (t.type === 'income' && isSettled(t))  return sum + t.amount
      if (t.type === 'expense' && t.status === 'pago') return sum - t.amount
      return sum
    }, account.initialBalance)

  const savingsBalance = linkedSavings
    .filter(s => s.accountId === account.id)
    .reduce((sum, s) => sum + s.balance, 0)

  return txBalance + savingsBalance
}

/**
 * Selector: saldo acumulado efetivado de todas as transações com data
 * anterior ao primeiro dia do mês (year, month). Base do carryover.
 */
export function selectOpeningBalance(
  transactions: Transaction[],
  year: number,
  month: number
): number {
  const pad    = (n: number) => String(n).padStart(2, '0')
  const cutoff = `${year}-${pad(month)}-01`

  return transactions
    .filter(t => t.date < cutoff && t.type !== 'transfer' && isSettled(t))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
}

// ─── Funções de cálculo ────────────────────────────────────────────────────────

/** Calcula em qual mês uma compra no cartão vai aparecer na fatura.
 *  Se dia(compra) <= closingDay → mês atual
 *  Se dia(compra) >  closingDay → mês seguinte
 */
export function getTransactionBillingMonth(
  date: string,
  card: CreditCard
): { year: number; month: number } {
  const d   = new Date(date + 'T12:00:00')
  const day = d.getDate()
  if (day <= card.closingDay) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  } else {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { year: next.getFullYear(), month: next.getMonth() + 1 }
  }
}

/** Melhor dia para comprar no cartão sem cair na fatura atual. */
export function getBestPurchaseDay(card: CreditCard): number {
  return (card.closingDay % 28) + 1
}

/**
 * Resumo financeiro de um mês.
 * Recebe as transações já filtradas por mês (monthTx) e todas as
 * transações históricas (allTransactions) para calcular o carryover.
 */
export function computeMonthlySummary(
  monthTx: Transaction[],
  allTransactions: Transaction[] = [],
  year?: number,
  month?: number
): MonthlySummary {
  let totalIncome    = 0
  let totalExpense   = 0
  let saldoReal      = 0
  let saldoProjetado = 0
  let pendingCount   = 0
  const byCategory: Record<string, number> = {}

  for (const t of monthTx) {
    if (t.type === 'transfer') continue

    const sign  = t.type === 'income' ? 1 : -1
    const value = t.amount * sign

    saldoProjetado += value

    if (isSettled(t)) {
      saldoReal += value
      if (t.type === 'income')  totalIncome  += t.amount
      if (t.type === 'expense') totalExpense += t.amount
    } else {
      pendingCount++
    }

    if (t.type === 'expense') {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
    }
  }

  const openingBalance = (allTransactions.length > 0 && year != null && month != null)
    ? selectOpeningBalance(allTransactions, year, month)
    : 0

  return {
    totalIncome,
    totalExpense,
    saldoReal,
    saldoProjetado,
    openingBalance,
    saldoAcumulado: openingBalance + saldoProjetado,
    byCategory,
    pendingCount,
  }
}

/** Agrupa transações por mês para o gráfico de histórico (6 meses). */
export function computeMonthlyHistory(
  transactions: Transaction[],
  months = 6
): MonthlyHistory[] {
  const result: MonthlyHistory[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1

    const monthTx = transactions.filter(t => {
      const td = new Date(t.date + 'T12:00:00')
      return td.getFullYear() === y && (td.getMonth() + 1) === m && isSettled(t)
    })

    const totalIncome  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    result.push({ year: y, month: m, totalIncome, totalExpense })
  }

  return result
}

/** Calcula fatura atual do cartão baseado nas transações do mês de faturamento. */
export function computeCardBill(
  card: CreditCard,
  allTransactions: Transaction[],
  year: number,
  month: number
): number {
  return allTransactions
    .filter(t => {
      if (t.type !== 'expense' || t.paymentMethod !== 'card' || t.cardId !== card.id) return false
      const billing = getTransactionBillingMonth(t.date, card)
      return billing.year === year && billing.month === month
    })
    .reduce((sum, t) => sum + t.amount, 0)
}
