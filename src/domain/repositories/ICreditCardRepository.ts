import type { CreditCard } from '../entities/CreditCard'

export interface ICreditCardRepository {
  add(card: CreditCard): Promise<void>
  update(card: CreditCard): Promise<void>
  delete(id: string): Promise<void>
  getById(id: string): Promise<CreditCard | undefined>
  getAll(): Promise<CreditCard[]>
}
