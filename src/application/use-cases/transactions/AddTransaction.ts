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

export interface AddInstallmentInput {
  type:          TransactionType
  /** Status da primeira parcela; as demais serão sempre 'pendente'. */
  status:        TransactionStatus
  /** Valor total da compra — será dividido igualmente entre as parcelas. */
  amount:        number
  description:   string
  category:      string
  /** Data da primeira parcela. */
  date:          string
  paymentMethod: PaymentMethod
  cardId?:       string
  installments:  number
}

/** Avança uma data em `months` meses, clampando ao último dia do mês destino. */
function addMonths(dateStr: string, months: number): string {
  const d          = new Date(dateStr + 'T12:00:00')
  const targetYear  = d.getFullYear() + Math.floor((d.getMonth() + months) / 12)
  const targetMonth = ((d.getMonth() + months) % 12 + 12) % 12
  const lastDay     = new Date(targetYear, targetMonth + 1, 0).getDate()
  const pad         = (n: number) => String(n).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(d.getDate(), lastDay))}`
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

/**
 * Cria uma série de parcelas vinculadas por `installmentGroupId`.
 * – Cada parcela tem a data incrementada em 1 mês.
 * – A primeira parcela usa o `status` informado; as seguintes são sempre `'pendente'`.
 * – O valor é dividido igualmente; a última parcela absorve qualquer centavo de arredondamento.
 */
export async function addInstallmentGroup(
  repo: ITransactionRepository,
  input: AddInstallmentInput
): Promise<Transaction[]> {
  const n       = input.installments
  const groupId = `ig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const base    = Math.round((input.amount / n) * 100) / 100
  const last    = Math.round((input.amount - base * (n - 1)) * 100) / 100
  const now     = new Date().toISOString()
  const created: Transaction[] = []

  for (let i = 0; i < n; i++) {
    const num = i + 1
    const t: Transaction = {
      id:                 `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type:               input.type,
      status:             i === 0 ? input.status : 'pendente',
      amount:             i === n - 1 ? last : base,
      description:        `${input.description} (${String(num).padStart(2, '0')}/${String(n).padStart(2, '0')})`,
      category:           input.category,
      date:               i === 0 ? input.date : addMonths(input.date, i),
      paymentMethod:      input.paymentMethod,
      cardId:             input.cardId,
      installmentGroupId: groupId,
      createdAt:          now,
      updatedAt:          now,
    }
    await repo.add(t)
    created.push(t)
  }

  return created
}
