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

// Formatage monétaire localisé par défaut si non disponible globalement
function formatPrice(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(amount || 0);
}

async function loadStats() {
    showSkeletons();
    try {
        const { recentOrders, stats } = await dashboardService.loadSnapshot();

        const todayEl = document.getElementById('stats-today');
        const pendingEl = document.getElementById('stats-pending');
        const platsEl = document.getElementById('stats-plats');
        const tablesEl = document.getElementById('stats-tables');

        if (todayEl) todayEl.textContent = stats.todayOrders;
        if (pendingEl) pendingEl.textContent = stats.pendingOrders;
        if (platsEl) platsEl.textContent = stats.availablePlats;
        if (tablesEl) tablesEl.textContent = stats.activeTables;
        
        hideSkeletons();
        renderRecentOrders(recentOrders || []);

        try {
            const chartEl = document.getElementById('salesChart');
            if (chartEl) {
                const salesSeries = computeSalesSeries(recentOrders || []);
                drawSalesChart(chartEl, salesSeries);
            }
        } catch (err) {
            console.warn('Chart render failed:', err);
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
        container.innerHTML = `
            <div class="p-8 text-center text-sm font-semibold text-gray-400 bg-white">
                <i class="fas fa-inbox text-2xl text-gray-200 block mb-2"></i>
                Aucune commande reçue aujourd'hui
            </div>`;
        return;
    }

    container.innerHTML = orders.map((order) => {
        const orderId = escapeHtml(order.id?.slice(-6) || order.id || '');
        const tableName = escapeHtml(order.table?.name || order.table_id || '-');
        const customerName = escapeHtml(order.customer?.name || 'Client');
        const orderStatus = escapeHtml(order.status || 'pending');
        const timeLabel = new Date(order.createdAt || order.created_at || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors duration-150" role="listitem">
                <div class="min-w-0">
                    <p class="font-extrabold text-sm text-gray-900 tracking-tight">Commande #${orderId}</p>
                    <p class="text-xs font-medium text-gray-500 mt-0.5">
                        <i class="fas fa-table text-gray-400 mr-1"></i> Table <span class="font-bold text-gray-700">${tableName}</span> • 
                        <i class="fas fa-user text-gray-400 mr-1"></i> ${customerName}
                    </p>
                </div>
                <div class="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm ${getStatusClass(orderStatus)}">
                        ${getStatusLabel(orderStatus)}
                    </span>
                    <span class="text-xs font-semibold font-mono text-gray-400 bg-gray-50 px-2 py-0.5 border border-gray-100 rounded-md">
                        <i class="far fa-clock text-[10px] mr-1"></i>${timeLabel}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const classes = {
        pending: 'bg-amber-50 text-amber-700 border border-amber-200',
        preparing: 'bg-blue-50 text-blue-700 border border-blue-200',
        ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        served: 'bg-gray-100 text-gray-700 border border-gray-200',
        cancelled: 'bg-red-50 text-red-700 border border-red-200'
    };
    return classes[status] || 'bg-gray-50 text-gray-600 border border-gray-200';
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

function computeSalesSeries(orders) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const totals = days.map((day) => {
        const dayOrders = orders.filter((o) => (o.createdAt || o.created_at || '').startsWith(day));
        return dayOrders.reduce((sum, o) => sum + (Number(o.total || o.amount || o.total_price || 0) || 0), 0);
    });

    return { labels: days.map(d => d.slice(5).replace('-', '/')), values: totals };
}

function drawSalesChart(canvas, series) {
    const ctx = canvas.getContext('2d');
    const { values, labels } = series;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padding = 24;
    const barWidth = ((width - padding * 2) / values.length) * 0.45; // barres affinées
    const maxVal = Math.max(...values, 1);

    // 1. Fond blanc global de sécurité d'abord
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Grille de fond (Tracée après le fond pour rester visible !)
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
        const y = padding + (i / 3) * (height - padding * 2.5);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // 3. Dessin des barres de données
    values.forEach((v, idx) => {
        const colWidth = (width - padding * 2) / values.length;
        const x = padding + idx * colWidth + (colWidth - barWidth) / 2;
        const h = (v / maxVal) * (height - padding * 2.5);
        const y = height - padding - h;

        // Gradient Orange premium style Shopify
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, '#ea580c'); // orange-600
        grad.addColorStop(1, '#ffedd5'); // orange-100

        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barWidth, h, 6);
        ctx.fill();

        // Affichage des montants survolant la barre si > 0
        if (v > 0) {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 10px Inter, system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(formatPrice(v), x + barWidth / 2, y - 6);
        }

        // Labels temporels sur l'axe X
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'medium 11px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(labels[idx], x + barWidth / 2, height - 6);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) return; // Sécurité si pas de valeur
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

// Chargement initial et planification des tâches
await loadStats();
window.setInterval(loadStats, 30000);
