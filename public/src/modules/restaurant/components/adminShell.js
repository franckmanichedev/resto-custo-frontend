import { api } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { escapeHtml, showToast, debounce } from '../../../shared/utils/index.js';

const ACTIVE_ORDER_STATUSES = new Set(['pending', 'preparing']);

const navItems = [
    { key: 'dashboard', href: './dashboard.html', icon: 'fa-chart-line', label: 'Dashboard' },
    { key: 'orders', href: './orders.html', icon: 'fa-clipboard-list', label: 'Commandes', badgeId: 'shell-pending-orders-badge' },
    { key: 'menu', href: './plats.html', icon: 'fa-utensils', label: 'Menu / Plats' },
    { key: 'tables', href: './tables.html', icon: 'fa-table', label: 'Tables' },
    { key: 'clients', href: './clients.html', icon: 'fa-users', label: 'Clients' },
    { key: 'settings', href: './settings.html', icon: 'fa-gear', label: 'Parametres' }
];

const menuSubItems = [
    { key: 'plats', href: './plats.html', label: 'Plats' },
    { key: 'compositions', href: './compositions.html', label: 'Compositions' },
    { key: 'categories', href: './categories.html', label: 'Categories' },
    { key: 'types', href: './categories.html#types', label: 'Types_Categories' }
];

const isMenuActive = (active) => ['menu', 'plats', 'compositions', 'categories', 'types'].includes(active);

const getRestaurantName = (userData) => (
    localStorage.getItem('selectedRestaurantName')
    || userData?.restaurantName
    || userData?.restaurant_name
    || userData?.tenantName
    || 'Restaurant'
);

const getInitials = (value) => {
    const words = String(value || 'Admin').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'A';
};

function renderNav(active) {
    return navItems.map((item) => {
        const activeClass = item.key === 'menu'
            ? (isMenuActive(active) ? 'is-active' : '')
            : (active === item.key ? 'is-active' : '');

        const badge = item.badgeId
            ? `<span id="${item.badgeId}" class="rq-nav-badge hidden">0</span>`
            : '';

        const subNav = item.key === 'menu'
            ? `<div class="rq-nav-sub">
                ${menuSubItems.map((subItem) => `
                    <a href="${subItem.href}" class="${subItem.key === active ? 'is-active' : ''}">
                        ${escapeHtml(subItem.label)}
                    </a>
                `).join('')}
            </div>`
            : '';

        return `
            <a href="${item.href}" class="rq-nav-link ${activeClass}">
                <i class="fas ${item.icon}"></i>
                <span>${escapeHtml(item.label)}</span>
                ${badge}
            </a>
            ${subNav}
        `;
    }).join('');
}

function renderShell({ active, title, subtitle, content, restaurantName, userName }) {
    return `
        <div class="rq-sidebar-backdrop" data-sidebar-close></div>
        <aside class="rq-sidebar">
            <div class="rq-sidebar-header">
                <div class="rq-brand">
                    <div class="rq-brand-mark">RQ</div>
                    <div>
                        <div class="rq-brand-title">${escapeHtml(restaurantName)}</div>
                        <div class="rq-brand-subtitle">Back-office restaurant</div>
                    </div>
                </div>
            </div>
            <nav class="rq-nav">
                <div class="rq-nav-section">Operations</div>
                ${renderNav(active)}
            </nav>
            <div class="rq-sidebar-footer">
                <button id="logout-btn" class="rq-logout">
                    <i class="fas fa-arrow-right-from-bracket"></i>
                    <span>Deconnexion</span>
                </button>
            </div>
        </aside>
        <div class="rq-main">
            <header class="rq-topbar">
                <button type="button" class="rq-icon-btn rq-mobile-toggle" data-sidebar-toggle aria-label="Ouvrir le menu">
                    <i class="fas fa-bars"></i>
                </button>
                <label class="rq-topbar-search">
                    <i class="fas fa-search text-slate-400"></i>
                    <input id="admin-global-search" type="search" placeholder="Rechercher une commande, un plat, une table...">
                </label>
                <button type="button" class="rq-icon-btn relative" id="admin-notifications-btn" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span id="admin-notifications-badge" class="hidden absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-primary px-1 text-xs font-bold text-white"></span>
                </button>
                <div class="rq-profile">
                    <div class="rq-avatar">${escapeHtml(getInitials(userName))}</div>
                    <div class="hidden sm:block">
                        <div id="user-name" class="text-sm font-bold text-slate-900">${escapeHtml(userName)}</div>
                        <div class="text-xs text-slate-500">Administrateur</div>
                    </div>
                </div>
            </header>
            <main class="rq-page">
                <div class="mb-6">
                    <h1 class="rq-page-title">${escapeHtml(title)}</h1>
                    ${subtitle ? `<p class="rq-page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
                </div>
                ${content}
            </main>
        </div>
    `;
}

async function hydrateShellBadges() {
    try {
        const response = await api.restaurant.orders.getAll({ status: 'pending' });
        const pendingCount = (response.data || []).length;
        const pendingBadge = document.getElementById('shell-pending-orders-badge');
        const notificationBadge = document.getElementById('admin-notifications-badge');

        [pendingBadge, notificationBadge].forEach((badge) => {
            if (!badge) return;
            badge.textContent = pendingCount;
            badge.classList.toggle('hidden', pendingCount <= 0);
        });
    } catch (error) {
        // The shell must stay usable even if the kitchen feed is temporarily unavailable.
    }
}

function bindShellInteractions() {
    document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => {
        document.body.classList.add('rq-sidebar-open');
    });

    document.querySelectorAll('[data-sidebar-close]').forEach((element) => {
        element.addEventListener('click', () => document.body.classList.remove('rq-sidebar-open'));
    });

    document.getElementById('admin-notifications-btn')?.addEventListener('click', () => {
        showToast('Centre de notifications pret pour les actions restaurant.', 'info');
    });

    document.getElementById('admin-global-search')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        const query = event.currentTarget.value.trim();
        if (!query) return;

        const target = document.querySelector('#search-items, #category-search, #search-comps, #table-filter');
        if (target) {
            target.value = query;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.focus();
            return;
        }

        window.location.href = `./orders.html?q=${encodeURIComponent(query)}`;
    });
}

export function initializeRestaurantShell({
    authService,
    active,
    title,
    subtitle = ''
}) {
    const shellRoot = document.querySelector('[data-admin-shell]');
    const contentRoot = document.querySelector('[data-page-content]');

    if (!shellRoot || !contentRoot) {
        return initializeAdminPage({ authService });
    }

    const userData = authService.getUserData();
    const restaurantName = getRestaurantName(userData);
    const userName = userData?.name || userData?.email || 'Admin';
    const content = contentRoot.innerHTML;

    document.body.classList.add('rq-admin-body');
    shellRoot.innerHTML = renderShell({
        active,
        title,
        subtitle,
        content,
        restaurantName,
        userName
    });

    const allowed = initializeAdminPage({ authService });
    if (!allowed) return false;

    bindShellInteractions();
    hydrateShellBadges();

    (async () => {
        try {
            if (!window.io) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '/socket.io/socket.io.js';
                    s.async = true;
                    s.onload = () => resolve();
                    s.onerror = (e) => reject(e);
                    document.head.appendChild(s);
                });
            }
            if (!window.io) return;
            const socket = io();
            const user = authService.getUserData ? authService.getUserData() : null;
            const restId = user?.restaurantId || user?.restaurant_id || null;
            const room = restId ? `restaurant_${restId}_shell` : 'shell';
            socket.emit('join_room', room);
            const debounced = debounce(() => hydrateShellBadges(), 500);
            socket.on('new_order', debounced);
            socket.on('order_status_changed', debounced);
            socket.on('stats_updated', (payload) => {
                if (payload?.pending != null) {
                    const pendingBadge = document.getElementById('shell-pending-orders-badge');
                    const notificationBadge = document.getElementById('admin-notifications-badge');
                    [pendingBadge, notificationBadge].forEach((badge) => {
                        if (!badge) return;
                        badge.textContent = payload.pending;
                        badge.classList.toggle('hidden', payload.pending <= 0);
                    });
                } else {
                    debounced();
                }
            });
        } catch (err) {
            // ignore
        }
    })();
    return true;
}

export function getActiveOrderStatuses() {
    return ACTIVE_ORDER_STATUSES;
}
