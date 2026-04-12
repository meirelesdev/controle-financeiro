import type { RouteId } from './components/BottomNav'

export type RouteHandler = (container: HTMLElement) => void | Promise<void>

const routes = new Map<RouteId, RouteHandler>()

export function registerRoute(id: RouteId, handler: RouteHandler): void {
  routes.set(id, handler)
}

export function navigate(route: RouteId): void {
  window.location.hash = route
}

export function getCurrentRoute(): RouteId {
  const hash = window.location.hash.slice(1) as RouteId
  return routes.has(hash) ? hash : 'dashboard'
}

export function startRouter(
  mainEl: HTMLElement,
  navEl: HTMLElement,
  renderNav: (activeRoute: RouteId) => void
): void {
  async function render() {
    const route = getCurrentRoute()
    const handler = routes.get(route)

    renderNav(route)
    mainEl.innerHTML = ''

    if (handler) {
      try {
        await handler(mainEl)
      } catch (e) {
        mainEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p class="empty-text">Erro ao carregar tela</p></div>`
        console.error(e)
      }
    }
  }

  window.addEventListener('hashchange', render)
  render()
}
