export type SavingsType = 'bank' | 'digital' | 'piggybank'

export interface Savings {
  id: string
  name: string
  balance: number
  type: SavingsType
  color: string
  updatedAt: string
}
