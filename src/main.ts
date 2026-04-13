import './style.css'
import { getDB } from './infrastructure/database/DatabaseHelper'
import { IdbTransactionRepository } from './infrastructure/repositories/IdbTransactionRepository'
import { IdbCreditCardRepository }  from './infrastructure/repositories/IdbCreditCardRepository'
import { IdbSavingsRepository }      from './infrastructure/repositories/IdbSavingsRepository'
import { IdbAccountRepository }      from './infrastructure/repositories/IdbAccountRepository'
import { renderBottomNav, type RouteId } from './presentation/components/BottomNav'
import { registerRoute, startRouter, navigate } from './presentation/router'
import { renderDashboard }    from './presentation/views/DashboardView'
import { renderTransactions } from './presentation/views/TransactionsView'
import { renderCreditCards }  from './presentation/views/CreditCardsView'
import { renderSavings }      from './presentation/views/SavingsView'
import { renderImport }       from './presentation/views/ImportView'
import { renderSettings }     from './presentation/views/SettingsView'

async function bootstrap() {
  // Bloqueia alertas nativos (usa Toast ao invés)
  window.alert = (msg) => console.warn('alert blocked:', msg)

  const db          = await getDB()
  const txRepo      = new IdbTransactionRepository(db)
  const cardRepo    = new IdbCreditCardRepository(db)
  const savingsRepo = new IdbSavingsRepository(db)
  const accountRepo = new IdbAccountRepository(db)

  // App shell
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div class="app-container">
      <main id="main-content" class="app-main"></main>
      <nav id="bottom-nav" class="bottom-nav"></nav>
    </div>
  `

  const mainEl = document.getElementById('main-content')!
  const navEl  = document.getElementById('bottom-nav')!

  // Registrar rotas
  registerRoute('dashboard',    (el) => renderDashboard(el, txRepo, cardRepo, savingsRepo, accountRepo))
  registerRoute('transactions', (el) => renderTransactions(el, txRepo, cardRepo))
  registerRoute('cards',        (el) => renderCreditCards(el, cardRepo, txRepo))
  registerRoute('savings',      (el) => renderSavings(el, savingsRepo, txRepo))
  registerRoute('import',       (el) => renderImport(el, txRepo))
  registerRoute('settings',     (el) => renderSettings(el))

  function renderNav(active: RouteId) {
    renderBottomNav(navEl, active, (route) => navigate(route))
  }

  // Remover FABs residuais ao navegar
  window.addEventListener('hashchange', () => {
    document.querySelectorAll('.fab').forEach(f => f.remove())
  })

  startRouter(mainEl, navEl, renderNav)
}

bootstrap().catch((e) => {
  console.error('Erro ao inicializar app:', e)
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px;color:#F5F5F5;background:#1A1A2E;">
      <div style="font-size:3rem">⚠️</div>
      <p style="font-size:1rem">Erro ao inicializar o app</p>
      <p style="font-size:0.75rem;color:#94A3B8">${e instanceof Error ? e.message : String(e)}</p>
      <button onclick="location.reload()" style="margin-top:12px;padding:10px 24px;background:#00C853;color:#1A1A2E;border:none;border-radius:12px;font-weight:600;cursor:pointer;">
        Tentar novamente
      </button>
    </div>
  `
})
