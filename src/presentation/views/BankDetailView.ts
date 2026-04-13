import type { IAccountRepository }     from '../../domain/repositories/IAccountRepository'
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { ISavingsRepository }      from '../../domain/repositories/ISavingsRepository'
import type { CreditCard }   from '../../domain/entities/CreditCard'
import type { Savings }      from '../../domain/entities/Savings'
import type { Transaction }  from '../../domain/entities/Transaction'
import { updateAccount, deleteAccount } from '../../application/use-cases/accounts/ManageAccounts'
import { addCreditCard, updateCreditCard, deleteCreditCard } from '../../application/use-cases/cards/ManageCreditCard'
import { addSavings, deleteSavings, updateSavingsBalance, transferBetweenSavings } from '../../application/use-cases/savings/ManageSavings'
import { selectAccountBalance, computeCardBill } from '../../domain/services/SummaryService'
import { openModal, getModalBody } from '../components/Modal'
import { showToast } from '../components/Toast'
import { formatCurrency, getCurrentYearMonth } from '../utils/formatters'
import { validateName, validateDay, validateAmount } from '../utils/validators'
import { navigate } from '../router'

export async function renderBankDetail(
  container: HTMLElement,
  accountId: string,
  accountRepo: IAccountRepository,
  txRepo:      ITransactionRepository,
  cardRepo:    ICreditCardRepository,
  savingsRepo: ISavingsRepository
): Promise<void> {
  const { year, month } = getCurrentYearMonth()

  async function render() {
    container.innerHTML = ''

    const account = await accountRepo.getById(accountId)
    if (!account) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">⚠️</span>
          <p class="empty-text">Banco não encontrado</p>
          <button id="btn-back-notfound" class="btn-primary mt-4">← Voltar</button>
        </div>
      `
      document.getElementById('btn-back-notfound')?.addEventListener('click', () => navigate('accounts'))
      return
    }

    const transactions  = await txRepo.getAll()
    const allCards      = await cardRepo.getAll()
    const allSavings    = await savingsRepo.getAll()
    const linkedCards   = allCards.filter(c => c.accountId === accountId)
    const orphanCards   = allCards.filter(c => !c.accountId)
    const linkedSavs    = allSavings.filter(s => s.accountId === accountId)
    const orphanSavings = allSavings.filter(s => !s.accountId)
    const balance       = selectAccountBalance(account, transactions, allSavings)
    const savingsTotal  = linkedSavs.reduce((s, sv) => s + sv.balance, 0)

    // ── Back button + header ────────────────────────────────
    const backBtn = document.createElement('button')
    backBtn.className = 'btn-ghost text-sm mb-4 flex items-center gap-1'
    backBtn.innerHTML = '← Bancos'
    backBtn.addEventListener('click', () => navigate('accounts'))
    container.appendChild(backBtn)

    // ── Bank summary card ────────────────────────────────────
    const summaryCard = document.createElement('div')
    summaryCard.className = 'card mb-4'
    summaryCard.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div class="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
             style="background:${account.color}22; border:2px solid ${account.color}">🏦</div>
        <div class="flex-1 min-w-0">
          <div class="text-lg font-bold text-muted">${account.name}</div>
          <div class="text-xs text-subtle">Saldo inicial: ${formatCurrency(account.initialBalance)}</div>
        </div>
        <div class="flex gap-2">
          <button id="btn-edit-account" class="text-subtle hover:text-muted text-lg leading-none">✏️</button>
          <button id="btn-del-account"  class="text-subtle hover:text-danger text-lg leading-none">🗑️</button>
        </div>
      </div>
      <div class="bg-bg rounded-xl p-3 space-y-1.5">
        <div class="flex justify-between text-sm">
          <span class="text-subtle">Saldo total</span>
          <span class="font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(balance)}</span>
        </div>
        ${savingsTotal > 0 ? `
        <div class="flex justify-between text-xs">
          <span class="text-subtle">Conta</span>
          <span class="${(balance - savingsTotal) >= 0 ? 'text-income' : 'text-expense'} font-medium">${formatCurrency(balance - savingsTotal)}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-subtle">Cofrinhos</span>
          <span class="text-primary font-medium">${formatCurrency(savingsTotal)}</span>
        </div>
        ` : ''}
      </div>
    `
    container.appendChild(summaryCard)

    summaryCard.querySelector('#btn-edit-account')?.addEventListener('click', () => openEditAccountModal(account.name, account.initialBalance, account.color))
    summaryCard.querySelector('#btn-del-account')?.addEventListener('click',  () => {
      openModal({
        title: `Excluir ${account.name}?`,
        content: `<p class="text-sm text-subtle">O banco será removido. Transações e cofrinhos vinculados <strong>não serão apagados</strong>, mas perderão o vínculo.</p>`,
        danger: true,
        confirmLabel: 'Excluir banco',
        onConfirm: async () => {
          await deleteAccount(accountRepo, accountId)
          showToast('Banco removido', 'success')
          navigate('accounts')
        },
      })
    })

    // ── Cartões ──────────────────────────────────────────────
    const cardsSection = document.createElement('div')
    cardsSection.className = 'mb-4'
    const cardsHeader = document.createElement('div')
    cardsHeader.className = 'flex items-center justify-between mb-2'
    cardsHeader.innerHTML = `
      <div class="section-title mb-0">Cartões de Crédito (${linkedCards.length})</div>
      <button id="btn-add-card" class="btn-primary text-xs px-3 py-1.5">+ Novo</button>
    `
    cardsSection.appendChild(cardsHeader)
    cardsHeader.querySelector('#btn-add-card')?.addEventListener('click', () => openCardModal())

    if (linkedCards.length === 0 && orphanCards.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'card-sm text-center py-4 text-xs text-subtle'
      empty.textContent = 'Nenhum cartão vinculado a este banco.'
      cardsSection.appendChild(empty)
    } else {
      for (const card of linkedCards) {
        cardsSection.appendChild(buildCardEl(card, transactions))
      }
    }

    // Cartões sem banco (órfãos) — permite vincular
    if (orphanCards.length > 0) {
      const orphanTitle = document.createElement('div')
      orphanTitle.className = 'text-xs text-subtle uppercase tracking-wider mt-3 mb-1.5 font-semibold'
      orphanTitle.textContent = 'Sem banco vinculado'
      cardsSection.appendChild(orphanTitle)

      for (const card of orphanCards) {
        const el = document.createElement('div')
        el.className = 'card-sm mb-2 border border-dashed border-subtle'
        el.innerHTML = `
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${card.color}"></div>
            <span class="text-sm text-muted flex-1">${card.name}</span>
            <button class="btn-outline text-xs px-2 py-1" data-link-card="${card.id}">Vincular</button>
          </div>
        `
        el.querySelector(`[data-link-card="${card.id}"]`)?.addEventListener('click', async () => {
          await updateCreditCard(cardRepo, card.id, { accountId })
          showToast(`${card.name} vinculado a ${account.name}`, 'success')
          await render()
        })
        cardsSection.appendChild(el)
      }
    }
    container.appendChild(cardsSection)

    // ── Cofrinhos ────────────────────────────────────────────
    const savSection = document.createElement('div')
    savSection.className = 'mb-4'
    const savHeader = document.createElement('div')
    savHeader.className = 'flex items-center justify-between mb-2'
    savHeader.innerHTML = `
      <div class="section-title mb-0">Cofrinhos (${linkedSavs.length})</div>
      <button id="btn-add-sav" class="btn-primary text-xs px-3 py-1.5">+ Novo</button>
    `
    savSection.appendChild(savHeader)
    savHeader.querySelector('#btn-add-sav')?.addEventListener('click', () => openSavingsModal())

    if (linkedSavs.length === 0 && orphanSavings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'card-sm text-center py-4 text-xs text-subtle'
      empty.textContent = 'Nenhum cofrinho vinculado a este banco.'
      savSection.appendChild(empty)
    } else {
      for (const sav of linkedSavs) {
        savSection.appendChild(buildSavEl(sav, linkedSavs))
      }
    }

    // Cofrinhos sem banco (órfãos) — permite vincular
    if (orphanSavings.length > 0) {
      const orphanTitle = document.createElement('div')
      orphanTitle.className = 'text-xs text-subtle uppercase tracking-wider mt-3 mb-1.5 font-semibold'
      orphanTitle.textContent = 'Sem banco vinculado'
      savSection.appendChild(orphanTitle)

      for (const sav of orphanSavings) {
        const el = document.createElement('div')
        el.className = 'card-sm mb-2 border border-dashed border-subtle'
        el.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-base">${sav.type === 'bank' ? '🏦' : sav.type === 'digital' ? '📱' : '🐷'}</span>
            <span class="text-sm text-muted flex-1">${sav.name} — ${formatCurrency(sav.balance)}</span>
            <button class="btn-outline text-xs px-2 py-1" data-link-sav="${sav.id}">Vincular</button>
          </div>
        `
        el.querySelector(`[data-link-sav="${sav.id}"]`)?.addEventListener('click', async () => {
          // updateSavingsBalance com delta 0 apenas persiste o accountId via spread
          const existing = allSavings.find(s => s.id === sav.id)!
          await savingsRepo.update({ ...existing, accountId })
          showToast(`${sav.name} vinculado a ${account.name}`, 'success')
          await render()
        })
        savSection.appendChild(el)
      }
    }
    container.appendChild(savSection)
  }

  function buildCardEl(card: CreditCard, transactions: Transaction[]): HTMLElement {
    const bill   = computeCardBill(card, transactions, year, month)
    const pct    = card.limit > 0 ? (bill / card.limit) * 100 : 0
    const cardEl = document.createElement('div')
    cardEl.className = 'card-sm mb-2'
    cardEl.innerHTML = `
      <div class="flex items-center gap-2 mb-2">
        <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${card.color}"></div>
        <span class="text-sm font-semibold text-muted flex-1">${card.name}</span>
        <button class="text-subtle hover:text-muted text-base" data-edit-card="${card.id}">✏️</button>
        <button class="text-subtle hover:text-danger text-base" data-del-card="${card.id}">🗑️</button>
      </div>
      <div class="flex justify-between text-xs text-subtle mb-1.5">
        <span>Fatura: <strong class="text-expense">${formatCurrency(bill)}</strong></span>
        <span>Limite: ${formatCurrency(card.limit)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct > 80 ? '#E53935' : card.color}"></div>
      </div>
      <div class="text-xs text-subtle mt-1">Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}</div>
    `
    cardEl.querySelector(`[data-edit-card="${card.id}"]`)?.addEventListener('click', () => openCardModal(card))
    cardEl.querySelector(`[data-del-card="${card.id}"]`)?.addEventListener('click', () => {
      openModal({
        title: `Excluir ${card.name}?`,
        content: `<p class="text-sm text-subtle">Os lançamentos do cartão permanecerão. Esta ação não pode ser desfeita.</p>`,
        danger: true,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await deleteCreditCard(cardRepo, card.id)
          showToast('Cartão removido', 'success')
          await render()
        },
      })
    })
    return cardEl
  }

  function buildSavEl(sav: Savings, allLinked: Savings[]): HTMLElement {
    const savEl = document.createElement('div')
    savEl.className = 'card-sm mb-2'
    savEl.innerHTML = `
      <div class="flex items-center gap-3 mb-2">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
             style="background:${sav.color}22; border:2px solid ${sav.color}">
          ${sav.type === 'bank' ? '🏦' : sav.type === 'digital' ? '📱' : '🐷'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-muted">${sav.name}</div>
          <div class="text-xs text-subtle">${formatCurrency(sav.balance)}</div>
        </div>
        <button class="text-subtle hover:text-danger text-base" data-del-sav="${sav.id}">🗑️</button>
      </div>
      <div class="flex gap-2">
        <button class="btn-outline flex-1 text-xs py-1.5" data-dep-sav="${sav.id}">+ Depositar</button>
        <button class="btn-ghost flex-1 text-xs py-1.5" data-wit-sav="${sav.id}">− Retirar</button>
        ${allLinked.length > 1 ? `<button class="btn-ghost flex-1 text-xs py-1.5" data-tr-sav="${sav.id}">↔ Transferir</button>` : ''}
      </div>
    `
    savEl.querySelector(`[data-del-sav="${sav.id}"]`)?.addEventListener('click', () => {
      openModal({
        title: `Excluir ${sav.name}?`,
        content: `<p class="text-sm text-subtle">O saldo de ${formatCurrency(sav.balance)} será perdido.</p>`,
        danger: true,
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await deleteSavings(savingsRepo, sav.id)
          showToast('Cofrinho removido', 'success')
          await render()
        },
      })
    })
    savEl.querySelector(`[data-dep-sav="${sav.id}"]`)?.addEventListener('click', () => openAmountModal(sav, 'deposit'))
    savEl.querySelector(`[data-wit-sav="${sav.id}"]`)?.addEventListener('click', () => openAmountModal(sav, 'withdraw'))
    savEl.querySelector(`[data-tr-sav="${sav.id}"]`)?.addEventListener('click', () => openTransferModal(sav, allLinked))
    return savEl
  }

  // ── Account edit modal ──────────────────────────────────────
  function openEditAccountModal(name: string, initialBalance: number, color: string) {
    openModal({
      title: 'Editar Banco',
      content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Nome do banco *</label>
            <input id="acc-name" type="text" class="input" value="${name}" placeholder="Ex: Nubank, Itaú, C6">
          </div>
          <div>
            <label class="form-label">Saldo inicial (R$)</label>
            <input id="acc-initial" type="number" step="0.01" class="input" value="${initialBalance}" placeholder="0,00">
          </div>
          <div>
            <label class="form-label">Cor</label>
            <input id="acc-color" type="color" class="input h-10 cursor-pointer" value="${color}">
          </div>
        </div>
      `,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        const body    = getModalBody()!
        const newName = (body.querySelector('#acc-name')    as HTMLInputElement).value.trim()
        const initial = parseFloat((body.querySelector('#acc-initial') as HTMLInputElement).value)
        const newColor = (body.querySelector('#acc-color')  as HTMLInputElement).value

        if (!newName) { showToast('Informe o nome do banco', 'error'); return false }

        await updateAccount(accountRepo, accountId, {
          name: newName,
          color: newColor,
          initialBalance: isNaN(initial) ? 0 : initial,
        })
        showToast('Banco atualizado', 'success')
        await render()
      },
    })
  }

  // ── Card modals ─────────────────────────────────────────────
  function openCardModal(existing?: CreditCard) {
    openModal({
      title: existing ? 'Editar Cartão' : 'Novo Cartão',
      content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Nome do cartão *</label>
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
        const body    = getModalBody()!
        const name    = (body.querySelector('#c-name')    as HTMLInputElement).value.trim()
        const limit   = parseFloat((body.querySelector('#c-limit')   as HTMLInputElement).value)
        const closing = parseInt((body.querySelector('#c-closing') as HTMLInputElement).value)
        const due     = parseInt((body.querySelector('#c-due')     as HTMLInputElement).value)

        const nameErr = validateName(name)
        const clErr   = validateDay(closing)
        const dueErr  = validateDay(due)
        if (nameErr || clErr || dueErr) {
          showToast(nameErr ?? clErr ?? dueErr ?? 'Erro', 'error'); return false
        }

        if (existing) {
          await updateCreditCard(cardRepo, existing.id, { name, limit: limit || 0, closingDay: closing, dueDay: due, accountId })
          showToast('Cartão atualizado', 'success')
        } else {
          await addCreditCard(cardRepo, { name, limit: limit || 0, closingDay: closing, dueDay: due, accountId })
          showToast('Cartão adicionado', 'success')
        }
        await render()
      },
    })
  }

  // ── Savings modals ──────────────────────────────────────────
  function openSavingsModal() {
    openModal({
      title: 'Novo Cofrinho',
      content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Nome *</label>
            <input id="s-name" type="text" class="input" placeholder="Ex: Reserva emergência, Viagem">
          </div>
          <div>
            <label class="form-label">Tipo</label>
            <select id="s-type" class="select">
              <option value="bank">🏦 Banco</option>
              <option value="digital">📱 Carteira Digital</option>
              <option value="piggybank">🐷 Cofrinho</option>
            </select>
          </div>
          <div>
            <label class="form-label">Saldo inicial (R$)</label>
            <input id="s-balance" type="number" min="0" step="0.01" class="input" value="0" placeholder="0,00">
          </div>
        </div>
      `,
      confirmLabel: 'Criar',
      onConfirm: async () => {
        const body    = getModalBody()!
        const name    = (body.querySelector('#s-name')    as HTMLInputElement).value.trim()
        const type    = (body.querySelector('#s-type')    as HTMLSelectElement).value as 'bank' | 'digital' | 'piggybank'
        const balance = parseFloat((body.querySelector('#s-balance') as HTMLInputElement).value) || 0

        const err = validateName(name)
        if (err) { showToast(err, 'error'); return false }

        await addSavings(savingsRepo, { name, type, balance, accountId })
        showToast('Cofrinho criado', 'success')
        await render()
      },
    })
  }

  function openAmountModal(sav: Savings, mode: 'deposit' | 'withdraw') {
    openModal({
      title: mode === 'deposit' ? `Depositar em ${sav.name}` : `Retirar de ${sav.name}`,
      content: `
        <div class="mb-1 text-xs text-subtle">Saldo atual: <strong>${formatCurrency(sav.balance)}</strong></div>
        <label class="form-label mt-3">Valor (R$)</label>
        <input id="am-value" type="number" min="0.01" step="0.01" class="input mt-1" placeholder="0,00">
      `,
      confirmLabel: mode === 'deposit' ? 'Depositar' : 'Retirar',
      onConfirm: async () => {
        const body  = getModalBody()!
        const value = parseFloat((body.querySelector('#am-value') as HTMLInputElement).value)
        const err   = validateAmount(value)
        if (err) { showToast(err, 'error'); return }
        if (mode === 'withdraw' && value > sav.balance) { showToast('Saldo insuficiente', 'error'); return }

        const delta = mode === 'deposit' ? +value : -value
        await updateSavingsBalance(savingsRepo, sav.id, delta)
        showToast(mode === 'deposit' ? 'Depósito realizado' : 'Retirada realizada', 'success')
        await render()
      },
    })
  }

  function openTransferModal(from: Savings, all: Savings[]) {
    const others = all.filter(s => s.id !== from.id)
    openModal({
      title: `Transferir de ${from.name}`,
      content: `
        <div class="space-y-3">
          <div class="text-xs text-subtle">Saldo disponível: <strong>${formatCurrency(from.balance)}</strong></div>
          <div>
            <label class="form-label">Destino</label>
            <select id="tr-to" class="select">
              ${others.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Valor (R$)</label>
            <input id="tr-value" type="number" min="0.01" step="0.01" class="input" placeholder="0,00">
          </div>
          <div>
            <label class="form-label">Descrição</label>
            <input id="tr-desc" type="text" class="input" placeholder="Ex: Reserva AP">
          </div>
        </div>
      `,
      confirmLabel: 'Transferir',
      onConfirm: async () => {
        const body  = getModalBody()!
        const toId  = (body.querySelector('#tr-to')    as HTMLSelectElement).value
        const value = parseFloat((body.querySelector('#tr-value') as HTMLInputElement).value)
        const desc  = (body.querySelector('#tr-desc')  as HTMLInputElement).value.trim() || 'Transferência'

        const err = validateAmount(value)
        if (err) { showToast(err, 'error'); return }

        try {
          await transferBetweenSavings(savingsRepo, txRepo, from.id, toId, value, desc)
          showToast('Transferência realizada', 'success')
          await render()
        } catch (e) {
          showToast(e instanceof Error ? e.message : 'Erro na transferência', 'error')
        }
      },
    })
  }

  await render()
}
