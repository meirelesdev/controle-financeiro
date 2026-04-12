import type { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'

export async function deleteTransaction(
  repo: ITransactionRepository,
  id: string
): Promise<void> {
  await repo.delete(id)
}

/**
 * Exclui a transação informada e todas as parcelas do mesmo grupo com data ≥ à dela.
 * Retorna o número de registros excluídos.
 */
export async function deleteInstallmentGroup(
  repo: ITransactionRepository,
  id: string
): Promise<number> {
  const tx = await repo.getById(id)
  if (!tx) return 0

  if (!tx.installmentGroupId) {
    await repo.delete(id)
    return 1
  }

  const group    = await repo.getByInstallmentGroup(tx.installmentGroupId)
  const toDelete = group.filter(t => t.date >= tx.date)
  for (const t of toDelete) await repo.delete(t.id)
  return toDelete.length
}
