import { formatPrice, formatDuration } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, escapeHtml, groupItemsByVariant, debounce } from '../../../shared/utils/index.js';
import { timerService } from '../../../shared/utils/timerService.js';
import { authService } from '../services/authService.js';
import { ordersService } from '../services/ordersService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Acces administrateur requis');
}

const ORDER_STATUSES = [
    { key: 'pending', label: 'En attente', tone: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: 'fa-hourglass-start' },
    { key: 'preparing', label: 'En preparation', tone: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: 'fa-fire-burner' },
    { key: 'ready', label: 'Pret', tone: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: 'fa-bell-concierge' },
    { key: 'served', label: 'Servi', tone: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-white', icon: 'fa-circle-check' },
    { key: 'cancelled', label: 'Annule', tone: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: 'fa-ban' }
];

let countdownUnsub = null;
let ordersCache = [];
let draggedOrderId = '';
let isDragging = false;

const ordersList = document.getElementById('orders-list');
const statusFilter = document.getElementById('status-filter');
const tableFilter = document.getElementById('table-filter');
const refreshBtn = document.getElementById('refresh-orders');
const autoRefreshCheckbox = document.getElementById('auto-refresh');
const lastUpdatedEl = document.getElementById('orders-last-updated');

let socket = null;

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

async function loadOrders(options = {}) {
    if (!options.silent) {
        showOrdersSkeleton();
    }

    try {
        const response = await ordersService.getAll();
        ordersCache = response.data || [];
        renderOrders(filterOrders(ordersCache));
        updatePendingBadge(ordersCache);
        updateLastUpdated();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        ordersList.innerHTML = '<div class="rounded-2xl border border-red-100 bg-red-50 py-12 text-center text-red-600">Erreur de chargement</div>';
    }
}

function updatePendingBadge(orders) {
    try {
        window.adminShell?.setPending(orders.filter((order) => order.status === 'pending').length);
    } catch (error) {
        // Enhancement only.
    }
}

function updateLastUpdated() {
    if (!lastUpdatedEl) return;
    lastUpdatedEl.textContent = `Mis a jour a ${new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}`;
}

function showOrdersSkeleton() {
    if (!ordersList) return;

    ordersList.className = 'grid grid-cols-1 gap-4 xl:grid-cols-5';
    ordersList.innerHTML = ORDER_STATUSES.map((status) => `
        <section class="min-h-[360px] rounded-2xl border ${status.tone} p-3">
            <div class="mb-3 flex items-center justify-between">
                <div class="skeleton h-5 w-28"></div>
                <div class="skeleton h-5 w-8 rounded-full"></div>
            </div>
            <div class="space-y-3">
                ${[1, 2].map(() => `
                    <div class="rounded-xl border border-white/80 bg-white p-3 shadow-sm">
                        <div class="skeleton mb-2 h-4 w-24"></div>
                        <div class="skeleton mb-2 h-3 w-full"></div>
                        <div class="skeleton h-3 w-2/3"></div>
                    </div>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function renderOrders(orders) {
    ordersList.className = 'grid grid-cols-1 gap-4 xl:grid-cols-5';

    const grouped = ORDER_STATUSES.map((status) => ({
        ...status,
        orders: orders.filter((order) => order.status === status.key)
    }));

    ordersList.innerHTML = grouped.map((column) => `
        <section class="kanban-lane flex min-h-[520px] flex-col rounded-2xl border ${column.tone} p-3" data-status="${escapeHtml(column.key)}">
            <header class="mb-3 flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2">
                    <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-white shadow-sm">
                        <i class="fas ${column.icon} text-sm"></i>
                    </span>
                    <h2 class="truncate text-sm font-bold text-gray-200">${escapeHtml(column.label)}</h2>
                </div>
                <span class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-sm">${column.orders.length}</span>
            </header>
            <div class="kanban-column flex min-h-[440px] flex-1 flex-col gap-3 rounded-xl border border-dashed border-transparent p-1 transition" data-status="${escapeHtml(column.key)}">
                ${column.orders.length ? column.orders.map(renderKanbanCard).join('') : `
                    <div class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 p-4 text-center text-xs text-gray-400">
                        Deposez une commande ici
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
    const remainingSeconds = order.estimated_ready_at
        ? Math.max(0, Math.floor((new Date(order.estimated_ready_at) - Date.now()) / 1000))
        : null;
    const prepLabel = getOrderPrepLabel(order);
    const groups = groupOrderItemsForKitchen(order.items || []);

    return `
        <article draggable="true" data-id="${escapeHtml(order.id)}" data-status="${escapeHtml(order.status)}" class="kanban-card cursor-grab rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing">
            <div class="mb-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-sm font-bold text-gray-900">#${escapeHtml(order.id?.slice(-8) || order.id)}</p>
                    <p class="mt-1 text-xs text-gray">
                        <i class="fas fa-table mr-1"></i>
                        Table ${escapeHtml(order.table?.number || order.table?.name || order.table_id || '-')}
                    </p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusInfo.badge}">${escapeHtml(statusInfo.label)}</span>
            </div>

            <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50 px-2 py-1.5">
                    <span class="block text-gray-400">Preparation</span>
                    <strong class="text-white">${escapeHtml(prepLabel)}</strong>
                </div>
                <div class="rounded-lg bg-gray-50 px-2 py-1.5">
                    <span class="block text-gray-400">Total</span>
                    <strong class="text-white">${formatPrice(order.total_price || 0)}</strong>
                </div>
            </div>

            <div class="space-y-2">
                ${groups.length ? groups.map((group) => `
                    <div class="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <div class="flex justify-between gap-2">
                            <span class="truncate text-sm font-semibold text-gray-200">${escapeHtml(group.plat_name || 'Article')}</span>
                            <span class="text-xs font-semibold text-gray">x${group.quantity}</span>
                        </div>
                        ${group.variants.map((variant) => `
                            <div class="mt-1 text-xs text-gray">
                                ${escapeHtml(variant.label)}
                                ${variant.compositions.length ? `
                                    <div class="mt-1 flex flex-wrap gap-1">
                                        ${variant.compositions.slice(0, 4).map((composition) => `
                                            <span class="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray">
                                                ${escapeHtml(composition.action || '')} ${escapeHtml(composition.composition_name || composition.composition_id || '')}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('') : '<p class="rounded-lg bg-gray-50 p-2 text-xs text-gray-400">Aucun plat detaille</p>'}
            </div>

            <footer class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray">
                <span><i class="far fa-clock mr-1"></i>${createdLabel}</span>
                ${remainingSeconds !== null && !['served', 'cancelled'].includes(order.status) ? `
                    <span class="countdown font-mono font-bold text-primary" data-target="${escapeHtml(order.estimated_ready_at)}">${formatDuration(remainingSeconds)}</span>
                ` : '<span>Glissez pour changer</span>'}
            </footer>
        </article>
    `;
}

function groupOrderItemsForKitchen(items) {
    const groups = {};

    items.forEach((item) => {
        const key = item.plat_id || item.plat_name || item.id;

        if (!groups[key]) {
            groups[key] = {
                plat_name: item.plat_name,
                plat_id: item.plat_id,
                quantity: 0,
                total_price: 0,
                variants: []
            };
        }

        groups[key].quantity += Number(item.quantity || 0);
        groups[key].total_price += Number(item.total_price || 0);

        groupItemsByVariant([item]).forEach((variant) => {
            groups[key].variants.push({
                ...variant,
                quantity: variant.quantity,
                compositions: variant.compositions
            });
        });
    });

    return Object.values(groups);
}

function getOrderPrepLabel(order) {
    if (order.status === 'ready') return 'Pret';
    if (order.status === 'served') return 'Servi';
    if (order.status === 'cancelled') return 'Annule';

    const itemPrepTimes = (order.items || [])
        .map((item) => Number(item.prep_time || item.preparation_total_minutes || 0))
        .filter((value) => value > 0);

    const maxPrep = Math.max(...itemPrepTimes, 0);
    if (maxPrep > 0) return `${maxPrep} min`;

    if (order.estimated_ready_at) {
        const remaining = Math.max(0, Math.ceil((new Date(order.estimated_ready_at) - Date.now()) / 60000));
        return `${remaining} min`;
    }

    return '-';
}

function bindKanbanEvents() {
    document.querySelectorAll('.kanban-card').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
            draggedOrderId = card.dataset.id || '';
            isDragging = true;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedOrderId);
            card.classList.add('opacity-60', 'ring-2', 'ring-primary');
        });

        card.addEventListener('dragend', () => {
            isDragging = false;
            draggedOrderId = '';
            card.classList.remove('opacity-60', 'ring-2', 'ring-primary');
            document.querySelectorAll('.kanban-column').forEach((column) => {
                column.classList.remove('border-primary', 'bg-white/70');
            });
        });
    });

    document.querySelectorAll('.kanban-column').forEach((column) => {
        column.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            column.classList.add('border-primary', 'bg-white/70');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('border-primary', 'bg-white/70');
        });

        column.addEventListener('drop', async (event) => {
            event.preventDefault();
            column.classList.remove('border-primary', 'bg-white/70');

            const orderId = event.dataTransfer.getData('text/plain') || draggedOrderId;
            const status = column.dataset.status;
            await moveOrder(orderId, status);
        });
    });
}

async function moveOrder(orderId, nextStatus) {
    const order = ordersCache.find((entry) => entry.id === orderId);
    if (!order || !nextStatus || order.status === nextStatus) return;

    try {
        await ordersService.updateStatus(orderId, nextStatus);
        showToast(`Commande #${orderId.slice(-6)} deplacee vers ${getStatusLabel(nextStatus)}`, 'success');
        await loadOrders({ silent: true });
    } catch (error) {
        showToast(error.message || 'Erreur de mise a jour', 'error');
        await loadOrders({ silent: true });
    }
}

function restartCountdowns() {
    if (countdownUnsub) {
        try { countdownUnsub(); } catch (e) { /* ignore */ }
        countdownUnsub = null;
    }

    const updateCountdowns = () => {
        document.querySelectorAll('.countdown').forEach((element) => {
            const target = element.dataset.target;
            if (!target) return;

            const remaining = Math.max(0, Math.floor((new Date(target) - Date.now()) / 1000));
            element.textContent = formatDuration(remaining);
        });
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
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.head.appendChild(s);
    });
}

async function initSocket() {
    try {
        await loadSocketIoClient();
        if (!window.io) return;
        socket = io();

        const user = authService.getUserData ? authService.getUserData() : null;
        const restId = user?.restaurantId || user?.restaurant_id || null;
        const room = restId ? `restaurant_${restId}_kitchen` : 'kitchen';

        socket.emit('join_room', room);

        socket.on('new_order', (order) => {
            try {
                ordersCache.unshift(order);
                renderOrders(filterOrders(ordersCache));
                updatePendingBadge(ordersCache);
                showToast('Nouvelle commande', 'info');
            } catch (err) {
                console.warn('new_order handler', err);
            }
        });

        socket.on('order_status_changed', (order) => {
            try {
                const idx = ordersCache.findIndex((o) => o.id === order.id);
                if (idx >= 0) ordersCache[idx] = order;
                else ordersCache.unshift(order);
                renderOrders(filterOrders(ordersCache));
                updatePendingBadge(ordersCache);
            } catch (err) {
                console.warn('order_status_changed handler', err);
            }
        });
    } catch (err) {
        console.warn('Socket.io client not available', err);
    }
}

refreshBtn?.addEventListener('click', () => loadOrders());
statusFilter?.addEventListener('change', () => renderOrders(filterOrders(ordersCache)));
tableFilter?.addEventListener('input', debounce(() => renderOrders(filterOrders(ordersCache)), 300));

await loadOrders();
// initialize socket after initial load
initSocket();
