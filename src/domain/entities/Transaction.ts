export type TransactionType   = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pendente' | 'confirmado'
export type PaymentMethod     = 'cash' | 'card'

export interface Transaction {
  id: string
  type: TransactionType
  /** pendente = lançamento futuro / previsão; confirmado = efetivado */
  status: TransactionStatus
  amount: number
  description: string
  category: string
  date: string          // YYYY-MM-DD
  paymentMethod: PaymentMethod
  cardId?: string       // preenchido quando paymentMethod === 'card'
  createdAt: string     // ISO timestamp
  updatedAt: string     // ISO timestamp
}
