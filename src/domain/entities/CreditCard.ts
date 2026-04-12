export interface CreditCard {
  id: string
  name: string
  limit: number
  currentBalance: number
  /** Dia do fechamento da fatura (ex: 15) */
  closingDay: number
  /** Dia do vencimento da fatura (ex: 10) */
  dueDay: number
  color: string
  createdAt: string
}
