import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { CreditCard } from '../../domain/entities/CreditCard'
import { addCreditCard, updateCreditCard, deleteCreditCard } from '../../application/use-cases/cards/ManageCreditCard'
import { computeCardBill, getBestPurchaseDay } from '../../domain/services/SummaryService'
import { renderMonthPicker } from '../components/MonthPicker'
import { openModal, getModalBody } from '../components/Modal'
import { showToast } from '../components/Toast'
import { renderTransactionCard } from '../components/TransactionCard'
import { deleteTransaction, deleteInstallmentGroup } from '../../application/use-cases/transactions/DeleteTransaction'
import { formatCurrency, getCurrentYearMonth } from '../utils/formatters'
import { validateName, validateDay } from '../utils/validators'

export async function renderCreditCards(
  container: HTMLElement,
  cardRepo: ICreditCardRepository,
  txRepo: ITransactionRepository
): Promise<void> {
  let { year, month } = getCurrentYearMonth()

  async function render() {
    container.innerHTML = ''

    const cards        = await cardRepo.getAll()
    const transactions = await txRepo.getAll()

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between mb-4'
    header.innerHTML = `<h1 class="text-lg font-bold text-muted">Cartões</h1>`
    const picker = renderMonthPicker({ year, month, onChange: (y, m) => { year = y; month = m; render() } })
    header.appendChild(picker)
    container.appendChild(header)

    if (cards.length === 0) {
      container.innerHTML += `<div class="empty-state"><span class="empty-icon">💳</span><p class="empty-text">Nenhum cartão cadastrado</p><button id="add-card-btn" class="btn-primary mt-4">Adicionar cartão</button></div>`
      document.getElementById('add-card-btn')?.addEventListener('click', () => openCardModal())
      return
    }

    for (const card of cards) {
      const bill      = computeCardBill(card, transactions, year, month)
      const pct       = card.limit > 0 ? (bill / card.limit) * 100 : 0
      const bestDay   = getBestPurchaseDay(card)
      const cardTx    = transactions.filter(t =>
        t.type === 'expense' && t.paymentMethod === 'card' && t.cardId === card.id &&
        (() => { const d = new Date(t.date + 'T12:00:00'); return d.getFullYear() === year && (d.getMonth() + 1) === month })()
      )

      const cardEl = document.createElement('div')
      cardEl.className = 'card mb-4'
      cardEl.innerHTML = `
        <!-- Card visual -->
        <div class="rounded-xl p-4 mb-4 relative overflow-hidden" style="background: linear-gradient(135deg, ${card.color}33, ${card.color}88)">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="text-xs text-white/70 mb-0.5">Cartão</div>
              <div class="text-lg font-bold text-white">${card.name}</div>
            </div>
            <div class="flex gap-2">
              <button class="text-white/70 hover:text-white text-xs" data-edit>✏️</button>
              <button class="text-white/70 hover:text-danger text-xs" data-del>🗑️</button>
            </div>
          </div>
          <div class="flex justify-between items-end">
            <div>
              <div class="text-xs text-white/70">Fatura atual</div>
              <div class="text-xl font-bold text-white">${formatCurrency(bill)}</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-white/70">Limite</div>
              <div class="text-sm font-semibold text-white">${formatCurrency(card.limit)}</div>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div class="progress-bar mb-1">
          <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct > 80 ? '#E53935' : card.color}"></div>
        </div>
        <div class="text-xs text-subtle mb-3">${Math.round(pct)}% do limite usado · Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}</div>

        <!-- Melhor dia de compra -->
        <div class="card-sm mb-3 flex items-center gap-2">
          <span class="text-lg">💡</span>
          <div>
            <div class="text-xs font-semibold text-muted">Melhor dia para comprar</div>
            <div class="text-xs text-subtle">A partir do dia <strong class="text-primary">${bestDay}</strong> a compra cai na próxima fatura</div>
          </div>
        </div>

        <!-- Lançamentos -->
        <div class="section-title">Lançamentos (${cardTx.length})</div>
        <div id="card-tx-${card.id}"></div>
      `

      cardEl.querySelector('[data-edit]')?.addEventListener('click', () => openCardModal(card))
      cardEl.querySelector('[data-del]')?.addEventListener('click', () => {
        openModal({
          title: `Excluir ${card.name}?`,
          content: `<p class="text-sm text-subtle">Todos os lançamentos do cartão permanecerão. Esta ação não pode ser desfeita.</p>`,
          danger: true,
          confirmLabel: 'Excluir',
          onConfirm: async () => {
            await deleteCreditCard(cardRepo, card.id)
            showToast('Cartão removido', 'success')
            await render()
          },
        })
      })

      const txList = cardEl.querySelector(`#card-tx-${card.id}`)!
      if (cardTx.length === 0) {
        txList.innerHTML = `<div class="empty-state py-6"><span class="empty-icon text-3xl">🈳</span><p class="empty-text">Sem lançamentos</p></div>`
      } else {
        cardTx.sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
          txList.appendChild(renderTransactionCard(t,
            async (id, deleteGroup) => {
              if (deleteGroup) {
                const count = await deleteInstallmentGroup(txRepo, id)
                showToast(`${count} parcela${count !== 1 ? 's' : ''} removida${count !== 1 ? 's' : ''}`, 'success')
              } else {
                await deleteTransaction(txRepo, id)
                showToast('Removido', 'success')
              }
              await render()
            },
            () => {}
          ))
        })
      }

      container.appendChild(cardEl)
    }

    // Add card button
    const addBtn = document.createElement('button')
    addBtn.className = 'btn-outline w-full'
    addBtn.textContent = '+ Adicionar Cartão'
    addBtn.addEventListener('click', () => openCardModal())
    container.appendChild(addBtn)
  }

  function openCardModal(existing?: CreditCard) {
    openModal({
      title: existing ? 'Editar Cartão' : 'Novo Cartão',
      content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Nome do cartão</label>
            <input id="c-name" type="text" class="input" value="${existing?.name ?? ''}" placeholder="Ex: Nubank">
          </div>
          <div>
            <label class="form-label">Limite (R$)</label>
            <input id="c-limit" type="number" class="input" value="${existing?.limit ?? ''}" placeholder="3000">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Dia fechamento</label>
              <input id="c-closing" type="number" min="1" max="28" class="input" value="${existing?.closingDay ?? ''}" placeholder="15">
            </div>
            <div>
              <label class="form-label">Dia vencimento</label>
              <input id="c-due" type="number" min="1" max="28" class="input" value="${existing?.dueDay ?? ''}" placeholder="10">
            </div>
          </div>
        </div>
      `,
      confirmLabel: existing ? 'Salvar' : 'Adicionar',
      onConfirm: async () => {
        const body = getModalBody()!
        const name    = (body.querySelector('#c-name')    as HTMLInputElement).value.trim()
        const limit   = parseFloat((body.querySelector('#c-limit')   as HTMLInputElement).value)
        const closing = parseInt((body.querySelector('#c-closing') as HTMLInputElement).value)
        const due     = parseInt((body.querySelector('#c-due')     as HTMLInputElement).value)

        const nameErr = validateName(name)
        const clErr   = validateDay(closing)
        const dueErr  = validateDay(due)
        if (nameErr || clErr || dueErr) {
          showToast(nameErr ?? clErr ?? dueErr ?? 'Erro', 'error'); return
        }

        if (existing) {
          await updateCreditCard(cardRepo, existing.id, { name, limit: limit || 0, closingDay: closing, dueDay: due })
          showToast('Cartão atualizado', 'success')
        } else {
          await addCreditCard(cardRepo, { name, limit: limit || 0, closingDay: closing, dueDay: due })
          showToast('Cartão adicionado', 'success')
        }
        await render()
      },
    })
  }

  await render()
}
