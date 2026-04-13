export interface Account {
  id:             string
  name:           string
  color:          string
  /** Saldo inicial ao cadastrar a conta — base do event sourcing. */
  initialBalance: number
  /** Cartões de crédito vinculados a esta conta. */
  cardIds?:       string[]
  createdAt:      string
}
