import type { Savings } from '../entities/Savings'

export interface ISavingsRepository {
  add(s: Savings): Promise<void>
  update(s: Savings): Promise<void>
  delete(id: string): Promise<void>
  getById(id: string): Promise<Savings | undefined>
  getAll(): Promise<Savings[]>
}
