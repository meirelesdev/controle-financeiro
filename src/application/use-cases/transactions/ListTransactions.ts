import type { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import type { Transaction, TransactionType, TransactionStatus } from '../../../domain/entities/Transaction'

export interface ListTransactionsFilter {
  year: number
  month: number
  type?: TransactionType
  status?: TransactionStatus
  category?: string
}

export async function listTransactions(
  repo: ITransactionRepository,
  filter: ListTransactionsFilter
): Promise<Transaction[]> {
  let transactions = await repo.getByMonth(filter.year, filter.month)

  if (filter.type)     transactions = transactions.filter(t => t.type === filter.type)
  if (filter.status)   transactions = transactions.filter(t => t.status === filter.status)
  if (filter.category) transactions = transactions.filter(t => t.category === filter.category)

  return transactions.sort((a, b) => b.date.localeCompare(a.date))
}
