export const PAGE_FILES = {
    loading: 'loading.html',
    index: 'index.html',
    categories: 'categories.html',
    search: 'search.html',
    detail: 'article-detail.html',
    cart: 'cart.html',
    tracking: 'tracking.html'
};

const STORAGE_KEYS = {
    context: 'resto.client.context',
    menu: 'resto.client.menu',
    cart: 'resto.client.cart',
    orders: 'resto.client.orders',
    profile: 'resto.client.profile',
    tableSessionPrefix: 'resto.client.session.'
};

const LOCAL_HOSTNAMES = new Set(['', 'localhost', '127.0.0.1', '0.0.0.0']);
const ORDER_STEPS = ['pending', 'preparing', 'ready', 'served'];
const DAY_LABELS = {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche'
};

const readJson = (key, fallback = null) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
};

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const removeJson = (key) => localStorage.removeItem(key);
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');
const getQuery = () => new URLSearchParams(window.location.search);
const getContext = () => readJson(STORAGE_KEYS.context, {}) || {};
const getCurrentFile = () => window.location.pathname.split('/').pop() || 'index.html';

const resolveApiBaseUrl = () => {
    const configured = window.API_BASE_URL || document.querySelector('meta[name="api-base-url"]')?.content || '';
    const hostname = window.location.hostname;

    if (LOCAL_HOSTNAMES.has(hostname) || hostname.startsWith('192.168.') || hostname.endsWith('.local')) {
        return `http://${LOCAL_HOSTNAMES.has(hostname) ? 'localhost' : hostname}:5000/api`;
    }

    return configured ? normalizeBaseUrl(configured) : 'https://resto-custo-backend.onrender.com/api';
};

const API_BASE_URL = resolveApiBaseUrl();

export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

export const formatPrice = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
export const formatDuration = (minutes) => `${Math.max(1, Number(minutes || 0))} min`;
export const formatDayLabel = (day) => DAY_LABELS[day] || day || '';
export const getStatusLabel = (status) => ({ pending: 'En attente', preparing: 'En preparation', ready: 'Prete', served: 'Servie', cancelled: 'Annulee' }[status] || status || '-');
export const getStatusTone = (status) => ({ pending: 'bg-amber-100 text-amber-800', preparing: 'bg-sky-100 text-sky-800', ready: 'bg-emerald-100 text-emerald-800', served: 'bg-slate-200 text-slate-700', cancelled: 'bg-rose-100 text-rose-800' }[status] || 'bg-slate-100 text-slate-700');
export const getImageUrl = (entity) => entity?.image_url || entity?.image || `https://placehold.co/640x420/f59e0b/ffffff?text=${encodeURIComponent((entity?.name || entity?.plat_name || 'Plat').slice(0, 16))}`;
export const getLogicalPage = () => document.body?.dataset?.page || Object.entries(PAGE_FILES).find(([, file]) => file === getCurrentFile())?.[0] || 'index';

export const buildUrl = (pageName, params = {}) => {
    const file = PAGE_FILES[pageName] || pageName;
    const query = new URLSearchParams();
    const current = getQuery();
    const context = getContext();
    const tableId = params.table === null ? '' : (params.table ?? current.get('table') ?? context.tableId ?? '');
    const qrCode = params.code === null ? '' : (params.code ?? current.get('code') ?? context.qrCode ?? '');

    if (tableId) query.set('table', tableId);
    else if (qrCode) query.set('code', qrCode);

    Object.entries(params).forEach(([key, value]) => {
        if (key === 'table' || key === 'code' || value === null || value === undefined || value === '') return;
        query.set(key, value);
    });

    return `${file}${query.toString() ? `?${query.toString()}` : ''}`;
};

export const redirectTo = (pageName, params = {}) => {
    window.location.href = buildUrl(pageName, params);
};

export const getProfile = () => readJson(STORAGE_KEYS.profile, {}) || {};
export const saveProfile = (patch) => writeJson(STORAGE_KEYS.profile, { ...getProfile(), ...patch });
export const getMenuCache = () => readJson(STORAGE_KEYS.menu, null)?.data || null;
export const getCartCache = () => readJson(STORAGE_KEYS.cart, null)?.data || null;
export const getOrdersCache = () => readJson(STORAGE_KEYS.orders, null)?.data || null;

const getHints = () => {
    const query = getQuery();
    const context = getContext();
    return { tableId: query.get('table') || context.tableId || '', qrCode: query.get('code') || context.qrCode || '' };
};

export const getSessionToken = () => {
    const context = getContext();
    const { tableId } = getHints();

    if (tableId) {
        return localStorage.getItem(`${STORAGE_KEYS.tableSessionPrefix}${tableId}`) || (context.tableId === tableId ? context.sessionToken || '' : '');
    }

    return context.sessionToken || '';
};

export const clearSessionContext = () => {
    const context = getContext();
    const hints = getHints();
    [context.tableId, hints.tableId].filter(Boolean).forEach((tableId) => localStorage.removeItem(`${STORAGE_KEYS.tableSessionPrefix}${tableId}`));
    [STORAGE_KEYS.context, STORAGE_KEYS.menu, STORAGE_KEYS.cart, STORAGE_KEYS.orders].forEach(removeJson);
};

const mergeContext = (patch) => writeJson(STORAGE_KEYS.context, { ...getContext(), ...patch });

const syncContext = (payload, source = {}) => {
    if (!payload || typeof payload !== 'object') return;
    const table = payload.table || {};
    const session = payload.session || {};
    const current = getContext();
    const next = {
        tableId: source.tableId || table.id || current.tableId || '',
        qrCode: source.qrCode || current.qrCode || '',
        sessionToken: session.session_token || current.sessionToken || '',
        sessionId: session.id || current.sessionId || '',
        tableName: table.name || table.number || current.tableName || '',
        tableNumber: table.number || current.tableNumber || table.name || '',
        expiresAt: session.expires_at || current.expiresAt || ''
    };
    mergeContext(next);
    if (next.tableId && next.sessionToken) localStorage.setItem(`${STORAGE_KEYS.tableSessionPrefix}${next.tableId}`, next.sessionToken);
};

export const showToast = (message, variant = 'info') => {
    const tones = { info: 'bg-slate-900', success: 'bg-emerald-600', error: 'bg-rose-600' };
    const toast = document.createElement('div');
    toast.className = `fixed left-1/2 top-6 z-[200] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl ${tones[variant] || tones.info}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
};

export const updateChrome = (payload = null) => {
    const context = getContext();
    const tableLabel = payload?.table?.number || payload?.table?.name || context.tableNumber || context.tableName || '-';
    const expiresAt = payload?.session?.expires_at || context.expiresAt || '';
    const cartCount = getCartCache()?.cart?.total_items || 0;

    document.querySelectorAll('[data-table-label]').forEach((node) => { node.textContent = tableLabel; });
    document.querySelectorAll('[data-cart-count], .cartBadge').forEach((node) => {
        node.textContent = String(cartCount);
        node.style.display = cartCount > 0 ? 'inline-flex' : 'none';
    });
    document.querySelectorAll('.nav-btn, .desktop-link').forEach((node) => node.classList.toggle('is-active', node.dataset.page === getLogicalPage()));

    if (window.__restoTimer) clearInterval(window.__restoTimer);
    if (!expiresAt) return;
    const tick = () => {
        const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        document.querySelectorAll('[data-session-timer]').forEach((node) => { node.textContent = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`; });
    };
    tick();
    window.__restoTimer = setInterval(tick, 1000);
};

export const bindChrome = (root = document) => {
    root.querySelectorAll('.nav-btn, .desktop-link').forEach((node) => {
        if (node.dataset.boundClick === 'true') return;
        node.dataset.boundClick = 'true';
        node.addEventListener('click', () => redirectTo(node.dataset.page || 'index'));
    });
    root.querySelectorAll('[data-go-home]').forEach((node) => node.addEventListener('click', () => redirectTo('index'), { once: true }));
    root.querySelectorAll('[data-go-search]').forEach((node) => node.addEventListener('click', () => redirectTo('search'), { once: true }));
    root.querySelectorAll('[data-go-cart]').forEach((node) => node.addEventListener('click', () => redirectTo('cart'), { once: true }));
    root.querySelectorAll('[data-go-categories]').forEach((node) => node.addEventListener('click', () => redirectTo('categories'), { once: true }));
    root.querySelectorAll('[data-back]').forEach((node) => node.addEventListener('click', () => window.history.back(), { once: true }));
    updateChrome();
};

export const apiRequest = async (endpoint, options = {}) => {
    const response = await fetch(endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        if (response.status === 410) clearSessionContext();
        const error = new Error(payload?.message || `Erreur ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return payload;
};

const persistMenu = (payload, source = {}) => {
    syncContext(payload, source);
    writeJson(STORAGE_KEYS.menu, { data: payload, savedAt: Date.now() });
    if (Array.isArray(payload.orders)) writeJson(STORAGE_KEYS.orders, { data: { session: payload.session, orders: payload.orders }, savedAt: Date.now() });
    updateChrome(payload);
};

const persistCart = (payload) => {
    syncContext(payload);
    writeJson(STORAGE_KEYS.cart, { data: payload, savedAt: Date.now() });
    if (Array.isArray(payload.orders)) writeJson(STORAGE_KEYS.orders, { data: { session: payload.session, orders: payload.orders }, savedAt: Date.now() });
    updateChrome(payload);
};

const persistOrders = (payload) => {
    syncContext(payload);
    writeJson(STORAGE_KEYS.orders, { data: payload, savedAt: Date.now() });
    updateChrome(payload);
};

const withRecovery = async (loader) => {
    try {
        return await loader();
    } catch (error) {
        if (error.status === 410 && (getHints().tableId || getHints().qrCode)) {
            redirectTo('loading', { return_to: `${getCurrentFile()}${window.location.search || ''}` });
            return null;
        }
        throw error;
    }
};

export const redirectToLoadingIfNeeded = () => {
    if (getLogicalPage() === 'loading') return false;
    if (getSessionToken()) return false;
    if (!(getHints().tableId || getHints().qrCode)) return false;
    redirectTo('loading', { return_to: `${getCurrentFile()}${window.location.search || ''}` });
    return true;
};

export const startSession = async () => {
    const { tableId, qrCode } = getHints();
    const response = await apiRequest('/front-office/session/start', { method: 'POST', body: tableId ? { table_id: tableId } : { qr_code: qrCode } });
    persistMenu(response.data, { tableId, qrCode });
    return response.data;
};

export const loadMenu = async () => withRecovery(async () => {
    if (!getSessionToken()) return redirectToLoadingIfNeeded() ? null : Promise.reject(new Error('Session introuvable.'));
    const day = getQuery().get('day') || '';
    const response = await apiRequest(`/front-office/menu/${encodeURIComponent(getSessionToken())}${day ? `?day=${encodeURIComponent(day)}` : ''}`);
    persistMenu(response.data);
    return response.data;
});

export const loadCart = async () => withRecovery(async () => {
    if (!getSessionToken()) return redirectToLoadingIfNeeded() ? null : Promise.reject(new Error('Session introuvable.'));
    const response = await apiRequest(`/front-office/cart/${encodeURIComponent(getSessionToken())}`);
    persistCart(response.data);
    return response.data;
});

export const loadOrders = async () => withRecovery(async () => {
    if (!getSessionToken()) return redirectToLoadingIfNeeded() ? null : Promise.reject(new Error('Session introuvable.'));
    const response = await apiRequest(`/front-office/orders?session_token=${encodeURIComponent(getSessionToken())}`);
    persistOrders(response.data);
    return response.data;
});

export const loadPlat = async (platId) => withRecovery(async () => {
    if (!getSessionToken()) return redirectToLoadingIfNeeded() ? null : Promise.reject(new Error('Session introuvable.'));
    const day = getQuery().get('day') || '';
    const response = await apiRequest(`/front-office/plats/${encodeURIComponent(platId)}?session_token=${encodeURIComponent(getSessionToken())}${day ? `&day=${encodeURIComponent(day)}` : ''}`);
    syncContext(response.data);
    updateChrome(response.data);
    return response.data;
});

export const createCategoryGroups = (plats = []) => {
    const groups = new Map();
    plats.forEach((plat) => {
        const key = plat.categorie_id || plat.categorie_name || plat.category || plat.kind || 'Menu';
        const label = plat.categorie_name || plat.category || plat.kind || 'Menu';
        if (!groups.has(key)) groups.set(key, { id: key, name: label, image: getImageUrl(plat), plats: [] });
        groups.get(key).plats.push(plat);
    });
    return [...groups.values()].map((group) => ({ ...group, count: group.plats.length }));
};

export const filterByCategory = (plats = [], category = '') => !category || category === 'all'
    ? plats
    : plats.filter((plat) => [plat.categorie_name, plat.categorie_id, plat.category, plat.kind].filter(Boolean).some((value) => String(value).toLowerCase() === String(category).toLowerCase()));

export const isOrderable = (plat, payload = null) => payload?.can_order !== false && plat?.is_orderable_today !== false;

export const renderOrderStepper = (status) => {
    const activeIndex = ORDER_STEPS.indexOf(status);
    return `
        <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
                ${ORDER_STEPS.map((step, index) => `
                    <div class="flex min-w-0 flex-1 items-center ${index < ORDER_STEPS.length - 1 ? 'gap-2' : ''}">
                        <div class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${index <= activeIndex ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}">${index + 1}</div>
                        ${index < ORDER_STEPS.length - 1 ? `<div class="h-1 flex-1 rounded-full ${index < activeIndex ? 'bg-amber-500' : 'bg-slate-200'}"></div>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold text-slate-500">
                <span>En attente</span><span>En cuisine</span><span>Prete</span><span>Servie</span>
            </div>
        </div>
    `;
};

export const openModal = (html) => {
    const root = document.getElementById('clientModalRoot');
    if (!root) return;
    root.innerHTML = html;
};

export const closeModal = () => {
    const root = document.getElementById('clientModalRoot');
    if (root) root.innerHTML = '';
};
