import type { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import type { Transaction } from '../../../domain/entities/Transaction'

export async function updateTransaction(
  repo: ITransactionRepository,
  id: string,
  changes: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<Transaction> {
  const existing = await repo.getById(id)
  if (!existing) throw new Error(`Transação ${id} não encontrada`)

  const updated: Transaction = {
    ...existing,
    ...changes,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }
  await repo.update(updated)
  return updated
}
