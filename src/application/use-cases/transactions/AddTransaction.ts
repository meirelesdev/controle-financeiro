import type { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import type { Transaction, TransactionType, TransactionStatus, PaymentMethod } from '../../../domain/entities/Transaction'

export interface AddTransactionInput {
  type: TransactionType
  status: TransactionStatus
  amount: number
  description: string
  category: string
  date: string
  paymentMethod: PaymentMethod
  cardId?: string
}

export async function addTransaction(
  repo: ITransactionRepository,
  input: AddTransactionInput
): Promise<Transaction> {
  const now = new Date().toISOString()
  const transaction: Transaction = {
    id:            `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:          input.type,
    status:        input.status,
    amount:        input.amount,
    description:   input.description,
    category:      input.category,
    date:          input.date,
    paymentMethod: input.paymentMethod,
    cardId:        input.cardId,
    createdAt:     now,
    updatedAt:     now,
  }
  await repo.add(transaction)
  return transaction
}
