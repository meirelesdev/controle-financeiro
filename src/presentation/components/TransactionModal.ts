import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { IAccountRepository }     from '../../domain/repositories/IAccountRepository'
import type { Transaction, TransactionType, TransactionStatus } from '../../domain/entities/Transaction'
import { addTransaction, addInstallmentGroup } from '../../application/use-cases/transactions/AddTransaction'
import { updateTransaction } from '../../application/use-cases/transactions/UpdateTransaction'
import { getEffectiveCategories } from '../../application/use-cases/categories/ManageCategories'
import { openModal, getModalBody } from './Modal'
import { showToast } from './Toast'
import { todayISO, formatCurrency } from '../utils/formatters'
import { validateAmount, validateDescription, validateDate } from '../utils/validators'

export interface TransactionModalOptions {
  existing?:    Transaction
  initialType?: 'income' | 'expense'
}

export async function openTransactionModal(
  txRepo:      ITransactionRepository,
  cardRepo:    ICreditCardRepository,
  onSuccess:   () => void | Promise<void>,
  options:     TransactionModalOptions = {},
  accountRepo?: IAccountRepository
): Promise<void> {
  const { existing, initialType } = options
  const preType = (existing?.type === 'income' || existing?.type === 'expense')
    ? existing.type
    : (initialType ?? 'expense')
  const cards    = await cardRepo.getAll()
  const accounts = accountRepo ? await accountRepo.getAll() : []
  const isEdit   = !!existing
  const today    = existing?.date ?? todayISO()
  const isPago   = existing?.status === 'pago'

  openModal({
    title: isEdit ? 'Editar Transação' : 'Nova Transação',
    content: `
      <div class="space-y-3">
        <div>
          <label class="form-label">Tipo</label>
          <select id="f-type" class="select">
            <option value="expense" ${preType === 'expense' ? 'selected' : ''}>Saída</option>
            <option value="income"  ${preType === 'income'  ? 'selected' : ''}>Entrada</option>
          </select>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select id="f-status" class="select">
            <option value="confirmado" ${!existing || existing.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
            <option value="pendente"   ${existing?.status === 'pendente'   ? 'selected' : ''}>Pendente</option>
            <option value="pago"       ${existing?.status === 'pago'       ? 'selected' : ''}>Pago</option>
          </select>
        </div>
        <div>
          <label class="form-label">Valor (R$)</label>
          <input id="f-amount" type="number" min="0.01" step="0.01" class="input"
            value="${existing?.amount ?? ''}" placeholder="0,00">
        </div>
        <div>
          <label class="form-label">Descrição</label>
          <input id="f-desc" type="text" class="input"
            value="${existing?.description ?? ''}" placeholder="Ex: Supermercado">
        </div>
        <div>
          <label class="form-label">Categoria</label>
          <select id="f-cat" class="select"></select>
        </div>
        <div>
          <label class="form-label">Data</label>
          <input id="f-date" type="date" class="input" value="${today}">
        </div>
        <div id="f-method-wrap">
          <label class="form-label">Pagamento</label>
          <select id="f-method" class="select">
            <option value="cash" ${existing?.paymentMethod !== 'card' ? 'selected' : ''}>Dinheiro / Pix / Débito</option>
            <option value="card" ${existing?.paymentMethod === 'card' ? 'selected' : ''}>Cartão de Crédito</option>
          </select>
        </div>
        <div id="f-card-wrap" class="hidden">
          <label class="form-label">Cartão</label>
          <select id="f-card" class="select">
            ${cards.map(c => `<option value="${c.id}" ${c.id === existing?.cardId ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div id="f-installments-wrap" class="hidden">
          <label class="form-label">Número de Parcelas</label>
          <input id="f-installments" type="number" min="1" max="48" step="1"
            class="input" value="1" placeholder="1">
          <div id="f-installments-preview" class="hidden mt-1.5 text-xs font-medium text-primary"></div>
        </div>
        ${accounts.length > 0 ? `
        <div id="f-account-wrap">
          <label class="form-label">Conta Bancária</label>
          <select id="f-account" class="select">
            <option value="">— nenhuma —</option>
            ${accounts.map(a => `<option value="${a.id}" ${a.id === existing?.accountId ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        ` : ''}
        <div id="f-paid-wrap" class="hidden space-y-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input id="f-paid-check" type="checkbox" class="w-4 h-4 accent-primary"
              ${isPago ? 'checked' : ''}>
            <span class="text-sm text-muted font-medium">Marcar como Pago</span>
          </label>
          <div id="f-payment-date-wrap" class="${isPago ? '' : 'hidden'}">
            <label class="form-label">Data de Pagamento</label>
            <input id="f-payment-date" type="date" class="input"
              value="${existing?.paymentDate ?? todayISO()}">
          </div>
        </div>
      </div>
    `,
    confirmLabel: isEdit ? 'Salvar' : 'Adicionar',
    onConfirm: async () => {
      const body         = getModalBody()!
      const type         = (body.querySelector('#f-type')   as HTMLSelectElement).value as TransactionType
      const amount       = parseFloat((body.querySelector('#f-amount') as HTMLInputElement).value)
      const desc         = (body.querySelector('#f-desc')   as HTMLInputElement).value.trim()
      const cat          = (body.querySelector('#f-cat')    as HTMLSelectElement).value
      const date         = (body.querySelector('#f-date')   as HTMLInputElement).value
      const method       = (body.querySelector('#f-method') as HTMLSelectElement).value as 'cash' | 'card'
      const cardId       = method === 'card'
        ? (body.querySelector('#f-card') as HTMLSelectElement)?.value
        : undefined
      const accountId    = (body.querySelector('#f-account') as HTMLSelectElement)?.value || undefined

      // status: o checkbox "Marcar como Pago" sobrepõe o select quando marcado
      const paidChecked  = (body.querySelector('#f-paid-check') as HTMLInputElement)?.checked ?? false
      const statusSelect = (body.querySelector('#f-status') as HTMLSelectElement).value as TransactionStatus
      const status: TransactionStatus = paidChecked ? 'pago' : statusSelect
      const paymentDate  = paidChecked
        ? ((body.querySelector('#f-payment-date') as HTMLInputElement)?.value || todayISO())
        : undefined

      const installments = !isEdit && method === 'card'
        ? Math.max(1, parseInt((body.querySelector('#f-installments') as HTMLInputElement)?.value) || 1)
        : 1

      const amtErr  = validateAmount(amount)
      const descErr = validateDescription(desc)
      const dateErr = validateDate(date)
      if (amtErr || descErr || dateErr) {
        showToast(amtErr ?? descErr ?? dateErr ?? 'Erro de validação', 'error')
        return false
      }

      if (isEdit && existing) {
        await updateTransaction(txRepo, existing.id, {
          type, status, amount, description: desc, category: cat, date,
          paymentMethod: method, cardId, accountId, paymentDate,
        })
        showToast('Transação atualizada', 'success')
      } else if (installments > 1) {
        await addInstallmentGroup(txRepo, {
          type, status, amount, description: desc, category: cat, date,
          paymentMethod: method, cardId, installments,
        })
        showToast(`${installments} parcelas criadas`, 'success')
      } else {
        await addTransaction(txRepo, {
          type, status, amount, description: desc, category: cat, date,
          paymentMethod: method, cardId, accountId, paymentDate,
        })
        showToast('Transação adicionada', 'success')
      }
      await onSuccess()
    },
  })

  const body = getModalBody()
  if (!body) return

  async function updateCategories() {
    const rawType = (body!.querySelector('#f-type') as HTMLSelectElement).value as 'income' | 'expense'
    const catSel  = body!.querySelector('#f-cat') as HTMLSelectElement
    const cats    = await getEffectiveCategories(rawType)
    catSel.innerHTML = cats
      .map(c => `<option value="${c.id}" ${c.id === existing?.category ? 'selected' : ''}>${c.emoji} ${c.label}</option>`)
      .join('')
  }

  function updateInstallmentsPreview() {
    const preview      = body!.querySelector('#f-installments-preview') as HTMLElement
    const installments = Math.max(1, parseInt((body!.querySelector('#f-installments') as HTMLInputElement)?.value) || 1)
    const amount       = parseFloat((body!.querySelector('#f-amount') as HTMLInputElement).value) || 0
    if (installments > 1 && amount > 0) {
      const per = Math.round((amount / installments) * 100) / 100
      preview.textContent = `Serão criadas ${installments} parcelas de ${formatCurrency(per)} cada`
      preview.classList.remove('hidden')
    } else {
      preview.classList.add('hidden')
    }
  }

  function updatePaymentVisibility() {
    const rawType     = (body!.querySelector('#f-type')   as HTMLSelectElement).value
    const method      = (body!.querySelector('#f-method') as HTMLSelectElement).value
    const methodWrap  = body!.querySelector('#f-method-wrap')      as HTMLElement
    const cardWrap    = body!.querySelector('#f-card-wrap')        as HTMLElement
    const installWrap = body!.querySelector('#f-installments-wrap') as HTMLElement
    const paidWrap    = body!.querySelector('#f-paid-wrap')        as HTMLElement

    methodWrap.classList.toggle('hidden', rawType === 'income')
    cardWrap.classList.toggle('hidden',   method !== 'card' || rawType === 'income')

    // Parcelas: apenas novos lançamentos no cartão
    const showInstall = !isEdit && method === 'card' && rawType !== 'income'
    installWrap.classList.toggle('hidden', !showInstall)
    if (!showInstall) {
      const input = body!.querySelector('#f-installments') as HTMLInputElement
      if (input) input.value = '1'
      ;(body!.querySelector('#f-installments-preview') as HTMLElement)?.classList.add('hidden')
    } else {
      updateInstallmentsPreview()
    }

    // Marcar como Pago: apenas para despesas
    paidWrap?.classList.toggle('hidden', rawType === 'income')
  }

  function syncPaidCheckbox() {
    const checked      = (body!.querySelector('#f-paid-check') as HTMLInputElement)?.checked
    const statusSelect = body!.querySelector('#f-status') as HTMLSelectElement
    const dateWrap     = body!.querySelector('#f-payment-date-wrap') as HTMLElement

    if (checked) {
      statusSelect.value = 'pago'
      dateWrap?.classList.remove('hidden')
    } else {
      if (statusSelect.value === 'pago') statusSelect.value = 'confirmado'
      dateWrap?.classList.add('hidden')
    }
  }

  function syncStatusSelect() {
    const status      = (body!.querySelector('#f-status') as HTMLSelectElement).value
    const paidCheck   = body!.querySelector('#f-paid-check') as HTMLInputElement
    const dateWrap    = body!.querySelector('#f-payment-date-wrap') as HTMLElement
    if (!paidCheck) return

    if (status === 'pago') {
      paidCheck.checked = true
      dateWrap?.classList.remove('hidden')
    } else {
      paidCheck.checked = false
      dateWrap?.classList.add('hidden')
    }
  }

  function syncCardToAccount() {
    const cardSel    = body!.querySelector('#f-card')    as HTMLSelectElement | null
    const accountSel = body!.querySelector('#f-account') as HTMLSelectElement | null
    if (!cardSel || !accountSel) return
    const selectedCard = cards.find(c => c.id === cardSel.value)
    if (selectedCard?.accountId) accountSel.value = selectedCard.accountId
  }

  body.querySelector('#f-type')?.addEventListener('change', async () => {
    await updateCategories()
    updatePaymentVisibility()
  })
  body.querySelector('#f-method')?.addEventListener('change', () => {
    updatePaymentVisibility()
    syncCardToAccount()
  })
  body.querySelector('#f-card')?.addEventListener('change', syncCardToAccount)
  body.querySelector('#f-installments')?.addEventListener('input', updateInstallmentsPreview)
  body.querySelector('#f-amount')?.addEventListener('input', updateInstallmentsPreview)
  body.querySelector('#f-paid-check')?.addEventListener('change', syncPaidCheckbox)
  body.querySelector('#f-status')?.addEventListener('change', syncStatusSelect)

  await updateCategories()
  updatePaymentVisibility()
}
