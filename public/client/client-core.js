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
    platsAll: 'resto.client.plats_all',
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

// Cache TTL (defaut 5 minutes)
export const CACHE_TTL_MS = (window?.RESTO_CACHE_TTL_MS) || (5 * 60 * 1000);

const readCache = (storageKey) => {
    try {
        const raw = readJson(storageKey, null);
        if (!raw) return null;
        const savedAt = Number(raw.savedAt || 0);
        if (savedAt > 0 && Date.now() - savedAt > Number(CACHE_TTL_MS || 0)) return null;
        return raw.data ?? null;
    } catch (e) {
        return null;
    }
};

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
    const url = buildUrl(pageName, params);
    if (window.__spaEnabled && typeof window.__loadUrl === 'function') {
        window.history.pushState({}, '', url);
        try { window.__loadUrl(url); } catch (e) { window.location.href = url; }
        return;
    }
    window.location.href = url;
};

export const getProfile = () => readJson(STORAGE_KEYS.profile, {}) || {};
export const saveProfile = (patch) => writeJson(STORAGE_KEYS.profile, { ...getProfile(), ...patch });
export const getMenuCache = () => readCache(STORAGE_KEYS.menu);
export const getCartCache = () => readCache(STORAGE_KEYS.cart);
export const getOrdersCache = () => readCache(STORAGE_KEYS.orders);
export const getPlatsAllCache = () => readCache(STORAGE_KEYS.platsAll);

const persistPlatsAll = (payload) => {
    // store generic plats list
    writeJson(STORAGE_KEYS.platsAll, { data: payload, savedAt: Date.now() });
    // also update chrome if useful
    try { updateChrome(payload); } catch (e) { /* ignore */ }
};

const getHints = () => {
    const query = getQuery();
    const context = getContext();
    return { tableId: query.get('table') || context.tableId || '', qrCode: query.get('code') || context.qrCode || '' };
};

const hasActiveOrders = (payload = null) => {
    const source = payload?.orders || getOrdersCache()?.orders || [];
    return Array.isArray(source) && source.some((order) => !['served', 'cancelled'].includes(String(order.status || '').toLowerCase()));
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

export const setButtonLoading = (button, loading = true, label = '') => {
    if (!button) return;
    if (loading) {
        if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.classList.add('btn-loading');
        const text = label || button.textContent.trim() || 'Chargement';
        button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span class="btn-label">${escapeHtml(text)}</span>`;
        return;
    }

    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
};

export const withButtonLoading = async (button, task, label = '') => {
    setButtonLoading(button, true, label);
    try {
        return await task();
    } finally {
        setButtonLoading(button, false);
    }
};

const skeletonCard = (image = true) => `
    <article class="glass-card overflow-hidden rounded-2xl">
        ${image ? '<div class="skeleton h-40 w-full"></div>' : ''}
        <div class="space-y-3 p-4">
            <div class="skeleton h-4 w-1/3 rounded-full"></div>
            <div class="skeleton h-5 w-4/5 rounded-full"></div>
            <div class="skeleton h-3 w-full rounded-full"></div>
            <div class="skeleton h-3 w-2/3 rounded-full"></div>
        </div>
    </article>
`;

const skeletonRow = () => `
    <article class="glass-card rounded-2xl p-3">
        <div class="flex gap-3">
            <div class="skeleton h-16 w-16 shrink-0 rounded-xl"></div>
            <div class="min-w-0 flex-1 space-y-3">
                <div class="skeleton h-4 w-3/4 rounded-full"></div>
                <div class="skeleton h-3 w-full rounded-full"></div>
                <div class="skeleton h-3 w-1/2 rounded-full"></div>
            </div>
        </div>
    </article>
`;

export const renderSkeleton = (type = 'cards', count = 4) => {
    if (type === 'chips') {
        return Array.from({ length: count }, () => '<div class="skeleton h-10 w-28 rounded-full"></div>').join('');
    }
    if (type === 'rows') {
        return Array.from({ length: count }, skeletonRow).join('');
    }
    if (type === 'detail') {
        return `
            <div class="space-y-4">
                <div class="skeleton h-5 w-2/3 rounded-full"></div>
                <div class="skeleton h-4 w-full rounded-full"></div>
                <div class="skeleton h-4 w-4/5 rounded-full"></div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="skeleton h-20 rounded-2xl"></div>
                    <div class="skeleton h-20 rounded-2xl"></div>
                </div>
                ${Array.from({ length: 3 }, () => skeletonCard(false)).join('')}
            </div>
        `;
    }
    return Array.from({ length: count }, () => skeletonCard(true)).join('');
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
    document.querySelectorAll('[data-active-order-badge]').forEach((node) => {
        node.classList.toggle('is-visible', hasActiveOrders(payload));
    });
    document.querySelectorAll('.nav-btn, .desktop-link').forEach((node) => node.classList.toggle('is-active', node.dataset.page === getLogicalPage()));

    if (window.__restoTimerUnsub) {
        try { window.__restoTimerUnsub(); } catch (e) { /* ignore */ }
        window.__restoTimerUnsub = null;
    }
    if (!expiresAt) return;
    const tick = () => {
        const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        document.querySelectorAll('[data-session-timer]').forEach((node) => { node.textContent = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`; });
    };
    tick();

    if (!window.__restoTimerService) {
        window.__restoTimerService = (function(){
            const subs = new Set();
            let id = null;
            function tickAll(){ const now = Date.now(); subs.forEach(cb => { try { cb(now); } catch(e){} }); }
            function start(){ if (id) return; id = setInterval(tickAll, 1000); }
            function subscribe(cb){ subs.add(cb); start(); return ()=>{ subs.delete(cb); if (subs.size===0){ clearInterval(id); id=null; } }; }
            return { subscribe };
        })();
    }

    window.__restoTimerUnsub = window.__restoTimerService.subscribe(tick);
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
        error.payload = payload;
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

// Realtime subscription helpers (Firebase)
export const startMenuRealtimeSubscription = async () => {
    if (window.__menuUnsub) return window.__menuUnsub;
    const context = getContext();
    const cached = getMenuCache();
    const tenantId = context.tableId || (cached?.session?.table?.id) || null;
    if (!tenantId) return null;

    try {
        const mod = await import('../src/services/MenuRealtimeService.js');
        const unsub = mod.subscribeToMenuUpdates(tenantId, (menuItems) => {
            try {
                const current = getMenuCache() || {};
                const merged = { ...(current || {}) };
                merged.plats = Array.isArray(merged.plats) ? merged.plats.slice() : [];
                // remplacer les plats mis à jour par le realtime et éviter les doublons avec les plats existants
                const byId = new Map(merged.plats.map(p => [String(p.id), p]));
                (menuItems || []).forEach((item) => byId.set(String(item.id), { id: item.id, ...item }));
                merged.plats = [...byId.values()];
                // sauvegarder le menu mis à jour en cache
                writeJson(STORAGE_KEYS.menu, { data: merged, savedAt: Date.now() });
                // mettre à jour l'interface utilisateur
                updateChrome(merged);
                // déclencher un événement personnalisé pour informer les composants de l'interface d'une mise à jour du menu
                try { window.dispatchEvent(new CustomEvent('resto.menu.updated', { detail: merged })); } catch (e) { /* ignore */ }
            } catch (e) {
                console.error('Error processing realtime menu update', e);
            }
        });
        window.__menuUnsub = unsub;
        return unsub;
    } catch (e) {
        console.warn('Failed to start menu realtime subscription', e);
        return null;
    }
};

export const stopMenuRealtimeSubscription = () => {
    if (window.__menuUnsub) {
        try { window.__menuUnsub(); } catch (e) { /* ignore */ }
        window.__menuUnsub = null;
    }
};

const withRecovery = async (loader) => {
    try {
        return await loader();
    } catch (error) {
        const isMissingOrExpiredSession = (
            error.status === 410
            || (error.status === 404 && String(error.payload?.message || error.message || '').toLowerCase().includes('session de table'))
        );

        if (isMissingOrExpiredSession && (getHints().tableId || getHints().qrCode)) {
            clearSessionContext();
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
    const cached = getMenuCache();
    if (cached) {
        // retourner immédiatement le menu en cache pour une expérience plus rapide, puis rafraîchir en arrière-plan
        try { window.dispatchEvent(new CustomEvent('resto.menu.cached', { detail: cached })); } catch (e) { /* ignore */ }
        console.debug('[client-core] loadMenu: returning cached menu, savedAt=', readJson(STORAGE_KEYS.menu)?.savedAt);
        (async () => {
            try {
                const response = await apiRequest(`/front-office/menu/${encodeURIComponent(getSessionToken())}${day ? `?day=${encodeURIComponent(day)}` : ''}`);
                persistMenu(response.data);
                console.debug('[client-core] loadMenu: background refresh succeeded');
            } catch (e) {
                // ignorer les erreurs de rafraîchissement en arrière-plan, le menu en cache sera utilisé jusqu'à ce qu'il expire ou que l'utilisateur recharge la page
                console.warn('Background menu refresh failed', e);
            }
        })();
        return cached;
    }

    console.debug('[client-core] loadMenu: no cache, fetching from API');
    const response = await apiRequest(`/front-office/menu/${encodeURIComponent(getSessionToken())}${day ? `?day=${encodeURIComponent(day)}` : ''}`);
    persistMenu(response.data);
    console.debug('[client-core] loadMenu: fetched menu, persisting');
    return response.data;
});

export const loadAllPlats = async () => withRecovery(async () => {
    // fetch all active plats for the restaurant (requires session token)
    if (!getSessionToken()) return redirectToLoadingIfNeeded() ? null : Promise.reject(new Error('Session introuvable.'));
    const cached = getPlatsAllCache();
    if (cached) {
        try { window.dispatchEvent(new CustomEvent('resto.plats_all.cached', { detail: cached })); } catch (e) { /* ignore */ }
        (async () => {
            try {
                console.debug('[client-core] loadAllPlats: background refresh: fetching /front-office/plats');
                const response = await apiRequest(`/front-office/plats?session_token=${encodeURIComponent(getSessionToken())}&all=1`);
                persistPlatsAll(response.data);
            } catch (e) {
                // Fallback: backend may expose public plats list at /api/plats
                if (e && (e.status === 404 || String(e.message || '').toLowerCase().includes('route not found'))) {
                    console.debug('[client-core] loadAllPlats: background refresh received 404, attempting fallback to /plats');
                    try {
                        const fallback = await apiRequest(`/plats?session_token=${encodeURIComponent(getSessionToken())}&all=1`);
                        persistPlatsAll(fallback.data);
                        console.debug('[client-core] loadAllPlats: background fallback /plats succeeded');
                        return;
                    } catch (err) {
                        console.warn('Background plats_all fallback failed', err);
                    }
                }
                console.warn('Background plats_all refresh failed', e);
            }
        })();
        return cached;
    }

    try {
        console.debug('[client-core] loadAllPlats: fetching /front-office/plats (primary)');
        const response = await apiRequest(`/front-office/plats?session_token=${encodeURIComponent(getSessionToken())}&all=1`);
        persistPlatsAll(response.data);
        return response.data;
    } catch (e) {
        // if front-office listing is not implemented, try the public plats listing
        if (e && (e.status === 404 || String(e.message || '').toLowerCase().includes('route not found'))) {
            console.debug('[client-core] loadAllPlats: primary 404, attempting fallback /plats');
            const fallback = await apiRequest(`/plats?session_token=${encodeURIComponent(getSessionToken())}&all=1`);
            persistPlatsAll(fallback.data);
            console.debug('[client-core] loadAllPlats: fallback /plats succeeded');
            return fallback.data;
        }
        throw e;
    }
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
        const categoryImage = getImageUrl({
            image_url: plat?.category_details?.image_url || plat?.category_image_url || '',
            image: plat?.category_details?.image || '',
            name: label
        });
        if (!groups.has(key)) groups.set(key, {
            id: key,
            name: label,
            image: categoryImage,
            details: plat?.category_details || null,
            plats: []
        });
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

// Permet de charger une nouvelle page via AJAX et de remplacer le contenu principal sans recharger complètement la page. 
// Doit être utilisé en conjonction avec enableSpaNavigation pour intercepter les clics sur les liens internes. 
// Cherche d'abord à extraire le contenu principal de la nouvelle page (élément avec classe .page-main ou main) 
// pour éviter de remplacer tout le DOM, puis met à jour le titre, les données de contexte et réimporte les scripts de la page si nécessaire.
const extractMainContent = (doc) => doc.querySelector('.page-main') || doc.querySelector('main') || null;

const importModuleScript = async (doc, baseUrl) => {
    const script = doc.querySelector('script[type="module"][src]');
    if (!script) return null;
    const src = script.getAttribute('src');
    const url = new URL(src, baseUrl).href;
    try {
        return await import(url);
    } catch (e) {
        console.warn('Failed to import page module', url, e);
        return null;
    }
};

window.__loadUrl = async (url) => {
    // prevent re-entrancy: ignore if the same URL is already being loaded
    if (window.__spaLoadingUrl && window.__spaLoadingUrl === url) {
        return;
    }
    window.__spaLoadingUrl = url;
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fetch failed');
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const newMain = extractMainContent(doc);
        if (newMain) {
            const currentMain = document.querySelector('.page-main');
            if (currentMain) currentMain.innerHTML = newMain.innerHTML;
        }
        // update title and body page dataset
        if (doc.title) document.title = doc.title;
        const page = doc.body?.dataset?.page || '';
        if (page) document.body.dataset.page = page;
        // rebind chrome and other UI
        if (typeof window.bindChrome === 'function') window.bindChrome(document);
        // import page module if present
        await importModuleScript(doc, url);
        // run a small update after replacing
        if (typeof window.updateChrome === 'function') window.updateChrome();
    } catch (e) {
        console.error('SPA load failed for', url, e);
        try { window.location.href = url; } catch (err) { /* ignore */ }
    } finally {
        // clear loading marker
        if (window.__spaLoadingUrl === url) window.__spaLoadingUrl = null;
    }
};

export const enableSpaNavigation = (options = {}) => {
    if (window.__spaEnabled) return;
    window.__spaEnabled = true;

    // handle back/forward
    window.addEventListener('popstate', () => {
        try { window.__loadUrl(location.pathname + location.search); } catch (e) { location.reload(); }
    });

    document.addEventListener('click', (evt) => {
        const a = evt.target.closest && evt.target.closest('a');
        if (!a || a.target || a.hasAttribute('download') || a.rel === 'external') return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('http') && new URL(href).origin !== location.origin) return;
        // internal navigation
        evt.preventDefault();
        const url = href.startsWith('/') ? href : new URL(href, location.href).pathname + new URL(href, location.href).search;
        window.history.pushState({}, '', url);
        window.__loadUrl(url);
    }, true);

    // optional: immediately enable for current page to avoid full reload on next redirectTo
    if (options.autoLoad === true && location.href) {
        window.history.replaceState({}, '', location.href);
    }
};

// Permet d'activer la navigation SPA (sans rechargement complet) en interceptant les clics sur les liens internes et en chargeant le contenu via AJAX. Doit être appelé après que le DOM est prêt. L'option autoLoad permet de charger immédiatement le contenu de la page actuelle via AJAX pour éviter un double chargement lors du premier redirectTo.
try { enableSpaNavigation({ autoLoad: false }); } catch (e) { /* ignore in non-browser contexts */ }
// try to start realtime subscription automatically
// realtime subscription is started manually when appropriate (e.g. after session restore)
