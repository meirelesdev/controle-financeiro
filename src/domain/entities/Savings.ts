export type SavingsType = 'bank' | 'digital' | 'piggybank'

export interface Savings {
  id: string
  name: string
  balance: number
  type: SavingsType
  color: string
  /** Conta bancária a que este cofrinho pertence */
  accountId?: string
  updatedAt: string
}
