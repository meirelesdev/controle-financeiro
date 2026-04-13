import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository'
import type { ICreditCardRepository }  from '../../domain/repositories/ICreditCardRepository'
import type { ISavingsRepository }      from '../../domain/repositories/ISavingsRepository'
import type { IAccountRepository }      from '../../domain/repositories/IAccountRepository'
import {
  computeMonthlySummary,
  computeMonthlyHistory,
  computeCardBill,
  selectAccountBalance,
} from '../../domain/services/SummaryService'
import { EXPENSE_CATEGORIES } from '../../domain/constants/Categories'
import { formatCurrency, formatMonthYear, getCurrentYearMonth, formatMonthShort } from '../utils/formatters'
import { renderMonthPicker } from '../components/MonthPicker'
import { openTransactionModal } from '../components/TransactionModal'
import { navigate } from '../router'
import Chart from 'chart.js/auto'

let chartPie: Chart | null = null
let chartBar: Chart | null = null

export async function renderDashboard(
  container: HTMLElement,
  txRepo:      ITransactionRepository,
  cardRepo:    ICreditCardRepository,
  savingsRepo: ISavingsRepository,
  accountRepo: IAccountRepository
): Promise<void> {
  let { year, month } = getCurrentYearMonth()

  async function render() {
    container.innerHTML = ''

    const transactions = await txRepo.getAll()
    const monthTx      = await txRepo.getByMonth(year, month)
    const cards        = await cardRepo.getAll()
    const savings      = await savingsRepo.getAll()
    const accounts     = await accountRepo.getAll()

    const summary      = computeMonthlySummary(monthTx, transactions, year, month)
    const history      = computeMonthlyHistory(transactions, 6)
    const totalSavings = savings.reduce((s, sv) => s + sv.balance, 0)

    // Patrimônio: saldo de cada conta calculado por event sourcing
    const accountsWithBalance = accounts.map(a => ({
      account: a,
      balance: selectAccountBalance(a, transactions, savings),
    }))
    const totalAccountBalance = accountsWithBalance.reduce((s, x) => s + x.balance, 0)

    // Fallback para quando não há contas cadastradas: usa saldo histórico de transações confirmadas
    const allTimeBalance = accounts.length > 0
      ? totalAccountBalance
      : transactions
          .filter(t => (t.status === 'confirmado' || t.status === 'pago') && t.type !== 'transfer')
          .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

    const patrimonio = accounts.length > 0
      ? totalAccountBalance
      : allTimeBalance + totalSavings

    // ── Header ──────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'flex items-center justify-between mb-4'
    header.innerHTML = `<h1 class="text-lg font-bold text-muted capitalize">Dashboard</h1>`
    const picker = renderMonthPicker({ year, month, onChange: (y, m) => { year = y; month = m; render() } })
    header.appendChild(picker)
    container.appendChild(header)

    // ── Botões de lançamento rápido ──────────────────────────
    const quickActions = document.createElement('div')
    quickActions.className = 'grid grid-cols-2 gap-3 mb-4'
    quickActions.innerHTML = `
      <button id="btn-quick-income"
        class="flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm
               border border-primary text-income bg-bg-hover active:scale-95 transition-transform cursor-pointer">
        <span class="text-lg leading-none">+</span> Receita
      </button>
      <button id="btn-quick-expense"
        class="flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm
               border border-danger text-expense bg-bg-hover active:scale-95 transition-transform cursor-pointer">
        <span class="text-lg leading-none">+</span> Despesa
      </button>
    `
    container.appendChild(quickActions)

    document.getElementById('btn-quick-income')?.addEventListener('click', () =>
      openTransactionModal(txRepo, cardRepo, render, { initialType: 'income' }, accountRepo)
    )
    document.getElementById('btn-quick-expense')?.addEventListener('click', () =>
      openTransactionModal(txRepo, cardRepo, render, { initialType: 'expense' }, accountRepo)
    )

    // ── Bancos ───────────────────────────────────────────────
    const bankSection = document.createElement('div')
    bankSection.className = 'mb-4'
    bankSection.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="section-title mb-0">Minhas Contas</div>
        <button id="btn-manage-accounts" class="btn-ghost text-xs px-2 py-1">Gerenciar →</button>
      </div>
    `

    if (accountsWithBalance.length === 0) {
      bankSection.innerHTML += `
        <div class="card-sm text-center py-4 space-y-2">
          <p class="text-sm text-subtle">Nenhum banco cadastrado ainda.</p>
          <button id="btn-setup-accounts" class="btn-primary text-sm px-4 py-2">
            🏦 Configurar bancos
          </button>
        </div>
      `
    } else {
      const bankGrid = document.createElement('div')
      bankGrid.className = 'space-y-2'

      accountsWithBalance.forEach(({ account, balance }) => {
        const linkedSav = savings.filter(s => s.accountId === account.id)
        const savTotal  = linkedSav.reduce((s, sv) => s + sv.balance, 0)

        const row = document.createElement('div')
        row.className = 'card-sm flex items-center gap-3'
        row.innerHTML = `
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
               style="background:${account.color}22; border:2px solid ${account.color}">🏦</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-muted">${account.name}</div>
            ${savTotal > 0 ? `<div class="text-xs text-subtle">Cofrinhos: ${formatCurrency(savTotal)}</div>` : ''}
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-bold ${balance >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(balance)}</div>
          </div>
        `
        bankGrid.appendChild(row)
      })

      bankSection.appendChild(bankGrid)

      const totalRow = document.createElement('div')
      totalRow.className = 'card-sm mt-2 flex justify-between items-center'
      totalRow.innerHTML = `
        <span class="text-xs text-subtle">Total consolidado</span>
        <span class="text-sm font-bold ${patrimonio >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(patrimonio)}</span>
      `
      bankSection.appendChild(totalRow)
    }

    bankSection.querySelector('#btn-manage-accounts')?.addEventListener('click', () => navigate('accounts'))
    bankSection.querySelector('#btn-setup-accounts')?.addEventListener('click',  () => navigate('accounts'))
    container.appendChild(bankSection)

    // ── Cards de saldo mensal ────────────────────────────────
    const grid = document.createElement('div')
    grid.className = 'grid grid-cols-2 gap-3 mb-4'
    grid.innerHTML = `
      <div class="summary-card">
        <div class="summary-label">Entradas (${formatMonthYear(year, month)})</div>
        <div class="summary-value text-income">${formatCurrency(summary.totalIncome)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Saídas (${formatMonthYear(year, month)})</div>
        <div class="summary-value text-expense">${formatCurrency(summary.totalExpense)}</div>
      </div>
      ${summary.pendingCount > 0 || summary.openingBalance !== 0 ? `
        <div class="summary-card col-span-2">
          <div class="summary-label">Saldo do mês (confirmado)</div>
          <div class="summary-value ${summary.saldoReal >= 0 ? 'text-income' : 'text-expense'}">
            ${formatCurrency(summary.saldoReal)}
          </div>
          <div class="text-xs text-subtle mt-1 space-y-0.5">
            ${summary.pendingCount > 0 ? `
              <div>Projetado: <span class="${summary.saldoProjetado >= 0 ? 'text-income' : 'text-expense'} font-medium">${formatCurrency(summary.saldoProjetado)}</span>
              <span class="badge-pending ml-1">${summary.pendingCount} pendentes</span></div>
            ` : ''}
            ${summary.openingBalance !== 0 ? `
              <div>Carryover: <span class="text-muted font-medium">${formatCurrency(summary.openingBalance)}</span>
              → Acumulado: <span class="${summary.saldoAcumulado >= 0 ? 'text-income' : 'text-expense'} font-medium">${formatCurrency(summary.saldoAcumulado)}</span></div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `
    container.appendChild(grid)

    // ── Gráfico pizza — gastos por categoria ─────────────────
    const hasExpenses = Object.keys(summary.byCategory).length > 0
    if (hasExpenses) {
      const catSection = document.createElement('div')
      catSection.className = 'card mb-4'
      catSection.innerHTML = `
        <div class="section-title">Gastos por categoria</div>
        <div class="relative h-52"><canvas id="chart-pie"></canvas></div>
      `
      container.appendChild(catSection)

      await new Promise(r => setTimeout(r, 0))
      const pieCtx = (document.getElementById('chart-pie') as HTMLCanvasElement)?.getContext('2d')
      if (pieCtx) {
        chartPie?.destroy()
        const labels = Object.keys(summary.byCategory).map(id => {
          const c = EXPENSE_CATEGORIES.find(e => e.id === id)
          return `${c?.emoji ?? '📌'} ${c?.label ?? id}`
        })
        chartPie = new Chart(pieCtx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data:            Object.values(summary.byCategory),
              backgroundColor: ['#00C853','#1565C0','#F9A825','#8B5CF6','#EC4899','#EF4444','#10B981','#3B82F6','#F59E0B','#6366F1','#94A3B8'],
              borderWidth:     0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#F5F5F5', font: { size: 11 }, boxWidth: 12 } },
              tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed as number)}` } },
            },
          },
        })
      }
    }

    // ── Gráfico barras — histórico 6 meses ───────────────────
    const barSection = document.createElement('div')
    barSection.className = 'card mb-4'
    barSection.innerHTML = `
      <div class="section-title">Histórico 6 meses</div>
      <div class="relative h-44"><canvas id="chart-bar"></canvas></div>
    `
    container.appendChild(barSection)

    await new Promise(r => setTimeout(r, 0))
    const barCtx = (document.getElementById('chart-bar') as HTMLCanvasElement)?.getContext('2d')
    if (barCtx) {
      chartBar?.destroy()
      chartBar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels:   history.map(h => formatMonthShort(h.month)),
          datasets: [
            { label: 'Entradas', data: history.map(h => h.totalIncome),  backgroundColor: '#00C853' },
            { label: 'Saídas',   data: history.map(h => h.totalExpense), backgroundColor: '#E53935' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#F5F5F5', font: { size: 11 } } } },
          scales: {
            x: { ticks: { color: '#94A3B8' }, grid: { color: '#1F2B47' } },
            y: { ticks: { color: '#94A3B8', callback: (v) => `R$${Number(v)/1000}k` }, grid: { color: '#1F2B47' } },
          },
        },
      })
    }

    // ── Resumo cartões ───────────────────────────────────────
    if (cards.length > 0) {
      const cardSection = document.createElement('div')
      cardSection.className = 'mb-4'
      cardSection.innerHTML = `<div class="section-title">Cartões de crédito</div>`
      cards.forEach(card => {
        const bill = computeCardBill(card, transactions, year, month)
        const pct  = card.limit > 0 ? (bill / card.limit) * 100 : 0
        const div  = document.createElement('div')
        div.className = 'card-sm mb-2'
        div.innerHTML = `
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background:${card.color}"></div>
              <span class="text-sm font-medium text-muted">${card.name}</span>
            </div>
            <span class="text-sm font-bold text-expense">${formatCurrency(bill)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct > 80 ? '#E53935' : card.color}"></div>
          </div>
          <div class="text-xs text-subtle mt-1">${Math.round(pct)}% do limite · vence dia ${card.dueDay}</div>
        `
        cardSection.appendChild(div)
      })
      container.appendChild(cardSection)
    }

    // ── Cofrinhos (sem conta vinculada ou quando não há contas) ─
    const unlinkedSavings = accounts.length > 0
      ? savings.filter(s => !s.accountId)
      : savings

    if (unlinkedSavings.length > 0) {
      const savSection = document.createElement('div')
      savSection.className = 'mb-4'
      const sectionTitle = accounts.length > 0 ? 'Cofrinhos sem conta' : 'Cofrinhos / Poupança'
      const sectionTotal = unlinkedSavings.reduce((s, sv) => s + sv.balance, 0)
      savSection.innerHTML = `
        <div class="section-title">${sectionTitle}</div>
        <div class="card-sm">
          <div class="text-subtle text-xs mb-2">Total guardado</div>
          <div class="text-2xl font-bold text-primary">${formatCurrency(sectionTotal)}</div>
          <div class="divider"></div>
          ${unlinkedSavings.map(s => `
            <div class="flex justify-between items-center py-1.5">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background:${s.color}"></div>
                <span class="text-sm text-muted">${s.name}</span>
              </div>
              <span class="text-sm font-semibold text-muted">${formatCurrency(s.balance)}</span>
            </div>
          `).join('')}
        </div>
      `
      container.appendChild(savSection)
    }
  }

  await render()
}
