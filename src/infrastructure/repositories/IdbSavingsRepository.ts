import type { IDBPDatabase } from 'idb'
import type { CfpDB } from '../database/DatabaseHelper'
import type { Savings } from '../../domain/entities/Savings'
import type { ISavingsRepository } from '../../domain/repositories/ISavingsRepository'

export class IdbSavingsRepository implements ISavingsRepository {
  constructor(private db: IDBPDatabase<CfpDB>) {}

  async add(s: Savings): Promise<void> {
    await this.db.put('savings', s)
  }

  async update(s: Savings): Promise<void> {
    await this.db.put('savings', s)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('savings', id)
  }

  async getById(id: string): Promise<Savings | undefined> {
    return this.db.get('savings', id)
  }

  async getAll(): Promise<Savings[]> {
    return this.db.getAll('savings')
  }
}
