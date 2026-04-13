import type { IAccountRepository }     from '../../domain/repositories/IAccountRepository'
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { ISavingsRepository }      from '../../domain/repositories/ISavingsRepository'
import type { Account } from '../../domain/entities/Account'
import { addAccount } from '../../application/use-cases/accounts/ManageAccounts'
import { selectAccountBalance } from '../../domain/services/SummaryService'
import { openModal, getModalBody } from '../components/Modal'
import { showToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatters'
import { navigateTo } from '../router'

export async function renderAccounts(
  container: HTMLElement,
  accountRepo: IAccountRepository,
  txRepo:      ITransactionRepository,
  cardRepo:    ICreditCardRepository,
  savingsRepo: ISavingsRepository
): Promise<void> {

  async function render() {
    container.innerHTML = ''

    const accounts     = await accountRepo.getAll()
    const transactions = await txRepo.getAll()
    const cards        = await cardRepo.getAll()
    const savings      = await savingsRepo.getAll()

    // ── Header ──────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'flex items-center justify-between mb-4'
    header.innerHTML = `
      <h1 class="text-lg font-bold text-muted">Bancos</h1>
      <button id="btn-add-account" class="btn-primary text-sm px-3 py-2">+ Novo</button>
    `
    container.appendChild(header)
    header.querySelector('#btn-add-account')?.addEventListener('click', () => openAccountModal())

    if (accounts.length === 0) {
      const empty = document.createElement('div')
      empty.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏦</span>
          <p class="empty-text">Nenhum banco cadastrado</p>
          <p class="text-xs text-subtle mt-1 mb-4">Adicione seus bancos para acompanhar o saldo em tempo real por event sourcing.</p>
          <button id="btn-first-account" class="btn-primary">Adicionar banco</button>
        </div>
      `
      container.appendChild(empty)
      empty.querySelector('#btn-first-account')?.addEventListener('click', () => openAccountModal())
      return
    }

    // ── Total consolidado ────────────────────────────────────
    const total = accounts.reduce(
      (sum, a) => sum + selectAccountBalance(a, transactions, savings),
      0
    )
    const totalCard = document.createElement('div')
    totalCard.className = 'card mb-4'
    totalCard.innerHTML = `
      <div class="text-subtle text-xs mb-1">Patrimônio consolidado</div>
      <div class="text-3xl font-bold ${total >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(total)}</div>
      <div class="text-xs text-subtle mt-1">${accounts.length} banco${accounts.length !== 1 ? 's' : ''} cadastrado${accounts.length !== 1 ? 's' : ''}</div>
    `
    container.appendChild(totalCard)

    // ── Lista de bancos ──────────────────────────────────────
    for (const account of accounts) {
      const balance      = selectAccountBalance(account, transactions, savings)
      const linkedCards  = cards.filter(c => c.accountId === account.id)
      const linkedSavs   = savings.filter(s => s.accountId === account.id)
      const savingsTotal = linkedSavs.reduce((s, sv) => s + sv.balance, 0)
      const txBalance    = balance - savingsTotal  // saldo da conta sem cofrinhos

      const el = document.createElement('div')
      el.className = 'card mb-3 cursor-pointer active:scale-[0.99] transition-transform'
      el.innerHTML = `
        <!-- Cabeçalho do banco -->
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
               style="background:${account.color}22; border:2px solid ${account.color}">🏦</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-muted">${account.name}</div>
            <div class="text-xs text-subtle">
              ${linkedCards.length} ${linkedCards.length === 1 ? 'cartão' : 'cartões'}
              · ${linkedSavs.length} cofrinho${linkedSavs.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-xl font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(balance)}</div>
            <div class="text-xs text-subtle">saldo atual</div>
          </div>
        </div>
        <div class="flex items-center justify-end">
          <span class="text-xs text-primary font-medium">Ver detalhes →</span>
        </div>
      `

      el.addEventListener('click', () => navigateTo('bank', account.id))

      container.appendChild(el)
    }
  }

  function openAccountModal() {
    openModal({
      title: 'Novo Banco',
      content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Nome do banco *</label>
            <input id="acc-name" type="text" class="input"
              value="" placeholder="Ex: Nubank, Itaú, C6">
          </div>
          <div>
            <label class="form-label">Saldo inicial (R$) *</label>
            <input id="acc-initial" type="number" step="0.01" class="input"
              value="0" placeholder="0,00">
            <p class="text-xs text-subtle mt-1">
              Valor que havia na conta no momento do cadastro.
              O saldo atual é calculado automaticamente a partir das transações.
            </p>
          </div>
          <div>
            <label class="form-label">Cor</label>
            <input id="acc-color" type="color" class="input h-10 cursor-pointer"
              value="#3B82F6">
          </div>
        </div>
      `,
      confirmLabel: 'Criar banco',
      onConfirm: async () => {
        const body    = getModalBody()!
        const name    = (body.querySelector('#acc-name')    as HTMLInputElement).value.trim()
        const initial = parseFloat((body.querySelector('#acc-initial') as HTMLInputElement).value)
        const color   = (body.querySelector('#acc-color')   as HTMLInputElement).value

        if (!name) { showToast('Informe o nome do banco', 'error'); return false }

        await addAccount(accountRepo, {
          name,
          color,
          initialBalance: isNaN(initial) ? 0 : initial,
        })
        showToast('Banco criado', 'success')
        await render()
      },
    })
  }

  await render()
}
