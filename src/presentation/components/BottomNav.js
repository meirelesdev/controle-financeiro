const NAV_ITEMS = [
    { id: 'dashboard', label: 'Início', emoji: '🏠' },
    { id: 'transactions', label: 'Extrato', emoji: '📋' },
    { id: 'cards', label: 'Cartões', emoji: '💳' },
    { id: 'savings', label: 'Cofrinhos', emoji: '🐷' },
    { id: 'import', label: 'Importar', emoji: '📊' },
    { id: 'settings', label: 'Config', emoji: '⚙️' },
];
export function renderBottomNav(container, activeRoute, onNavigate) {
    container.innerHTML = NAV_ITEMS.map(item => `
    <button class="nav-item ${item.id === activeRoute ? 'active' : ''}" data-route="${item.id}">
      <span class="nav-icon">${item.emoji}</span>
      <span class="nav-label">${item.label}</span>
    </button>
  `).join('');
    container.querySelectorAll('[data-route]').forEach(btn => {
        btn.addEventListener('click', () => {
            const route = btn.dataset.route;
            onNavigate(route);
        });
    });
}
