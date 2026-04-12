import type { IDBPDatabase } from 'idb'
import type { CfpDB } from '../database/DatabaseHelper'
import type { Transaction } from '../../domain/entities/Transaction'
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'

export class IdbTransactionRepository implements ITransactionRepository {
  constructor(private db: IDBPDatabase<CfpDB>) {}

  async add(t: Transaction): Promise<void> {
    await this.db.put('transactions', t)
  }

  async update(t: Transaction): Promise<void> {
    await this.db.put('transactions', t)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('transactions', id)
  }

  async getById(id: string): Promise<Transaction | undefined> {
    return this.db.get('transactions', id)
  }

  async getAll(): Promise<Transaction[]> {
    return this.db.getAll('transactions')
  }

  async getByMonth(year: number, month: number): Promise<Transaction[]> {
    const pad  = (n: number) => String(n).padStart(2, '0')
    const from = `${year}-${pad(month)}-01`
    const to   = `${year}-${pad(month)}-31`
    const range = IDBKeyRange.bound(from, to)
    return this.db.getAllFromIndex('transactions', 'by-date', range)
  }

  async getByInstallmentGroup(groupId: string): Promise<Transaction[]> {
    const all = await this.db.getAll('transactions')
    return all.filter(t => t.installmentGroupId === groupId)
  }
}
