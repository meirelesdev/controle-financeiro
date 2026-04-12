import type { IDBPDatabase } from 'idb'
import type { CfpDB } from '../database/DatabaseHelper'
import type { CreditCard } from '../../domain/entities/CreditCard'
import type { ICreditCardRepository } from '../../domain/repositories/ICreditCardRepository'

export class IdbCreditCardRepository implements ICreditCardRepository {
  constructor(private db: IDBPDatabase<CfpDB>) {}

  async add(card: CreditCard): Promise<void> {
    await this.db.put('creditCards', card)
  }

  async update(card: CreditCard): Promise<void> {
    await this.db.put('creditCards', card)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('creditCards', id)
  }

  async getById(id: string): Promise<CreditCard | undefined> {
    return this.db.get('creditCards', id)
  }

  async getAll(): Promise<CreditCard[]> {
    return this.db.getAll('creditCards')
  }
}
