import type { IAccountRepository } from '../../../domain/repositories/IAccountRepository'
import type { Account } from '../../../domain/entities/Account'

const ACCOUNT_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#EF4444','#6366F1','#14B8A6']

export async function addAccount(
  repo: IAccountRepository,
  input: { name: string; initialBalance: number; color?: string }
): Promise<Account> {
  const all = await repo.getAll()
  const account: Account = {
    id:             `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name:           input.name,
    color:          input.color ?? ACCOUNT_COLORS[all.length % ACCOUNT_COLORS.length],
    initialBalance: input.initialBalance,
    cardIds:        [],
    createdAt:      new Date().toISOString(),
  }
  await repo.add(account)
  return account
}

export async function updateAccount(
  repo: IAccountRepository,
  id: string,
  patch: Partial<Pick<Account, 'name' | 'color' | 'initialBalance' | 'cardIds'>>
): Promise<Account> {
  const existing = await repo.getById(id)
  if (!existing) throw new Error(`Conta ${id} não encontrada`)
  const updated: Account = { ...existing, ...patch }
  await repo.update(updated)
  return updated
}

export async function deleteAccount(
  repo: IAccountRepository,
  id: string
): Promise<void> {
  await repo.delete(id)
}
