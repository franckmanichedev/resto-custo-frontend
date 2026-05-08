import { formatPrice } from '../../../shared/api/apiClient.js';
import { escapeHtml, debounce } from '../../../shared/utils/index.js';
import { clientsService } from '../services/clientsService.js';

const TOTAL_SPENT_VIP = 50000; // FCFA
const AT_RISK_DAYS = 30;
const REGULAR_ORDER_THRESHOLD = 5;

let clientsCache = [];

const elTotalClients = document.getElementById('total-clients');
const elVipClients = document.getElementById('vip-clients');
const elAtRiskClients = document.getElementById('at-risk-clients');
const elAvgBasket = document.getElementById('avg-basket');
const elClientsList = document.getElementById('clients-list');
const elSearch = document.getElementById('search-clients');
const elExport = document.getElementById('export-clients-btn');
const elSegment = document.getElementById('segment-filter');
const elRefresh = document.getElementById('refresh-clients');

function msDays(days) { return days * 24 * 60 * 60 * 1000; }

function isAtRisk(client) {
    if (!client.last_visit) return true;
    return (Date.now() - new Date(client.last_visit).getTime()) > msDays(AT_RISK_DAYS);
}

function isVip(client) {
    return Number(client.total_spent || 0) > TOTAL_SPENT_VIP;
}

function isRegular(client) {
    return Number(client.order_count || 0) > REGULAR_ORDER_THRESHOLD;
}

function computeMetrics(list) {
    const totalClients = list.length;
    const vip = list.filter(isVip).length;
    const atRisk = list.filter(isAtRisk).length;
    const avgBasket = totalClients ? (list.reduce((s, c) => s + Number(c.total_spent || 0), 0) / totalClients) : 0;

    return { totalClients, vip, atRisk, avgBasket };
}

function renderMetrics(list) {
    const { totalClients, vip, atRisk, avgBasket } = computeMetrics(list);
    if (elTotalClients) elTotalClients.textContent = totalClients;
    if (elVipClients) elVipClients.textContent = vip;
    if (elAtRiskClients) elAtRiskClients.textContent = atRisk;
    if (elAvgBasket) elAvgBasket.textContent = formatPrice(avgBasket);
}

function renderClientRow(client) {
    const lastVisit = client.last_visit ? new Date(client.last_visit).toLocaleDateString('fr-FR') : '-';
    return `
        <div class="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white">
            <div class="min-w-0">
                <div class="flex items-center gap-2">
                    <strong class="truncate text-sm text-gray-800">${escapeHtml(client.name || client.id)}</strong>
                    <span class="text-xs text-gray-400">${escapeHtml(client.phone || '')}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">Commandes: <span class="font-semibold text-gray-700">${escapeHtml(client.order_count || 0)}</span> • Dernière visite: ${escapeHtml(lastVisit)}</div>
            </div>
            <div class="flex items-center gap-2">
                <div class="text-sm font-bold text-amber-600">${escapeHtml(formatPrice(client.total_spent || 0))}</div>
                <button data-id="${escapeHtml(client.id)}" class="px-3 py-1 rounded-md border text-sm view-client-btn">Voir</button>
            </div>
        </div>
    `;
}

function renderClients(list) {
    if (!elClientsList) return;
    elClientsList.innerHTML = list.length ? list.map(renderClientRow).join('') : '<div class="text-sm text-gray-500 p-4">Aucun client</div>';

    // attach view handlers
    elClientsList.querySelectorAll('.view-client-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
                const res = await clientsService.getById(id);
                const client = res.data;
                alert(`Client: ${client.name}\nPhone: ${client.phone}\nTotal: ${formatPrice(client.total_spent || 0)}`);
            } catch (err) {
                console.error(err);
                alert('Impossible de charger le client');
            }
        });
    });
}

async function loadClients() {
    try {
        const res = await clientsService.getAll();
        clientsCache = res.data || [];
        renderMetrics(clientsCache);
        renderClients(clientsCache);
    } catch (err) {
        console.error(err);
        if (elClientsList) elClientsList.innerHTML = '<div class="text-sm text-red-500 p-4">Erreur de chargement</div>';
    }
}

function filterClients(query, segment) {
    const q = String(query || '').trim().toLowerCase();
    let list = clientsCache.slice();

    if (q) {
        list = list.filter((c) => (String(c.name || '').toLowerCase().includes(q)) || (String(c.phone || '').toLowerCase().includes(q)));
    }

    if (segment === 'vip') list = list.filter(isVip);
    if (segment === 'at_risk') list = list.filter(isAtRisk);
    if (segment === 'loyal') list = list.filter(isRegular);

    return list;
}

function handleSearch() {
    const segment = elSegment?.value || 'all';
    const list = filterClients(elSearch?.value || '', segment);
    renderMetrics(list);
    renderClients(list);
}

function exportCSV(list) {
    const rows = [ ['id','name','phone','total_spent','order_count','last_visit'] ];
    list.forEach((c) => rows.push([c.id, c.name || '', c.phone || '', Number(c.total_spent || 0), Number(c.order_count || 0), c.last_visit || '']));
    const csv = rows.map(r => r.map(String).map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_export_${(new Date()).toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Wire events
elSearch?.addEventListener('input', debounce(handleSearch, 300));
elExport?.addEventListener('click', () => {
    const segment = elSegment?.value || 'all';
    const list = filterClients(elSearch?.value || '', segment);
    exportCSV(list);
});
elSegment?.addEventListener('change', handleSearch);
elRefresh?.addEventListener('click', loadClients);

// Initial load
loadClients();
