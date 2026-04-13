import type { RouteId } from './components/BottomNav'

export type RouteHandler = (
  container: HTMLElement,
  params?: Record<string, string>
) => void | Promise<void>

/** Rotas estáticas: #dashboard, #accounts, etc. */
const routes = new Map<string, RouteHandler>()

/** Rotas dinâmicas: #bank/acc_123 → prefix='bank', params={id:'acc_123'} */
const dynRoutes = new Map<string, RouteHandler>()

export function registerRoute(id: string, handler: RouteHandler): void {
  routes.set(id, handler)
}

export function registerDynamicRoute(prefix: string, handler: RouteHandler): void {
  dynRoutes.set(prefix, handler)
}

/** Navega para uma rota estática. */
export function navigate(route: RouteId): void {
  window.location.hash = route
}

/** Navega para uma rota dinâmica, ex: navigateTo('bank', 'acc_123'). */
export function navigateTo(prefix: string, id: string): void {
  window.location.hash = `${prefix}/${id}`
}

/** Parseia o hash atual e separa prefixo de parâmetros. */
function parseHash(): { key: string; params: Record<string, string> } {
  const raw = window.location.hash.slice(1) || 'dashboard'
  const sep = raw.indexOf('/')
  if (sep === -1) return { key: raw, params: {} }
  return { key: raw.slice(0, sep), params: { id: raw.slice(sep + 1) } }
}

/** Rota estática ativa (para highlight do BottomNav).
 *  Rotas dinâmicas sob 'bank' apontam para 'accounts' como pai. */
export function getCurrentRoute(): RouteId {
  const { key } = parseHash()
  if (routes.has(key)) return key as RouteId
  if (key === 'bank')  return 'accounts'
  return 'dashboard'
}

export function startRouter(
  mainEl: HTMLElement,
  navEl: HTMLElement,
  renderNav: (activeRoute: RouteId) => void
): void {
  async function render() {
    const { key, params } = parseHash()
    const activeNav       = getCurrentRoute()

    renderNav(activeNav)
    mainEl.innerHTML = ''
    document.querySelectorAll('.fab').forEach(f => f.remove())

    // Tenta rota estática primeiro
    if (routes.has(key)) {
      try { await routes.get(key)!(mainEl, params) } catch (e) { renderError(mainEl, e) }
      return
    }

    // Tenta rota dinâmica
    if (dynRoutes.has(key)) {
      try { await dynRoutes.get(key)!(mainEl, params) } catch (e) { renderError(mainEl, e) }
      return
    }

    // Fallback
    await routes.get('dashboard')?.(mainEl, {})
  }

  function renderError(el: HTMLElement, e: unknown) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p class="empty-text">Erro ao carregar tela</p></div>`
    console.error(e)
  }

  window.addEventListener('hashchange', render)
  render()
}
