import { formatPrice, formatDuration } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, escapeHtml, groupItemsByVariant, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { ordersService } from '../services/ordersService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

const ORDER_STATUSES = [
    { key: 'pending', label: 'En attente', tone: 'bg-yellow-50/50 border-yellow-100', badge: 'bg-amber-50 text-amber-700 border border-amber-200', icon: 'fa-hourglass-start' },
    { key: 'preparing', label: 'En préparation', tone: 'bg-blue-50/50 border-blue-100', badge: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'fa-fire-burner' },
    { key: 'ready', label: 'Prêt', tone: 'bg-green-50/50 border-green-100', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'fa-bell-concierge' },
    { key: 'served', label: 'Servi', tone: 'bg-gray-50/50 border-gray-100', badge: 'bg-gray-100 text-gray-700 border border-gray-200', icon: 'fa-circle-check' },
    { key: 'cancelled', label: 'Annulé', tone: 'bg-red-50/50 border-red-100', badge: 'bg-red-50 text-red-700 border border-red-200', icon: 'fa-ban' }
];

let refreshInterval = null;
let countdownInterval = null;
let ordersCache = [];
let draggedOrderId = '';
let isDragging = false;
let archivedCache = [];

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
// Mémoire des commandes et sons
let knownOrderIds = new Set();
const receiveSound = new Audio('/assets/sounds/new-order.mp3');
const readySound = new Audio('/assets/sounds/order-late.mp3');

// Pour éviter que l'alarme de retard ne boucle à l'infini
let alertedLateOrders = new Set();

const MAX_SERVED_DISPLAY_TIME = 2 * 60 * 60 * 1000; 

function getStatusInfo(status) {
    return ORDER_STATUSES.find((entry) => entry.key === status) || ORDER_STATUSES[0];
}

function getStatusLabel(status) {
    return getStatusInfo(status).label;
}

function getCreatedAt(order) {
    return order.createdAt || order.created_at || order.updatedAt || order.updated_at || '';
}

function formatCreatedAt(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
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
    const status = statusFilter ? statusFilter.value : '';
    const table = tableFilter ? tableFilter.value.trim().toLowerCase() : '';

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
        
        // FIX : On déclare et définit freshOrders ici pour éviter le plantage
        const freshOrders = response.data || [];

        // 🔔 LOGIQUE DE NOTIFICATION SONORE
        if (options.silent && freshOrders.length > 0) {
            let hasNewPendingOrder = false;
            
            freshOrders.forEach(order => {
                // Si la commande est en attente et qu'elle n'était pas dans notre cache précédent
                if (order.status === 'pending' && !knownOrderIds.has(order.id)) {
                    hasNewPendingOrder = true;
                }
            });
            
            if (hasNewPendingOrder) {
                // Déclenchement du son (s'assure que receiveSound est bien déclaré en haut du fichier)
                receiveSound.play().catch(err => {
                    console.warn("Le lecteur audio nécessite une interaction utilisateur préalable.", err);
                });
                
                showToast('Nouvelle commande reçue !', 'success');
            }
        }

        // Mise à jour de la mémoire des IDs connus
        knownOrderIds = new Set(freshOrders.map(order => order.id));
        
        ordersCache = freshOrders;
        renderOrders(filterOrders(ordersCache));
        updatePendingBadge(ordersCache);
        updateLastUpdated();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        if (ordersList) {
            ordersList.innerHTML = '<div class="m-auto rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-xs font-semibold text-red-600">Erreur de rafraîchissement des flux</div>';
        }
    }
}


function updatePendingBadge(orders) {
    try {
        const count = orders.filter((order) => order.status === 'pending').length;
        const badge = document.getElementById('pendingOrdersBadge');
        if (badge) badge.textContent = count;
        if (window.adminShell?.setPending) {
            window.adminShell.setPending(count);
        }
    } catch (error) {
        // Optionnel
    }
}

function updateLastUpdated() {
    if (!lastUpdatedEl) return;
    lastUpdatedEl.textContent = `Màj : ${new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}`;
}

function showOrdersSkeleton() {
    if (!ordersList) return;
    ordersList.className = 'flex gap-4 overflow-x-auto pb-4 scrollbar-thin';
    ordersList.innerHTML = ORDER_STATUSES.map((status) => `
        <section class="flex w-[350px] min-w-[320px] max-w-[360px] flex-col rounded-2xl border ${status.tone} p-3 opacity-60">
            <div class="mb-4 flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                <div class="skeleton h-4 w-24"></div>
                <div class="skeleton h-4 w-6 rounded-full"></div>
            </div>
            <div class="space-y-3 flex-1 overflow-y-auto">
                ${[1, 2].map(() => `
                    <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                        <div class="flex justify-between"><div class="skeleton h-4 w-16"></div><div class="skeleton h-4 w-12 rounded-full"></div></div>
                        <div class="grid grid-cols-2 gap-2"><div class="skeleton h-8 w-full rounded-lg"></div><div class="skeleton h-8 w-full rounded-lg"></div></div>
                        <div class="skeleton h-12 w-full rounded-lg"></div>
                    </div>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function renderOrders(orders) {
    if (!ordersList) return;
    ordersList.className = 'flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x flex-1 min-h-0 items-start';

    const grouped = ORDER_STATUSES.map((status) => {
        let filteredOrders = orders.filter((order) => order.status === status.key);

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
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 border border-gray-200 shadow-inner">${column.orders.length}</span>
            </header>
            
            <div class="kanban-column flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border-2 border-dashed border-transparent p-0.5 transition pr-1.5 scrollbar-thin min-h-[150px]" data-status="${escapeHtml(column.key)}">
                ${column.orders.length ? column.orders.map(renderKanbanCard).join('') : `
                    <div class="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 p-4 text-center text-xs font-semibold text-gray-400 min-h-[120px]">
                        <i class="fas fa-inbox text-lg text-gray-300 mb-1"></i> Déposez une commande ici
                    </div>
                `}
            </div>
        </section>
    `).join('');

    bindKanbanEvents();
    restartCountdowns();
}

function groupOrderItemsForKitchen(items) {
    if (!items || !items.length) return [];
    const groups = {};

    items.forEach((item) => {
        const key = item.plat_id || item.plat_name || item.id;
        if (!groups[key]) {
            groups[key] = {
                plat_name: item.plat_name || item.plat?.name || item.name || 'Article',
                plat_id: item.plat_id,
                quantity: 0,
                total_price: 0,
                variants: []
            };
        }

        groups[key].quantity += Number(item.quantity || 0);
        groups[key].total_price += Number(item.total_price || item.price || 0);

        groupItemsByVariant([item]).forEach((variant) => {
            groups[key].variants.push({
                ...variant,
                quantity: variant.quantity,
                compositions: variant.compositions || []
            });
        });
    });

    return Object.values(groups);
}

function getOrderPrepLabel(order) {
    if (order.status === 'ready') return 'Prêt';
    if (order.status === 'served') return 'Servi';
    if (order.status === 'cancelled') return 'Annulé';

    const itemPrepTimes = (order.items || order.order_items || [])
        .map((item) => Number(item.prep_time || item.preparation_total_minutes || 0))
        .filter((value) => value > 0);

    const maxPrep = Math.max(...itemPrepTimes, 0);
    if (maxPrep > 0) return `${maxPrep} min`;

    if (order.estimated_ready_at) {
        const remaining = Math.max(0, Math.ceil((new Date(order.estimated_ready_at) - Date.now()) / 60000));
        return `${remaining} min`;
    }
    return 'Normal';
}

function renderKanbanCard(order) {
    const statusInfo = getStatusInfo(order.status);
    const createdAt = getCreatedAt(order);
    const createdLabel = createdAt ? new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
    const remainingSeconds = order.estimated_ready_at
        ? Math.max(0, Math.floor((new Date(order.estimated_ready_at) - Date.now()) / 1000))
        : null;
    const prepLabel = getOrderPrepLabel(order);
    const groups = groupOrderItemsForKitchen(order.items || order.order_items || []);

    return `
        <article draggable="true" data-id="${escapeHtml(order.id)}" data-status="${escapeHtml(order.status)}" class="kanban-card cursor-grab rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 active:cursor-grabbing group">
            <div class="mb-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="truncate text-sm font-black text-gray-900 tracking-tight">#${escapeHtml(order.id?.slice(-8) || order.id)}</p>
                    <p class="mt-0.5 text-xs font-medium text-gray-500">
                        <i class="fas fa-table mr-1 text-gray-400"></i>
                        Table <span class="font-bold text-gray-800">${escapeHtml(order.table?.number || order.table?.name || order.table_id || '-')}</span>
                    </p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${statusInfo.badge}">${escapeHtml(statusInfo.label)}</span>
            </div>

            <div class="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50/80 border border-gray-100/60 p-2">
                    <span class="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">Préparation</span>
                    <strong class="text-gray-900 font-bold block mt-0.5">${escapeHtml(prepLabel)}</strong>
                </div>
                <div class="rounded-lg bg-gray-50/80 border border-gray-100/60 p-2">
                    <span class="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</span>
                    <strong class="text-amber-600 font-extrabold block mt-0.5">${formatPrice(order.total_price || order.total || 0)}</strong>
                </div>
            </div>

            <div class="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                ${groups.length ? groups.map((group) => `
                    <div class="rounded-lg border border-gray-100 bg-gray-50/40 p-2 transition-colors group-hover:bg-gray-50">
                        <div class="flex justify-between items-start gap-2">
                            <span class="truncate text-xs font-bold text-gray-800 flex-1">${escapeHtml(group.plat_name)}</span>
                            <span class="text-xs font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">x${group.quantity}</span>
                        </div>
                        ${group.variants.map((variant) => `
                            <div class="mt-1 text-[11px] font-medium text-gray-500 pl-2 border-l border-amber-500">
                                ${escapeHtml(variant.label)}
                                ${variant.compositions.length ? `
                                    <div class="mt-1 flex flex-wrap gap-1">
                                        ${variant.compositions.slice(0, 4).map((composition) => `
                                            <span class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                                                ${escapeHtml(composition.action || '')} ${escapeHtml(composition.composition_name || composition.composition_id || '')}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('') : '<p class="rounded-lg bg-gray-50 p-2 text-xs font-medium text-gray-400 text-center">Aucun plat détaillé</p>'}
            </div>

            ${order.note ? `
                <div class="mt-3 rounded-lg border border-gray-100 bg-yellow-50/80 p-2">
                    <span class="block text-[10px] font-medium text-yellow-600 uppercase tracking-wider"> <i class="fas fa-sticky-note mr-1"></i> Note du client</span>
                    <p class="text-sm text-yellow-800 mt-0.5 whitespace-pre-wrap">${escapeHtml(order.note)}</p>
                </div>
            ` : ''}

            <footer class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                <span class="font-medium"><i class="far fa-clock mr-1 text-gray-300"></i>${createdLabel}</span>
                ${remainingSeconds !== null && !['served', 'cancelled'].includes(order.status) ? `
                    <span class="countdown font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100" data-target="${escapeHtml(order.estimated_ready_at)}">${formatDuration(remainingSeconds)}</span>
                ` : '<span class="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium">Glissez l\'élément</span>'}
            </footer>
        </article>
    `;
}

function bindKanbanEvents() {
    document.querySelectorAll('.kanban-card').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
            draggedOrderId = card.dataset.id || '';
            isDragging = true;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedOrderId);
            card.classList.add('opacity-60', 'ring-2', 'ring-orange-500');
        });

        card.addEventListener('dragend', () => {
            isDragging = false;
            draggedOrderId = '';
            card.classList.remove('opacity-60', 'ring-2', 'ring-orange-500');
            document.querySelectorAll('.kanban-column').forEach((column) => {
                column.classList.remove('border-orange-500', 'bg-orange-50/20');
            });
        });
    });

    document.querySelectorAll('.kanban-column').forEach((column) => {
        column.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (isDragging) {
                column.classList.add('border-orange-500', 'bg-orange-50/20');
            }
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('border-orange-500', 'bg-orange-50/20');
        });

        column.addEventListener('drop', async (event) => {
            event.preventDefault();
            column.classList.remove('border-orange-500', 'bg-orange-50/20');
            const orderId = event.dataTransfer.getData('text/plain') || draggedOrderId;
            const status = column.dataset.status;
            if (orderId && status) {
                await moveOrder(orderId, status);
            }
        });
    });
}

async function moveOrder(orderId, nextStatus) {
    alertedLateOrders.delete(orderId);

    const order = ordersCache.find((entry) => entry.id === orderId);
    if (!order || !nextStatus || order.status === nextStatus) return;
    try {
        // Mutation optimiste de l'UI
        order.status = nextStatus;
        order.updated_at = new Date().toISOString();
        renderOrders(filterOrders(ordersCache));

        await ordersService.updateStatus(orderId, nextStatus);
        showToast(`Commande #${orderId.slice(-6)} déplacée vers ${getStatusLabel(nextStatus)}`, 'success');
        await loadOrders({ silent: true });
    } catch (error) {
        showToast(error.message || 'Erreur de mise à jour', 'error');
        await loadOrders({ silent: true });
    }
}

// function restartCountdowns() {
//     if (countdownInterval) {
//         window.clearInterval(countdownInterval);
//     }
//     const updateCountdowns = () => {
//         document.querySelectorAll('.countdown').forEach((element) => {
//             const target = element.dataset.target;
//             if (!target) return;
//             const remaining = Math.max(0, Math.floor((new Date(target) - Date.now()) / 1000));
//             element.textContent = formatDuration(remaining);
//             if (remaining === 0) {
//                 element.className = "countdown font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse";
//             }
//         });
//     };
//     updateCountdowns();
//     countdownInterval = window.setInterval(updateCountdowns, 1000);
// }
function restartCountdowns() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        let hasJustBecomeLate = false;

        document.querySelectorAll('.countdown').forEach((el) => {
            const target = el.dataset.target;
            const orderId = el.closest('article')?.dataset.id; // On récupère l'ID de la carte
            
            if (!target || !orderId) return;
            
            const diff = Math.max(0, Math.floor((new Date(target) - Date.now()) / 1000));
            el.textContent = formatDuration(diff);
            
            // ⏰ SON 2 : Le temps est écoulé
            if (diff === 0) {
                el.className = "countdown font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse";
                
                // Si la commande vient de passer à zéro et n'a pas encore sonné
                if (!alertedLateOrders.has(orderId)) {
                    alertedLateOrders.add(orderId);
                    hasJustBecomeLate = true;
                }
            }
        });

        // On ne joue le son qu'une seule fois par lot de retard
        if (hasJustBecomeLate) {
            readySound.play().catch(err => console.warn("Lecteur bloqué.", err));
            showToast('Attention : Commande(s) en retard !', 'warning');
        }
    }, 1000);
}

function setupAutoRefresh() {
    if (refreshInterval) {
        window.clearInterval(refreshInterval);
    }
    if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
        refreshInterval = window.setInterval(() => {
            if (!isDragging) {
                loadOrders({ silent: true });
            }
        }, 10000);
    }
}

// ==========================================
// GESTION DES ARCHIVES (TIROIR COULISSANT)
// ==========================================

async function loadArchivedOrders() {
    try {
        const response = await ordersService.getAll();
        archivedCache = response.data || [];
    } catch (err) {
        archivedCache = ordersCache || [];
    }
}

function toggleArchiveDrawer(show = true) {
    if (!archiveDrawer || !archivePanel || !archiveBackdrop) return;
    if (show) {
        archiveDrawer.classList.remove('pointer-events-none');
        archiveBackdrop.classList.replace('opacity-0', 'opacity-100');
        archivePanel.classList.replace('translate-x-full', 'translate-x-0');
        loadArchivedOrders().then(() => renderArchivedOrders());
    } else {
        archiveBackdrop.classList.replace('opacity-100', 'opacity-0');
        archivePanel.classList.replace('translate-x-0', 'translate-x-full');
        setTimeout(() => archiveDrawer.classList.add('pointer-events-none'), 300);
    }
}

function renderArchivedOrders() {
    if (!archiveList) return;
    const query = (archiveSearch?.value || '').trim().toLowerCase();
    const showAll = archiveShowAll?.checked;
    const now = Date.now();
    let list = (archivedCache && archivedCache.length) ? archivedCache.slice() : ordersCache.slice();

    if (!showAll) {
        list = list.filter((o) => o.status === 'served' && ((now - new Date(o.updated_at || o.estimated_ready_at || o.createdAt || o.created_at).getTime()) > MAX_SERVED_DISPLAY_TIME));
    }
    if (query) {
        list = list.filter((o) => {
            const idShort = (o.id || '').toLowerCase();
            const table = (o.table?.number || o.table?.name || o.table_id || '').toString().toLowerCase();
            return idShort.includes(query.replace(/^#/, '')) || table.includes(query);
        });
    }
    if (!list.length) {
        archiveList.innerHTML = '<div class="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center text-sm font-semibold text-gray-400">Aucune commande archivée</div>';
        return;
    }

    archiveList.innerHTML = list.map((order) => {
        const idShort = (order.id || '').slice(-8);
        const created = formatCreatedAt(getCreatedAt(order));
        const table = escapeHtml(order.table?.number || order.table?.name || order.table_id || '-');
        const total = formatPrice(order.total_price || order.total || 0);

        return `
            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 transition-colors">
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-gray-900">#${escapeHtml(idShort)}</span>
                        <strong class="truncate text-sm text-gray-700 font-bold">Table ${table}</strong>
                    </div>
                    <div class="text-xs text-gray-400 font-medium mt-1">${escapeHtml(created)} • <span class="font-extrabold text-amber-600">${escapeHtml(total)}</span></div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button data-id="${escapeHtml(order.id)}" class="view-archive-order inline-flex h-7 px-2.5 items-center text-[11px] font-bold bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all shadow-sm">
                        <i class="fas fa-eye text-gray-400 mr-1.5"></i> Voir
                    </button>
                </div>
            </div>
        `;
    }).join('');

    archiveList.querySelectorAll('.view-archive-order').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!id) return;
            try {
                const res = await ordersService.getById(id);
                const order = res.data;
                const detailEl = document.getElementById('archive-detail');
                if (detailEl) {
                    const groups = groupOrderItemsForKitchen(order.items || order.order_items || []);
                    detailEl.classList.remove('hidden');
                    detailEl.innerHTML = `
                        <div class="space-y-3">
                            <div class="flex items-start justify-between border-b border-gray-200/60 pb-2">
                                <div>
                                    <h4 class="text-xs font-black text-gray-900">Commande #${escapeHtml((order.id||'').slice(-8))}</h4>
                                    <div class="text-[11px] font-medium text-gray-400 mt-0.5">Table ${escapeHtml(order.table?.number || order.table?.name || order.table_id || '-')} • ${escapeHtml(formatCreatedAt(getCreatedAt(order)))}</div>
                                </div>
                                <button class="text-gray-400 hover:text-gray-600 p-1 rounded-lg" id="close-archive-detail"><i class="fas fa-times text-xs"></i></button>
                            </div>
                            <div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                                ${groups.map(g => `
                                    <div class="flex justify-between text-xs font-semibold text-gray-700">
                                        <span class="truncate">${escapeHtml(g.plat_name)}</span>
                                        <span class="font-extrabold text-gray-900">x${g.quantity}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="flex justify-between pt-1.5 border-t border-dashed border-gray-200 text-xs">
                                <span class="font-bold text-gray-400">Total payé</span>
                                <span class="font-black text-amber-600">${formatPrice(order.total_price || order.total || 0)}</span>
                            </div>
                        </div>
                    `;
                    document.getElementById('close-archive-detail')?.addEventListener('click', () => { detailEl.classList.add('hidden'); });
                }
            } catch (err) {
                showToast(err.message || 'Impossible de charger les détails', 'error');
            }
        });
    });
}

// Câblage des écouteurs de l'interface utilisateur
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

autoRefreshCheckbox?.addEventListener('change', setupAutoRefresh);
refreshBtn?.addEventListener('click', () => loadOrders());
statusFilter?.addEventListener('change', () => renderOrders(filterOrders(ordersCache)));
tableFilter?.addEventListener('input', debounce(() => renderOrders(filterOrders(ordersCache)), 300));

// Planification initiale
await loadOrders();
setupAutoRefresh();
