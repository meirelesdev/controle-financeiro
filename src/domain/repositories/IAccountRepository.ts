import type { Account } from '../entities/Account'

export interface IAccountRepository {
  add(a: Account): Promise<void>
  update(a: Account): Promise<void>
  delete(id: string): Promise<void>
  getById(id: string): Promise<Account | undefined>
  getAll(): Promise<Account[]>
}
