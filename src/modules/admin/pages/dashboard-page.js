import { escapeHtml, showToast } from '../../../shared/utils/index.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { authService } from '../services/authService.js';
import { dashboardService } from '../services/dashboardService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

async function loadStats() {
    try {
        const { recentOrders, stats } = await dashboardService.loadSnapshot();

        document.getElementById('stats-today').textContent = stats.todayOrders;
        document.getElementById('stats-pending').textContent = stats.pendingOrders;
        document.getElementById('stats-plats').textContent = stats.availablePlats;
        document.getElementById('stats-tables').textContent = stats.activeTables;

        renderRecentOrders(recentOrders);
    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        showToast('Erreur de chargement des données', 'error');
    }
}

function renderRecentOrders(orders) {
    const container = document.getElementById('recent-orders');

    if (!container) return;

    if (!orders.length) {
        container.innerHTML = '<div class="p-6 text-center text-gray-500">Aucune commande récente</div>';
        return;
    }

    container.innerHTML = orders.map((order) => `
        <div class="p-4 flex items-center justify-between hover:bg-gray-50">
            <div>
                <p class="font-medium text-gray-800">Commande #${escapeHtml(order.id?.slice(-6) || order.id)}</p>
                <p class="text-sm text-gray-500">Table ${escapeHtml(order.table?.name || order.table_id || '-')} • ${escapeHtml(order.customer?.name || 'Client')}</p>
            </div>
            <div class="flex items-center gap-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}">
                    ${getStatusLabel(order.status)}
                </span>
                <span class="text-sm text-gray-500">${new Date(order.createdAt).toLocaleTimeString('fr-FR')}</span>
            </div>
        </div>
    `).join('');
}

function getStatusClass(status) {
    const classes = {
        pending: 'bg-yellow-100 text-yellow-700',
        preparing: 'bg-blue-100 text-blue-700',
        ready: 'bg-green-100 text-green-700',
        served: 'bg-gray-100 text-gray-700',
        cancelled: 'bg-red-100 text-red-700'
    };

    return classes[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status) {
    const labels = {
        pending: 'En attente',
        preparing: 'En préparation',
        ready: 'Prêt',
        served: 'Servi',
        cancelled: 'Annulé'
    };

    return labels[status] || status;
}

await loadStats();
window.setInterval(loadStats, 30000);
