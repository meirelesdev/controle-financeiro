import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { Transaction, TransactionType } from '../../domain/entities/Transaction'
import { listTransactions }   from '../../application/use-cases/transactions/ListTransactions'
import { deleteTransaction, deleteInstallmentGroup }  from '../../application/use-cases/transactions/DeleteTransaction'
import { renderMonthPicker }  from '../components/MonthPicker'
import { renderTransactionCard } from '../components/TransactionCard'
import { openTransactionModal }  from '../components/TransactionModal'
import { showToast } from '../components/Toast'
import { formatLongDate, getCurrentYearMonth } from '../utils/formatters'

export async function renderTransactions(
  container: HTMLElement,
  txRepo: ITransactionRepository,
  cardRepo: ICreditCardRepository
): Promise<void> {
  let { year, month } = getCurrentYearMonth()
  let filterType: TransactionType | '' = ''

  async function renderList() {
    const listEl = document.getElementById('tx-list')
    if (!listEl) return

    const txs = await listTransactions(txRepo, {
      year, month,
      type: filterType || undefined,
    })

    listEl.innerHTML = ''

    if (txs.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p class="empty-text">Nenhuma transação este mês</p></div>`
      return
    }

    // Agrupar por data
    const grouped = new Map<string, Transaction[]>()
    for (const t of txs) {
      const arr = grouped.get(t.date) ?? []
      arr.push(t)
      grouped.set(t.date, arr)
    }

    for (const [date, group] of grouped) {
      const dateHeader = document.createElement('div')
      dateHeader.className = 'text-xs font-semibold text-subtle uppercase tracking-wider mt-4 mb-2 first:mt-0'
      dateHeader.textContent = formatLongDate(date)
      listEl.appendChild(dateHeader)

      for (const t of group) {
        listEl.appendChild(
          renderTransactionCard(
            t,
            async (id, deleteGroup) => {
              if (deleteGroup) {
                const count = await deleteInstallmentGroup(txRepo, id)
                showToast(`${count} parcela${count !== 1 ? 's' : ''} removida${count !== 1 ? 's' : ''}`, 'success')
              } else {
                await deleteTransaction(txRepo, id)
                showToast('Transação removida', 'success')
              }
              await renderList()
            },
            (tx) => openTransactionModal(txRepo, cardRepo, renderList, { existing: tx })
          )
        )
      }
    }
  }

  // Build the view
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-bold text-muted">Extrato</h1>
    </div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <div id="month-picker-wrap"></div>
      <select id="filter-type" class="select w-auto text-xs px-3 py-2">
        <option value="">Todos</option>
        <option value="income">Entradas</option>
        <option value="expense">Saídas</option>
      </select>
    </div>
    <div id="tx-list"></div>
  `

  document.getElementById('month-picker-wrap')!.appendChild(
    renderMonthPicker({ year, month, onChange: (y, m) => { year = y; month = m; renderList() } })
  )

  document.getElementById('filter-type')!.addEventListener('change', (e) => {
    filterType = (e.target as HTMLSelectElement).value as TransactionType | ''
    renderList()
  })

  // FAB
  const fab = document.createElement('button')
  fab.className = 'fab'
  fab.textContent = '+'
  fab.setAttribute('aria-label', 'Nova transação')
  fab.addEventListener('click', () => openTransactionModal(txRepo, cardRepo, renderList))
  document.querySelector('.app-container')?.appendChild(fab)

  await renderList()
}
