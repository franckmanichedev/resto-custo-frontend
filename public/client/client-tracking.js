import {
    bindChrome,
    escapeHtml,
    formatPrice,
    getStatusLabel,
    getStatusTone,
    loadOrders,
    redirectToLoadingIfNeeded,
    showToast
} from './client-core.js';

const STEPS = ['pending', 'preparing', 'ready', 'served'];

const renderStatusBadge = (status) => `<span class="rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(status)}">${escapeHtml(getStatusLabel(status))}</span>`;

const renderOrderDetails = (order) => `
    <div>
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
                <p class="text-sm font-bold text-slate-900">Commande ${escapeHtml(order.id || '-')}</p>
                <p class="text-xs text-slate-500">Total ${formatPrice(order.total_price || order.total || 0)}</p>
            </div>
            ${renderStatusBadge(order.status)}
        </div>
        <div class="space-y-3">
            ${(order.items || []).map((item) => `
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="font-semibold text-slate-900">${escapeHtml(item.plat_name || item.name)}</p>
                            <p class="text-sm text-slate-500">x${Number(item.quantity || 0)}</p>
                        </div>
                        <span class="text-sm font-bold text-amber-700">${formatPrice(item.total_price || item.totalPrice || 0)}</span>
                    </div>
                    ${(item.compositions || []).length ? `
                        <div class="mt-3 flex flex-wrap gap-2">
                            ${(item.compositions || []).map((composition) => `
                                <span class="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                    ${escapeHtml(composition.action)} - ${escapeHtml(composition.composition_name || composition.composition_id)}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
`;

const renderHistoryCard = (order) => `
    <article class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <div class="flex items-start justify-between gap-3">
            <div>
                <p class="text-sm font-bold text-slate-900">${escapeHtml(order.id || '-')}</p>
                <p class="mt-1 text-xs text-slate-500">${(order.items || []).length} ligne(s)</p>
            </div>
            ${renderStatusBadge(order.status)}
        </div>
    </article>
`;

const updateStepper = (status) => {
    const currentIndex = Math.max(0, STEPS.indexOf(status));
    STEPS.forEach((step, index) => {
        document.getElementById(`trackingStep${index + 1}`)?.classList.toggle('is-active', index <= currentIndex);
    });
    const progress = document.getElementById('trackingProgress');
    if (progress) {
        progress.style.width = `${(currentIndex / (STEPS.length - 1)) * 100}%`;
    }
};

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadOrders();
        if (payload) {
            const orders = payload?.orders || [];
            const empty = document.getElementById('trackingEmpty');
            const main = document.getElementById('trackingMain');
            const orderDetails = document.getElementById('orderDetails');
            const historySection = document.getElementById('trackingHistorySection');
            const history = document.getElementById('trackingHistory');

            if (!orders.length) {
                empty.classList.remove('hidden');
                main.classList.add('hidden');
            } else {
                const featured = orders.find((order) => order.status !== 'served' && order.status !== 'cancelled') || orders[0];
                const remaining = orders.filter((order) => order.id !== featured.id);

                empty.classList.add('hidden');
                main.classList.remove('hidden');
                document.getElementById('trackingOrderCode').textContent = featured.id?.slice(-8) || featured.id || '-';
                document.getElementById('trackingOrderMeta').textContent = `Statut: ${getStatusLabel(featured.status)} - ${(featured.items || []).length} ligne(s)`;
                document.getElementById('trackingStatusBadge').className = `rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(featured.status)}`;
                document.getElementById('trackingStatusBadge').textContent = getStatusLabel(featured.status);
                orderDetails.innerHTML = renderOrderDetails(featured);
                updateStepper(featured.status);

                if (remaining.length) {
                    historySection.classList.remove('hidden');
                    history.innerHTML = remaining.map(renderHistoryCard).join('');
                } else {
                    historySection.classList.add('hidden');
                    history.innerHTML = '';
                }
            }
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement des commandes', 'error');
    }
}
