import type { IDBPDatabase } from 'idb'
import type { CfpDB }        from '../database/DatabaseHelper'
import type { Account }      from '../../domain/entities/Account'
import type { IAccountRepository } from '../../domain/repositories/IAccountRepository'

export class IdbAccountRepository implements IAccountRepository {
  constructor(private db: IDBPDatabase<CfpDB>) {}

  async add(a: Account): Promise<void> {
    await this.db.put('accounts', a)
  }

  async update(a: Account): Promise<void> {
    await this.db.put('accounts', a)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('accounts', id)
  }

  async getById(id: string): Promise<Account | undefined> {
    return this.db.get('accounts', id)
  }

  async getAll(): Promise<Account[]> {
    return this.db.getAll('accounts')
  }
}
