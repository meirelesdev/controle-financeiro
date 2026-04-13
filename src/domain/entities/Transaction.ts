export type TransactionType   = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pendente' | 'confirmado' | 'pago'

export interface Transaction {
  id: string
  type: TransactionType
  /**
   * pendente   = lançamento futuro / previsão — só entra no saldoProjetado
   * confirmado = efetivado (para receitas: recebido; para despesas: comprometido mas ainda não pago ao banco)
   * pago       = despesa quitada — abate o saldo real da conta bancária
   */
  status: TransactionStatus
  amount: number
  description: string
  category: string
  date: string            // YYYY-MM-DD — data de competência
  paymentMethod: PaymentMethod
  cardId?: string         // preenchido quando paymentMethod === 'card'
  accountId?: string      // conta bancária vinculada (event sourcing)
  paymentDate?: string    // YYYY-MM-DD — preenchido quando status === 'pago'
  /** Vincula parcelas de uma mesma compra parcelada */
  installmentGroupId?: string
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp
}

export type PaymentMethod = 'cash' | 'card'
