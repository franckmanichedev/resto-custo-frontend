import { formatPrice, formatDuration } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, escapeHtml, groupItemsByVariant, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { ordersService } from '../services/ordersService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

let refreshInterval = null;
let countdownInterval = null;

const ordersList = document.getElementById('orders-list');
const statusFilter = document.getElementById('status-filter');
const tableFilter = document.getElementById('table-filter');
const refreshBtn = document.getElementById('refresh-orders');
const autoRefreshCheckbox = document.getElementById('auto-refresh');

async function loadOrders() {
    try {
        const status = statusFilter.value;
        const table = tableFilter.value.trim();
        const response = await ordersService.getAll(status ? { status } : {});

        let orders = response.data || [];

        if (table) {
            const search = table.toLowerCase();
            orders = orders.filter((order) =>
                order.table?.number?.toLowerCase().includes(search)
                || order.table?.name?.toLowerCase().includes(search)
            );
        }

        renderOrders(orders);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        ordersList.innerHTML = '<div class="text-center py-12 text-red-500">Erreur de chargement</div>';
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        ordersList.innerHTML = '<div class="text-center py-12 text-gray-500">Aucune commande trouvée</div>';
        return;
    }

    ordersList.innerHTML = orders.map((order) => renderOrderCard(order)).join('');

    document.querySelectorAll('.order-status-select').forEach((select) => {
        select.addEventListener('change', async () => {
            await updateOrderStatus(select.dataset.id, select.value);
        });
    });

    restartCountdowns();
}

function renderOrderCard(order) {
    const statusInfo = getStatusInfo(order.status);
    const createdAt = new Date(order.createdAt).toLocaleString('fr-FR');
    const remainingSeconds = order.estimated_ready_at
        ? Math.max(0, Math.floor((new Date(order.estimated_ready_at) - Date.now()) / 1000))
        : null;
    const kitchenGroups = groupOrderItemsForKitchen(order.items || []);

    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 border-b border-gray-100 bg-gray-50">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-lg">Commande #${escapeHtml(order.id?.slice(-8) || order.id)}</h3>
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}">${statusInfo.text}</span>
                        </div>
                        <div class="flex gap-4 mt-1 text-sm text-gray-500">
                            <span><i class="fas fa-table mr-1"></i>Table ${escapeHtml(order.table?.name || order.table_id || '-')}</span>
                            <span><i class="far fa-clock mr-1"></i>${createdAt}</span>
                            <span><i class="fas fa-user mr-1"></i>${escapeHtml(order.customer?.name || 'Client')}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-xl font-bold text-primary">${formatPrice(order.total_price || 0)}</p>
                        ${order.customer?.phone ? `<p class="text-xs text-gray-500">${escapeHtml(order.customer.phone)}</p>` : ''}
                    </div>
                </div>
            </div>

            <div class="p-4">
                <div class="mb-4">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">À préparer</p>
                    <div class="space-y-3">
                        ${kitchenGroups.map((group) => `
                            <div class="border-l-2 border-primary/30 pl-3">
                                <div class="flex justify-between items-start">
                                    <p class="font-medium">${escapeHtml(group.plat_name)}</p>
                                    <span class="text-sm font-medium">${formatPrice(group.total_price)}</span>
                                </div>
                                ${group.variants.map((variant) => `
                                    <div class="mt-2 text-sm bg-gray-50 rounded-lg p-2">
                                        <div class="flex justify-between">
                                            <span class="font-medium text-gray-700">${escapeHtml(variant.label)}</span>
                                            <span class="text-gray-500">x${variant.quantity}</span>
                                        </div>
                                        ${variant.compositions.length ? `
                                            <div class="flex flex-wrap gap-1 mt-1">
                                                ${variant.compositions.map((composition) => `
                                                    <span class="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                                        ${escapeHtml(composition.action)} ${escapeHtml(composition.composition_name || composition.composition_id)}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
                    <div>
                        ${remainingSeconds !== null && order.status !== 'served' && order.status !== 'cancelled' ? `
                            <div class="flex items-center gap-2 text-sm">
                                <i class="fas fa-hourglass-half text-primary"></i>
                                <span>Temps restant estimé :</span>
                                <span class="countdown font-mono font-bold text-primary" data-target="${escapeHtml(order.estimated_ready_at)}">
                                    ${formatDuration(remainingSeconds)}
                                </span>
                            </div>
                        ` : ''}
                        ${order.note ? `<p class="text-sm text-gray-500 mt-1"><i class="fas fa-comment mr-1"></i>Note: ${escapeHtml(order.note)}</p>` : ''}
                    </div>

                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600">Statut:</label>
                        <select data-id="${escapeHtml(order.id)}" class="order-status-select px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>En attente</option>
                            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>En préparation</option>
                            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Prêt</option>
                            <option value="served" ${order.status === 'served' ? 'selected' : ''}>Servi</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Annulé</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function groupOrderItemsForKitchen(items) {
    const groups = {};

    items.forEach((item) => {
        const key = item.plat_id || item.plat_name;

        if (!groups[key]) {
            groups[key] = {
                plat_name: item.plat_name,
                plat_id: item.plat_id,
                total_price: 0,
                variants: []
            };
        }

        groups[key].total_price += item.total_price || 0;

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

async function updateOrderStatus(orderId, status) {
    try {
        await ordersService.updateStatus(orderId, status);
        showToast(`Statut mis à jour: ${getStatusLabel(status)}`, 'success');
        await loadOrders();
    } catch (error) {
        showToast(error.message || 'Erreur de mise à jour', 'error');
    }
}

function getStatusInfo(status) {
    const infos = {
        pending: { color: 'bg-yellow-100 text-yellow-700', text: 'En attente' },
        preparing: { color: 'bg-blue-100 text-blue-700', text: 'En préparation' },
        ready: { color: 'bg-green-100 text-green-700', text: 'Prêt' },
        served: { color: 'bg-gray-100 text-gray-700', text: 'Servi' },
        cancelled: { color: 'bg-red-100 text-red-700', text: 'Annulé' }
    };

    return infos[status] || infos.pending;
}

function getStatusLabel(status) {
    return getStatusInfo(status).text;
}

function restartCountdowns() {
    if (countdownInterval) {
        window.clearInterval(countdownInterval);
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
    countdownInterval = window.setInterval(updateCountdowns, 1000);
}

function setupAutoRefresh() {
    if (refreshInterval) {
        window.clearInterval(refreshInterval);
    }

    if (autoRefreshCheckbox.checked) {
        refreshInterval = window.setInterval(loadOrders, 10000);
    }
}

autoRefreshCheckbox?.addEventListener('change', setupAutoRefresh);
refreshBtn?.addEventListener('click', loadOrders);
statusFilter?.addEventListener('change', loadOrders);
tableFilter?.addEventListener('input', debounce(loadOrders, 500));

await loadOrders();
setupAutoRefresh();
