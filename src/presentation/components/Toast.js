const ICONS = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
};
let container = null;
function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}
export function showToast(message, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `toast-${type}`;
    el.innerHTML = `<span>${ICONS[type]}</span><span>${message}</span>`;
    const c = getContainer();
    c.prepend(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 300);
    }, duration);
}
