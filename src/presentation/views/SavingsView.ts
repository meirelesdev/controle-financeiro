import type { ISavingsRepository }      from '../../domain/repositories/ISavingsRepository'
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { IAccountRepository }     from '../../domain/repositories/IAccountRepository'
import type { Savings }  from '../../domain/entities/Savings'
import type { Account }  from '../../domain/entities/Account'
import {
  addSavings,
  deleteSavings,
  updateSavingsBalance,
  transferBetweenSavings,
} from '../../application/use-cases/savings/ManageSavings'
import { openModal, getModalBody } from '../components/Modal'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import { validateName, validateAmount } from '../utils/validators'

const TYPE_LABELS: Record<string, string> = {
  bank:      '🏦 Banco',
  digital:   '📱 Carteira Digital',
  piggybank: '🐷 Cofrinho',
}

export async function renderSavings(
  container: HTMLElement,
  savingsRepo:  ISavingsRepository,
  txRepo:       ITransactionRepository,
  accountRepo?: IAccountRepository
): Promise<void> {
  let accounts: Account[] = []

  async function render() {
    container.innerHTML = ''
    const all   = await savingsRepo.getAll()
    accounts    = accountRepo ? await accountRepo.getAll() : []
    const total = all.reduce((s, v) => s + v.balance, 0)

    // Header
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-lg font-bold text-muted">Cofrinhos</h1>
        <button id="add-sav-btn" class="btn-primary text-sm px-3 py-2">+ Novo</button>
      </div>
      <div class="card mb-4">
        <div class="text-subtle text-xs mb-1">Total guardado</div>
        <div class="text-3xl font-bold text-primary">${formatCurrency(total)}</div>
      </div>
      <div id="sav-list"></div>
    `

    document.getElementById('add-sav-btn')?.addEventListener('click', () => openAddModal())

    const list = document.getElementById('sav-list')!

    if (all.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="empty-icon">🐷</span><p class="empty-text">Nenhum cofrinho cadastrado</p></div>`
      return
    }

    for (const sav of all) {
      const el = document.createElement('div')
      el.className = 'card mb-3'
      el.innerHTML = `
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style="background:${sav.color}22; border:2px solid ${sav.color}">
            ${sav.type === 'bank' ? '🏦' : sav.type === 'digital' ? '📱' : '🐷'}
          </div>
          <div class="flex-1">
            <div class="font-semibold text-muted">${sav.name}</div>
            <div class="text-xs text-subtle">${TYPE_LABELS[sav.type] ?? sav.type}</div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-muted">${formatCurrency(sav.balance)}</div>
            <button class="text-xs text-danger hover:text-red-400 mt-1" data-del="${sav.id}">Excluir</button>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-outline flex-1 text-xs py-2" data-deposit="${sav.id}">+ Depositar</button>
          <button class="btn-ghost flex-1 text-xs py-2" data-withdraw="${sav.id}">− Retirar</button>
          ${all.length > 1 ? `<button class="btn-ghost flex-1 text-xs py-2" data-transfer="${sav.id}">↔ Transferir</button>` : ''}
        </div>
      `

      el.querySelector(`[data-del="${sav.id}"]`)?.addEventListener('click', () => {
        openModal({
          title: `Excluir ${sav.name}?`,
          content: `<p class="text-sm text-subtle">O saldo de ${formatCurrency(sav.balance)} será perdido. Esta ação não pode ser desfeita.</p>`,
          danger: true,
          confirmLabel: 'Excluir',
          onConfirm: async () => { await deleteSavings(savingsRepo, sav.id); showToast('Cofrinho removido', 'success'); await render() },
        })
      })

      el.querySelector(`[data-deposit="${sav.id}"]`)?.addEventListener('click', () => openAmountModal(sav, 'deposit'))
      el.querySelector(`[data-withdraw="${sav.id}"]`)?.addEventListener('click', () => openAmountModal(sav, 'withdraw'))
      el.querySelector(`[data-transfer="${sav.id}"]`)?.addEventListener('click', () => openTransferModal(sav, all))

      list.appendChild(el)
    }
  }

  function openAddModal() {
    const accountOptions = accounts.length > 0
      ? `<div>
           <label class="form-label">Banco de origem</label>
           <select id="s-account" class="select">
             <option value="">— nenhum —</option>
             ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
           </select>
         </div>`
      : ''

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
          ${accountOptions}
        </div>
      `,
      confirmLabel: 'Criar',
      onConfirm: async () => {
        const body      = getModalBody()!
        const name      = (body.querySelector('#s-name')    as HTMLInputElement).value.trim()
        const type      = (body.querySelector('#s-type')    as HTMLSelectElement).value as 'bank' | 'digital' | 'piggybank'
        const balance   = parseFloat((body.querySelector('#s-balance') as HTMLInputElement).value) || 0
        const accountId = (body.querySelector('#s-account') as HTMLSelectElement)?.value || undefined

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
