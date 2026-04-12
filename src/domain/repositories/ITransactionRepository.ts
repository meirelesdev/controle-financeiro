import type { Transaction } from '../entities/Transaction'

export interface ITransactionRepository {
  add(t: Transaction): Promise<void>
  update(t: Transaction): Promise<void>
  delete(id: string): Promise<void>
  getById(id: string): Promise<Transaction | undefined>
  getAll(): Promise<Transaction[]>
  getByMonth(year: number, month: number): Promise<Transaction[]>
  getByInstallmentGroup(groupId: string): Promise<Transaction[]>
}
