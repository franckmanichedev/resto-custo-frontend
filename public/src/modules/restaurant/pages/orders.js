import { formatPrice, formatDuration } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, escapeHtml, groupItemsByVariant, debounce } from '../../../shared/utils/index.js';
import { timerService } from '../../../shared/utils/timerService.js';
import { authService } from '../services/authService.js';
import { ordersService } from '../services/ordersService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Acces administrateur requis');
}

// 🔊 Initialisation des sons et suivi des alertes
const receiveSound = new Audio('/assets/sounds/new-order.mp3');
const readySound = new Audio('/assets/sounds/order-late.mp3');
let alertedLateOrders = new Set();
let knownOrderIds = new Set();
let socket = null;

const ORDER_STATUSES = [
    { key: 'pending', label: 'En attente', tone: 'bg-yellow-50/50 border-yellow-100', badge: 'bg-amber-100 text-amber-700', icon: 'fa-hourglass-start' },
    { key: 'preparing', label: 'En preparation', tone: 'bg-blue-50/50 border-blue-100', badge: 'bg-blue-100 text-blue-700', icon: 'fa-fire-burner' },
    { key: 'ready', label: 'Pret', tone: 'bg-green-50/50 border-green-100', badge: 'bg-green-100 text-green-700', icon: 'fa-bell-concierge' },
    { key: 'served', label: 'Servi', tone: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-700', icon: 'fa-circle-check' },
    { key: 'cancelled', label: 'Annule', tone: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: 'fa-ban' }
];

let countdownUnsub = null;
let ordersCache = [];
let archivedCache = [];
let draggedOrderId = '';
let isDragging = false;

const ordersList = document.getElementById('orders-list');
const statusFilter = document.getElementById('status-filter');
const tableFilter = document.getElementById('table-filter');
const refreshBtn = document.getElementById('refresh-orders');
const autoRefreshCheckbox = document.getElementById('auto-refresh');
const lastUpdatedEl = document.getElementById('orders-last-updated');
const openArchiveBtn = document.getElementById('open-archive-btn');
const archiveDrawer = document.getElementById('archive-drawer');
const archiveBackdrop = document.getElementById('archive-backdrop');
const archivePanel = document.getElementById('archive-panel');
const archiveList = document.getElementById('archive-list');
const archiveSearch = document.getElementById('archive-search');
const archiveShowAll = document.getElementById('archive-show-all');
const closeArchiveBtn = document.getElementById('close-archive-btn');
const MAX_SERVED_DISPLAY_TIME = 2 * 60 * 60 * 1000;

// --- Fonctions de base (Taxonomie & Statuts) ---

function getStatusInfo(status) {
    return ORDER_STATUSES.find((entry) => entry.key === status) || ORDER_STATUSES[0];
}

function getStatusLabel(status) {
    return getStatusInfo(status).label;
}

function getCreatedAt(order) {
    return order.createdAt || order.created_at || order.updatedAt || order.updated_at || '';
}

function sortOrders(orders) {
    const weight = ORDER_STATUSES.reduce((acc, status, index) => {
        acc[status.key] = index;
        return acc;
    }, {});

    return [...orders].sort((left, right) => {
        const statusDiff = (weight[left.status] ?? 99) - (weight[right.status] ?? 99);
        if (statusDiff) return statusDiff;
        return new Date(getCreatedAt(right) || 0).getTime() - new Date(getCreatedAt(left) || 0).getTime();
    });
}

function filterOrders(orders) {
    const status = statusFilter.value;
    const table = tableFilter.value.trim().toLowerCase();

    return sortOrders(orders).filter((order) => {
        const matchesStatus = !status || order.status === status;
        const tableValues = [
            order.table?.number,
            order.table?.name,
            order.table_id
        ].filter(Boolean).join(' ').toLowerCase();
        const matchesTable = !table || tableValues.includes(table);
        return matchesStatus && matchesTable;
    });
}

// --- Chargement & Rendu ---

async function loadOrders(options = {}) {
    if (!options.silent) showOrdersSkeleton();
    try {
        const response = await ordersService.getAll();
        ordersCache = response.data || [];
        
        // On mémorise les IDs existants au premier chargement pour ne pas faire "bip" sur l'existant
        if (!options.silent) {
            knownOrderIds = new Set(ordersCache.map(o => o.id));
        }

        renderOrders(filterOrders(ordersCache));
        updatePendingBadge(ordersCache);
        updateLastUpdated();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        if (ordersList) ordersList.innerHTML = '<div class="text-center py-12 text-red-500 font-bold">Erreur réseau</div>';
    }
}

function renderOrders(orders) {
    if (!ordersList) return;
    ordersList.className = 'flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x flex-1 min-h-0 items-start';

    const grouped = ORDER_STATUSES.map((status) => {
        let filteredOrders = orders.filter((order) => order.status === status.key);
        
        // Logique d'archivage automatique pour la colonne "Servi"
        if (status.key === 'served') {
            const now = Date.now();
            filteredOrders = filteredOrders.filter((order) => {
                const completedAt = order.updated_at || order.estimated_ready_at || getCreatedAt(order) || Date.now();
                return (now - new Date(completedAt).getTime()) < MAX_SERVED_DISPLAY_TIME;
            });
        }
        return { ...status, orders: filteredOrders };
    });

    ordersList.innerHTML = grouped.map((column) => `
        <section class="kanban-lane flex w-[350px] min-w-[320px] max-w-[360px] snap-start max-h-full flex-col rounded-2xl border ${column.tone} p-3 bg-gray-50/40" data-status="${escapeHtml(column.key)}">
            <header class="mb-3 flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100/60 shrink-0">
                <div class="flex min-w-0 items-center gap-2">
                    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white shadow-sm">
                        <i class="fas ${column.icon} text-[11px]"></i>
                    </span>
                    <h2 class="truncate text-xs font-bold uppercase tracking-wider text-gray-700">${escapeHtml(column.label)}</h2>
                </div>
                <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600 border border-gray-200 shadow-inner">${column.orders.length}</span>
            </header>
            
            <div class="kanban-column flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border-2 border-dashed border-transparent p-0.5 transition scrollbar-thin min-h-[150px]" data-status="${escapeHtml(column.key)}">
                ${column.orders.length ? column.orders.map(renderKanbanCard).join('') : `
                    <div class="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 p-4 text-center text-xs font-semibold text-gray-400 min-h-[120px]">
                        <i class="fas fa-inbox text-lg text-gray-300 mb-1"></i> Vide
                    </div>
                `}
            </div>
        </section>
    `).join('');

    bindKanbanEvents();
    restartCountdowns();
}

function renderKanbanCard(order) {
    const statusInfo = getStatusInfo(order.status);
    const createdAt = getCreatedAt(order);
    const createdLabel = createdAt ? new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
    const remainingSeconds = order.estimated_ready_at ? Math.max(0, Math.floor((new Date(order.estimated_ready_at) - Date.now()) / 1000)) : null;
    const prepLabel = getOrderPrepLabel(order);
    const groups = groupOrderItemsForKitchen(order.items || order.order_items || []);

    return `
        <article draggable="true" data-id="${escapeHtml(order.id)}" data-status="${escapeHtml(order.status)}" class="kanban-card cursor-grab rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 active:cursor-grabbing group">
            <div class="mb-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-sm font-black text-gray-900 tracking-tight">#${escapeHtml(order.id?.slice(-8) || order.id)}</p>
                    <p class="mt-0.5 text-xs font-medium text-gray-500">
                        <i class="fas fa-table mr-1 text-gray-400"></i> Table <span class="font-bold text-gray-800">${escapeHtml(order.table?.number || order.table?.name || order.table_id || '-')}</span>
                    </p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${statusInfo.badge}">${escapeHtml(statusInfo.label)}</span>
            </div>

            <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50 border border-gray-100/60 p-2">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Préparation</span>
                    <strong class="text-gray-900 font-bold block mt-0.5">${escapeHtml(prepLabel)}</strong>
                </div>
                <div class="rounded-lg bg-gray-50 border border-gray-100/60 p-2">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                    <strong class="text-amber-600 font-extrabold block mt-0.5">${formatPrice(order.total_price || order.total || 0)}</strong>
                </div>
            </div>

            <div class="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                ${groups.map((group) => `
                    <div class="rounded-lg border border-gray-100/60 bg-gray-50/50 p-2 transition-colors group-hover:bg-gray-50">
                        <div class="flex justify-between items-start gap-2">
                            <span class="truncate text-xs font-bold text-gray-800 flex-1 leading-snug">${escapeHtml(group.plat_name)}</span>
                            <span class="text-xs font-extrabold text-amber-600">x${group.quantity}</span>
                        </div>
                        ${group.variants.map((variant) => `
                            <div class="mt-1 text-[11px] font-medium text-gray-500 pl-1.5 border-l-2 border-gray-200">
                                ${escapeHtml(variant.label)}
                                ${variant.compositions?.length ? `
                                    <div class="mt-1 flex flex-wrap gap-1">
                                        ${variant.compositions.slice(0, 4).map((c) => `
                                            <span class="inline-flex items-center rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                                                ${escapeHtml(c.action || '')} ${escapeHtml(c.composition_name || '')}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>

            <footer class="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs text-gray-400">
                <span class="font-medium"><i class="far fa-clock mr-1 text-gray-300"></i>${createdLabel}</span>
                ${remainingSeconds !== null && !['served', 'cancelled'].includes(order.status) ? `
                    <span class="countdown font-mono font-bold text-amber-600" data-target="${escapeHtml(order.estimated_ready_at)}">${formatDuration(remainingSeconds)}</span>
                ` : '<span>Prêt</span>'}
            </footer>
        </article>
    `;
}

// --- Logique Métier (Groupage & Labels) ---

function groupOrderItemsForKitchen(items) {
    if (!items || !items.length) return [];
    const groups = {};
    items.forEach((item) => {
        const key = item.plat_id || item.plat_name || item.id;
        if (!groups[key]) {
            groups[key] = { plat_name: item.plat_name, plat_id: item.plat_id, quantity: 0, total_price: 0, variants: [] };
        }
        groups[key].quantity += Number(item.quantity || 0);
        groups[key].total_price += Number(item.total_price || 0);
        groupItemsByVariant([item]).forEach((variant) => {
            groups[key].variants.push({ ...variant, quantity: variant.quantity, compositions: variant.compositions || [] });
        });
    });
    return Object.values(groups);
}

function getOrderPrepLabel(order) {
    if (order.status === 'ready') return 'Prêt';
    if (order.status === 'served') return 'Servi';
    if (order.status === 'cancelled') return 'Annulé';
    const itemPrepTimes = (order.items || order.order_items || [])
        .map((item) => Number(item.prep_time || item.preparation_total_minutes || 0)).filter(v => v > 0);
    const maxPrep = Math.max(...itemPrepTimes, 0);
    if (maxPrep > 0) return `${maxPrep} min`;
    if (order.estimated_ready_at) {
        const remaining = Math.max(0, Math.ceil((new Date(order.estimated_ready_at) - Date.now()) / 60000));
        return `${remaining} min`;
    }
    return '-';
}

// --- Événements Drag & Drop ---

function bindKanbanEvents() {
    document.querySelectorAll('.kanban-card').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
            draggedOrderId = card.dataset.id || '';
            isDragging = true;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedOrderId);
            card.classList.add('opacity-40', 'scale-95');
        });
        card.addEventListener('dragend', () => {
            isDragging = false;
            draggedOrderId = '';
            card.classList.remove('opacity-40', 'scale-95');
            document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('bg-orange-50/50', 'border-orange-500'));
        });
    });

    document.querySelectorAll('.kanban-column').forEach((column) => {
        column.addEventListener('dragover', (event) => {
            event.preventDefault();
            column.classList.add('bg-orange-50/50', 'border-orange-500');
        });
        column.addEventListener('dragleave', () => column.classList.remove('bg-orange-50/50', 'border-orange-500'));
        column.addEventListener('drop', async (event) => {
            event.preventDefault();
            column.classList.remove('bg-orange-50/50', 'border-orange-500');
            const orderId = event.dataTransfer.getData('text/plain') || draggedOrderId;
            const status = column.dataset.status;
            if (orderId && status) await moveOrder(orderId, status);
        });
    });
}

async function moveOrder(orderId, nextStatus) {
    const order = ordersCache.find((entry) => entry.id === orderId);
    if (!order || !nextStatus || order.status === nextStatus) return;
    try {
        // Mutation optimiste
        order.status = nextStatus;
        order.updated_at = new Date().toISOString();
        alertedLateOrders.delete(orderId); 
        renderOrders(filterOrders(ordersCache));

        await ordersService.updateStatus(orderId, nextStatus);
        showToast(`Commande mise à jour`, 'success');
        await loadOrders({ silent: true });
    } catch (error) {
        showToast(error.message, 'error');
        await loadOrders({ silent: true });
    }
}

// --- Timers & Sockets ---

function restartCountdowns() {
    if (countdownUnsub) countdownUnsub();
    const updateCountdowns = () => {
        let hasJustBecomeLate = false;
        document.querySelectorAll('.countdown').forEach((el) => {
            const target = el.dataset.target;
            const orderId = el.closest('article')?.dataset.id;
            if (!target || !orderId) return;
            const remaining = Math.max(0, Math.floor((new Date(target) - Date.now()) / 1000));
            el.textContent = formatDuration(remaining);
            if (remaining === 0) {
                el.className = "countdown font-mono font-bold text-red-600 animate-pulse";
                if (!alertedLateOrders.has(orderId)) {
                    alertedLateOrders.add(orderId);
                    hasJustBecomeLate = true;
                }
            }
        });
        if (hasJustBecomeLate) readySound.play().catch(() => {});
    };
    updateCountdowns();
    countdownUnsub = timerService.subscribe(() => updateCountdowns());
}

async function loadSocketIoClient() {
    if (window.io) return;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/socket.io/socket.io.js';
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function initSocket() {
    try {
        await loadSocketIoClient();
        if (!window.io) return;
        socket = io();
        const user = authService.getUserData ? authService.getUserData() : null;
        const room = user?.restaurantId ? `restaurant_${user.restaurantId}_kitchen` : 'kitchen';
        socket.emit('join_room', room);
        
        socket.on('new_order', (order) => {
            if (!knownOrderIds.has(order.id)) {
                ordersCache.unshift(order);
                knownOrderIds.add(order.id);
                if (order.status === 'pending') receiveSound.play().catch(() => {});
                renderOrders(filterOrders(ordersCache));
                updatePendingBadge(ordersCache);
                showToast('Nouvelle commande en direct !', 'info');
            }
        });

        socket.on('order_status_changed', (order) => {
            const idx = ordersCache.findIndex(o => o.id === order.id);
            if (idx >= 0) {
                ordersCache[idx] = order;
                renderOrders(filterOrders(ordersCache));
            }
        });
    } catch (err) { console.warn('Socket error', err); }
}

// --- Initialisation ---

function updatePendingBadge(orders) {
    try {
        const count = orders.filter((o) => o.status === 'pending').length;
        if (window.adminShell?.setPending) window.adminShell.setPending(count);
        const badge = document.getElementById('pendingOrdersBadge');
        if (badge) badge.textContent = count;
    } catch (error) {}
}

function updateLastUpdated() {
    if (!lastUpdatedEl) return;
    lastUpdatedEl.textContent = `Màj : ${new Date().toLocaleTimeString('fr-FR')}`;
}

function showOrdersSkeleton() {
    if (!ordersList) return;
    ordersList.className = 'grid grid-cols-1 gap-4 xl:grid-cols-5';
    ordersList.innerHTML = ORDER_STATUSES.map((status) => `
        <section class="min-h-[360px] rounded-2xl border ${status.tone} p-3 opacity-60">
            <div class="skeleton mb-3 h-8 w-full rounded-xl"></div>
            <div class="space-y-3">
                <div class="rounded-xl bg-white p-3 shadow-sm"><div class="skeleton h-24 w-full"></div></div>
            </div>
        </section>
    `).join('');
}

// ==========================================
// RESTAURATION DE LA GESTION DES ARCHIVES
// ==========================================

async function loadArchivedOrders() {
    try {
        const response = await ordersService.getAll();
        archivedCache = response.data || [];
    } catch (err) {
        archivedCache = ordersCache;
    }
}

function toggleArchiveDrawer(show = true) {
    if (!archiveDrawer) return;
    if (show) {
        archiveDrawer.classList.remove('pointer-events-none');
        archiveBackdrop?.classList.replace('opacity-0', 'opacity-100');
        archivePanel?.classList.replace('translate-x-full', 'translate-x-0');
        loadArchivedOrders().then(() => renderArchivedOrders());
    } else {
        archiveBackdrop?.classList.replace('opacity-100', 'opacity-0');
        archivePanel?.classList.replace('translate-x-0', 'translate-x-full');
        setTimeout(() => archiveDrawer.classList.add('pointer-events-none'), 300);
    }
}

function renderArchivedOrders() {
    if (!archiveList) return;
    const query = (archiveSearch?.value || '').trim().toLowerCase();
    const showAll = archiveShowAll?.checked;
    const now = Date.now();
    let list = (archivedCache.length) ? [...archivedCache] : [...ordersCache];

    // Si on ne veut pas "Tout voir", on filtre les commandes servies depuis plus de 2h
    if (!showAll) {
        list = list.filter((o) => o.status === 'served' && ((now - new Date(getCreatedAt(o)).getTime()) > MAX_SERVED_DISPLAY_TIME));
    }
    
    // Filtre de recherche
    if (query) {
        list = list.filter((o) => {
            const idShort = (o.id || '').toLowerCase();
            const table = (o.table?.number || o.table?.name || o.table_id || '').toString().toLowerCase();
            return idShort.includes(query.replace(/^#/, '')) || table.includes(query);
        });
    }

    if (!list.length) {
        archiveList.innerHTML = '<div class="p-8 text-center text-gray-400 font-bold text-xs uppercase tracking-widest">Aucune archive</div>';
        return;
    }

    archiveList.innerHTML = list.map((order) => {
        const idShort = (order.id || '').slice(-8);
        const created = formatCreatedAt(getCreatedAt(order));
        const table = escapeHtml(order.table?.number || order.table?.name || order.table_id || '-');
        const total = formatPrice(order.total_price || order.total || 0);

        return `
            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 transition-all">
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black text-gray-400">#${escapeHtml(idShort)}</span>
                        <strong class="truncate text-sm text-gray-700 font-bold">Table ${table}</strong>
                    </div>
                    <div class="text-[10px] text-gray-500 font-medium mt-1">${escapeHtml(created)} • <span class="text-amber-600 font-bold">${escapeHtml(total)}</span></div>
                </div>
                <button data-id="${escapeHtml(order.id)}" class="view-archive-order h-7 px-3 text-[11px] font-bold bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all">Détails</button>
            </div>
        `;
    }).join('');

    // Réattacher les événements sur les nouveaux boutons
    archiveList.querySelectorAll('.view-archive-order').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
                const res = await ordersService.getById(id);
                const order = res.data;
                const detailEl = document.getElementById('archive-detail');
                if (detailEl) {
                    const groups = groupOrderItemsForKitchen(order.items || order.order_items || []);
                    detailEl.classList.remove('hidden');
                    detailEl.innerHTML = `
                        <div class="space-y-3 p-1">
                            <div class="flex items-start justify-between border-b border-gray-100 pb-2">
                                <h4 class="text-xs font-black text-gray-900 uppercase">Commande #${escapeHtml(id.slice(-8))}</h4>
                                <button class="text-gray-400 hover:text-gray-600" id="close-archive-detail"><i class="fas fa-times text-xs"></i></button>
                            </div>
                            <div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                                ${groups.map(g => `<div class="flex justify-between text-[11px] font-bold text-gray-700"><span>${escapeHtml(g.plat_name)}</span><span>x${g.quantity}</span></div>`).join('')}
                            </div>
                            <div class="flex justify-between pt-2 border-t border-dashed border-gray-200 text-xs font-black">
                                <span class="text-gray-400">TOTAL PAYÉ</span>
                                <span class="text-amber-600">${formatPrice(order.total_price || order.total || 0)}</span>
                            </div>
                        </div>
                    `;
                    document.getElementById('close-archive-detail')?.addEventListener('click', () => { detailEl.classList.add('hidden'); });
                }
            } catch (err) { showToast('Erreur détails', 'error'); }
        });
    });
}

// Liaison des écouteurs UI pour l'archive
openArchiveBtn?.addEventListener('click', () => toggleArchiveDrawer(true));
closeArchiveBtn?.addEventListener('click', () => toggleArchiveDrawer(false));
archiveBackdrop?.addEventListener('click', () => toggleArchiveDrawer(false));
archiveShowAll?.addEventListener('change', () => renderArchivedOrders());
archiveSearch?.addEventListener('input', debounce(() => renderArchivedOrders(), 250));

document.addEventListener('keydown', (e) => { 
    if (e.key === 'Escape') {
        toggleArchiveDrawer(false); 
        document.getElementById('archive-detail')?.classList.add('hidden');
    }
});


statusFilter?.addEventListener('change', () => renderOrders(filterOrders(ordersCache)));
tableFilter?.addEventListener('input', debounce(() => renderOrders(filterOrders(ordersCache)), 300));
refreshBtn?.addEventListener('click', () => loadOrders());

await loadOrders();
initSocket();
