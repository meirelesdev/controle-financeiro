import { listTransactions } from '../../application/use-cases/transactions/ListTransactions';
import { addTransaction } from '../../application/use-cases/transactions/AddTransaction';
import { updateTransaction } from '../../application/use-cases/transactions/UpdateTransaction';
import { deleteTransaction } from '../../application/use-cases/transactions/DeleteTransaction';
import { getCategoriesForType } from '../../domain/constants/Categories';
import { renderMonthPicker } from '../components/MonthPicker';
import { renderTransactionCard } from '../components/TransactionCard';
import { openModal, getModalBody } from '../components/Modal';
import { showToast } from '../components/Toast';
import { formatLongDate, getCurrentYearMonth, todayISO } from '../utils/formatters';
import { validateAmount, validateDescription, validateDate } from '../utils/validators';
export async function renderTransactions(container, txRepo, cardRepo) {
    let { year, month } = getCurrentYearMonth();
    let filterType = '';
    async function renderList() {
        const listEl = document.getElementById('tx-list');
        if (!listEl)
            return;
        const txs = await listTransactions(txRepo, {
            year, month,
            type: filterType || undefined,
        });
        listEl.innerHTML = '';
        if (txs.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><p class="empty-text">Nenhuma transação este mês</p></div>`;
            return;
        }
        // Agrupar por data
        const grouped = new Map();
        for (const t of txs) {
            const arr = grouped.get(t.date) ?? [];
            arr.push(t);
            grouped.set(t.date, arr);
        }
        for (const [date, group] of grouped) {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'text-xs font-semibold text-subtle uppercase tracking-wider mt-4 mb-2 first:mt-0';
            dateHeader.textContent = formatLongDate(date);
            listEl.appendChild(dateHeader);
            for (const t of group) {
                listEl.appendChild(renderTransactionCard(t, async (id) => {
                    await deleteTransaction(txRepo, id);
                    showToast('Transação removida', 'success');
                    await renderList();
                }, (tx) => openTransactionModal(tx)));
            }
        }
    }
    async function openTransactionModal(existing) {
        const cards = await cardRepo.getAll();
        const isEdit = !!existing;
        const today = existing?.date ?? todayISO();
        openModal({
            title: isEdit ? 'Editar Transação' : 'Nova Transação',
            content: `
        <div class="space-y-3">
          <div>
            <label class="form-label">Tipo</label>
            <select id="f-type" class="select">
              <option value="expense" ${existing?.type === 'expense' || !existing ? 'selected' : ''}>Saída</option>
              <option value="income"  ${existing?.type === 'income' ? 'selected' : ''}>Entrada</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="f-status" class="select">
              <option value="confirmado" ${existing?.status !== 'pendente' ? 'selected' : ''}>Confirmado</option>
              <option value="pendente"   ${existing?.status === 'pendente' ? 'selected' : ''}>Pendente</option>
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
          <div>
            <label class="form-label">Pagamento</label>
            <select id="f-method" class="select">
              <option value="cash" ${existing?.paymentMethod !== 'card' ? 'selected' : ''}>Dinheiro/Pix/Débito</option>
              <option value="card" ${existing?.paymentMethod === 'card' ? 'selected' : ''}>Cartão de Crédito</option>
            </select>
          </div>
          <div id="f-card-wrap" class="hidden">
            <label class="form-label">Cartão</label>
            <select id="f-card" class="select">
              ${cards.map(c => `<option value="${c.id}" ${c.id === existing?.cardId ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
            confirmLabel: isEdit ? 'Salvar' : 'Adicionar',
            onConfirm: async () => {
                const body = getModalBody();
                const type = body.querySelector('#f-type').value;
                const status = body.querySelector('#f-status').value;
                const amount = parseFloat(body.querySelector('#f-amount').value);
                const desc = body.querySelector('#f-desc').value.trim();
                const cat = body.querySelector('#f-cat').value;
                const date = body.querySelector('#f-date').value;
                const method = body.querySelector('#f-method').value;
                const cardId = method === 'card' ? body.querySelector('#f-card')?.value : undefined;
                const amtErr = validateAmount(amount);
                const descErr = validateDescription(desc);
                const dateErr = validateDate(date);
                if (amtErr || descErr || dateErr) {
                    showToast(amtErr ?? descErr ?? dateErr ?? 'Erro de validação', 'error');
                    return;
                }
                if (isEdit && existing) {
                    await updateTransaction(txRepo, existing.id, { type, status, amount, description: desc, category: cat, date, paymentMethod: method, cardId });
                    showToast('Transação atualizada', 'success');
                }
                else {
                    await addTransaction(txRepo, { type, status, amount, description: desc, category: cat, date, paymentMethod: method, cardId });
                    showToast('Transação adicionada', 'success');
                }
                await renderList();
            },
        });
        // Populate categories and bind dynamic behaviour
        const body = getModalBody();
        if (!body)
            return;
        function updateCategories() {
            const rawType = body.querySelector('#f-type').value;
            const catSel = body.querySelector('#f-cat');
            const cats = getCategoriesForType(rawType === 'transfer' ? 'expense' : rawType);
            catSel.innerHTML = cats.map(c => `<option value="${c.id}" ${c.id === existing?.category ? 'selected' : ''}>${c.emoji} ${c.label}</option>`).join('');
        }
        function updateCardVisibility() {
            const method = body.querySelector('#f-method').value;
            const wrap = body.querySelector('#f-card-wrap');
            wrap.classList.toggle('hidden', method !== 'card');
        }
        body.querySelector('#f-type')?.addEventListener('change', updateCategories);
        body.querySelector('#f-method')?.addEventListener('change', updateCardVisibility);
        updateCategories();
        updateCardVisibility();
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
  `;
    document.getElementById('month-picker-wrap').appendChild(renderMonthPicker({ year, month, onChange: (y, m) => { year = y; month = m; renderList(); } }));
    document.getElementById('filter-type').addEventListener('change', (e) => {
        filterType = e.target.value;
        renderList();
    });
    // FAB
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.textContent = '+';
    fab.setAttribute('aria-label', 'Nova transação');
    fab.addEventListener('click', () => openTransactionModal());
    document.querySelector('.app-container')?.appendChild(fab);
    await renderList();
}
