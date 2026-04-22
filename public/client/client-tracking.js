import {
    bindChrome,
    escapeHtml,
    formatPrice,
    getStatusLabel,
    getStatusTone,
    loadOrders,
    redirectToLoadingIfNeeded,
    renderOrderStepper,
    showToast
} from './client-core.js';

const renderOrder = (order) => `
    <article class="rounded-[1.8rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Commande</p>
                <h3 class="mt-1 text-lg font-black text-slate-900">${escapeHtml(order.id?.slice(-6) || order.id || '-')}</h3>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-bold ${getStatusTone(order.status)}">${getStatusLabel(order.status)}</span>
        </div>
        <div class="mt-5">${renderOrderStepper(order.status)}</div>
        <div class="mt-5 space-y-3">
            ${(order.items || []).map((item) => `
                <div class="rounded-[1.2rem] bg-slate-50 px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="font-semibold text-slate-900">${escapeHtml(item.plat_name || item.name)}</p>
                            <p class="text-sm text-slate-500">x${Number(item.quantity || 0)}</p>
                        </div>
                        <span class="text-sm font-black text-amber-700">${formatPrice(item.total_price)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadOrders();
        const featured = document.getElementById('trackingFeatured');
        const history = document.getElementById('trackingHistory');
        const empty = document.getElementById('trackingEmpty');
        const orders = payload?.orders || [];

        if (!orders.length) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            featured.innerHTML = renderOrder(orders[0]);
            history.innerHTML = orders.slice(1).map((order) => renderOrder(order)).join('');
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement des commandes', 'error');
    }
}
