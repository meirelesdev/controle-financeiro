import type { Transaction } from '../../domain/entities/Transaction'
import { getCategoryById } from '../../domain/constants/Categories'
import { formatCurrency, formatShortDate } from '../utils/formatters'
import { openModal } from './Modal'

export function renderTransactionCard(
  t: Transaction,
  onDelete: (id: string, deleteGroup: boolean) => void,
  onEdit: (t: Transaction) => void
): HTMLElement {
  const cat   = getCategoryById(t.category)
  const emoji = cat?.emoji ?? '💰'
  const label = cat?.label ?? t.category

  const isIncome   = t.type === 'income'
  const isTransfer = t.type === 'transfer'

  const amountClass = isIncome ? 'text-income' : isTransfer ? 'text-blue-400' : 'text-expense'
  const amountSign  = isIncome ? '+' : isTransfer ? '↔' : '−'

  const statusBadge = t.status === 'pendente'
    ? '<span class="badge-pending ml-1">pendente</span>'
    : ''

  const installmentBadge = t.installmentGroupId
    ? '<span class="badge-pending ml-1" style="background:rgba(100,116,139,.25);color:#94a3b8">parcelado</span>'
    : ''

  const el = document.createElement('div')
  el.className = 'card-sm flex items-center gap-3 mb-2'
  el.innerHTML = `
    <div class="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-xl flex-shrink-0">
      ${emoji}
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-sm font-medium text-muted truncate">${t.description}</span>
        ${statusBadge}${installmentBadge}
      </div>
      <div class="text-xs text-subtle">${label} · ${formatShortDate(t.date)}</div>
    </div>
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <span class="text-sm font-bold ${amountClass}">${amountSign} ${formatCurrency(t.amount)}</span>
      <div class="flex gap-1">
        <button class="text-xs text-subtle hover:text-muted px-1" data-edit>✏️</button>
        <button class="text-xs text-subtle hover:text-danger px-1" data-delete>🗑️</button>
      </div>
    </div>
  `

  el.querySelector('[data-delete]')?.addEventListener('click', () => {
    if (t.installmentGroupId) {
      openModal({
        title: 'Excluir parcela',
        content: `
          <p class="text-sm text-subtle mb-2">Esta transação faz parte de uma compra parcelada.</p>
          <p class="text-sm text-muted font-medium">Deseja excluir apenas esta parcela ou esta e todas as próximas?</p>
        `,
        confirmLabel: 'Esta e as próximas',
        cancelLabel: 'Só esta parcela',
        danger: true,
        onConfirm: () => { onDelete(t.id, true) },
        onCancel:  () => { onDelete(t.id, false) },
      })
    } else {
      onDelete(t.id, false)
    }
  })

  el.querySelector('[data-edit]')?.addEventListener('click', () => onEdit(t))

  return el
}
