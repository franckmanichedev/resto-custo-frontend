import { escapeHtml, showToast } from '../../../shared/utils/index.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { authService } from '../services/authService.js';
import { dashboardService } from '../services/dashboardService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

function showSkeletons() {
    document.querySelectorAll('.skeleton').forEach((el) => el.classList.remove('hidden'));
    document.querySelectorAll('#stats-today, #stats-pending, #stats-plats, #stats-tables').forEach((el) => {
        if (el) el.setAttribute('aria-busy', 'true');
    });
}

function hideSkeletons() {
    document.querySelectorAll('.skeleton').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('#stats-today, #stats-pending, #stats-plats, #stats-tables').forEach((el) => {
        if (el) el.removeAttribute('aria-busy');
    });
}

async function loadStats() {
    showSkeletons();
    try {
        const { recentOrders, stats } = await dashboardService.loadSnapshot();

        document.getElementById('stats-today').textContent = stats.todayOrders;
        document.getElementById('stats-pending').textContent = stats.pendingOrders;
        document.getElementById('stats-plats').textContent = stats.availablePlats;
        document.getElementById('stats-tables').textContent = stats.activeTables;
        hideSkeletons();

        renderRecentOrders(recentOrders);
            try {
                const chartEl = document.getElementById('salesChart');
                if (chartEl) {
                    const salesSeries = computeSalesSeries(recentOrders);
                    drawSalesChart(chartEl, salesSeries);
                }
            } catch (err) {
                console.warn('Chart render failed', err);
            }
        } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        showToast('Erreur de chargement des données', 'error');
            hideSkeletons();
    }
}

function renderRecentOrders(orders) {
    const container = document.getElementById('recent-orders');

    if (!container) return;

    if (!orders.length) {
        container.innerHTML = '<div class="p-6 text-center text-gray">Aucune commande récente</div>';
        container.setAttribute('role', 'list');
        return;
    }
    container.innerHTML = orders.map((order) => `
        <div class="p-4 flex items-center justify-between hover:bg-gray-50 fade-in" role="listitem">
            <div>
                <p class="font-medium text-gray-200">Commande #${escapeHtml(order.id?.slice(-6) || order.id)}</p>
                <p class="text-sm text-gray">Table ${escapeHtml(order.table?.name || order.table_id || '-')} • ${escapeHtml(order.customer?.name || 'Client')}</p>
            </div>
            <div class="flex items-center gap-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(order.status)}">
                    ${getStatusLabel(order.status)}
                </span>
                <span class="text-sm text-gray">${new Date(order.createdAt || order.created_at || Date.now()).toLocaleTimeString('fr-FR')}</span>
            </div>
        </div>
    `).join('');
}

function getStatusClass(status) {
    const classes = {
        pending: 'bg-yellow-100 text-yellow-700',
        preparing: 'bg-blue-100 text-blue-700',
        ready: 'bg-green-100 text-green-700',
        served: 'bg-gray-100 text-white',
        cancelled: 'bg-red-100 text-red-700'
    };

    return classes[status] || 'bg-gray-100 text-white';
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

function computeSalesSeries(orders) {
    // build simple daily totals for last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const totals = days.map((day) => {
        const dayOrders = orders.filter((o) => (o.createdAt || o.created_at || '').startsWith(day));
        return dayOrders.reduce((sum, o) => sum + (Number(o.total || o.amount || 0) || 0), 0);
    });

    return { labels: days.map(d => d.slice(5)), values: totals };
}

function drawSalesChart(canvas, series) {
    const ctx = canvas.getContext('2d');
    const { values, labels } = series;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padding = 20;
    const barWidth = (width - padding * 2) / values.length * 0.7;
    const maxVal = Math.max(...values, 1);

    // background grid
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#eef2f7';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = padding + (i / 4) * (height - padding * 2);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // bars
    values.forEach((v, idx) => {
        const x = padding + idx * ((width - padding * 2) / values.length) + (((width - padding * 2) / values.length) - barWidth) / 2;
        const h = (v / maxVal) * (height - padding * 2);
        const y = height - padding - h;

        // gradient fill
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(1, '#fca34b');

        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barWidth, h, 6);
        ctx.fill();

        // label
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px Inter, system-ui, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(labels[idx], x + barWidth / 2, height - 6);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}
