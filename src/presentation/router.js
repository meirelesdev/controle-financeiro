const routes = new Map();
export function registerRoute(id, handler) {
    routes.set(id, handler);
}
export function navigate(route) {
    window.location.hash = route;
}
export function getCurrentRoute() {
    const hash = window.location.hash.slice(1);
    return routes.has(hash) ? hash : 'dashboard';
}
export function startRouter(mainEl, navEl, renderNav) {
    async function render() {
        const route = getCurrentRoute();
        const handler = routes.get(route);
        renderNav(route);
        mainEl.innerHTML = '';
        if (handler) {
            try {
                await handler(mainEl);
            }
            catch (e) {
                mainEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p class="empty-text">Erro ao carregar tela</p></div>`;
                console.error(e);
            }
        }
    }
    window.addEventListener('hashchange', render);
    render();
}
