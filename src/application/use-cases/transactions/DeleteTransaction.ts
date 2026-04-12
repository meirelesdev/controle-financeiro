import type { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'

export async function deleteTransaction(
  repo: ITransactionRepository,
  id: string
): Promise<void> {
  await repo.delete(id)
}
