import { 
    bindChrome, 
    escapeHtml, 
    formatPrice, 
    
    getStatusLabel, 
    getStatusTone, 
    loadOrders, 
    redirectToLoadingIfNeeded, 
    renderSkeleton, 
    showToast 
} from './client-core.js';

// Configuration des étapes de la commande
const STEPS = ['pending', 'preparing', 'ready', 'served'];

/**
 * Rendu du badge de statut avec les classes de tons dynamiques
 */
const renderStatusBadge = (status) => `
    <span class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusTone(status)} shadow-sm">
        ${escapeHtml(getStatusLabel(status))}
    </span>`;

/**
 * Rendu du bloc de détails d'une commande (Featured)
 */
const renderOrderDetails = (order) => `
    <div class="animate-fade-in">
        <div class="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-4">
            <div>
                <p class="text-xs font-bold uppercase tracking-widest text-amber-500">ID Commande</p>
                <p class="text-sm font-mono text-black/80">${escapeHtml(order.id || '-')}</p>
                <p class="mt-2 text-lg font-black text-black">Total: ${formatPrice(order.total_price || order.total || 0)}</p>
            </div>
            <div class="text-right">
                ${renderStatusBadge(order.status)}
                ${order.estimated_ready_at && !['served','cancelled'].includes(order.status) ? `<div id="trackingCountdown" class="mt-2 font-mono text-sm font-black text-amber-500" data-target="${escapeHtml(order.estimated_ready_at)}">${formatCountdown(Math.max(0, Math.floor((new Date(order.estimated_ready_at) - Date.now()) / 1000)))}</div>` : ''}
            </div>
        </div>
        <div class="space-y-4">
            ${(order.items || []).map((item) => `
                <div class="rounded-2xl bg-white/5 border border-black/5 px-4 py-4 transition-all">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="font-bold text-black truncate">${escapeHtml(item.plat_name || item.name)}</p>
                            <p class="text-xs font-medium text-black/40 uppercase">Quantité: ${Number(item.quantity || 0)}</p>
                        </div>
                        <span class="text-sm font-black text-amber-500 whitespace-nowrap">${formatPrice(item.total_price || item.totalPrice || 0)}</span>
                    </div>
                    ${(item.compositions || []).length ? `
                        <div class="mt-3 flex flex-wrap gap-2 pt-3 border-t border-white/5">
                            ${(item.compositions || []).map((comp) => `
                                <span class="rounded-full bg-rose-500/10 px-2 py-1 text-[9px] font-bold text-rose-800 ring-1 ring-rose-500/20 uppercase">
                                    ${escapeHtml(comp.action === 'removed' ? 'SANS' : comp.action)} ${escapeHtml(comp.composition_name || comp.composition_id)}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
`;

/**
 * Rendu d'une carte simplifiée pour l'historique
 */
const renderHistoryCard = (order) => `
    <article class="liquid-glass rounded-2xl p-4 border border-white/5 opacity-80 hover:opacity-100 transition-opacity">
        <div class="flex items-start justify-between gap-3">
            <div>
                <p class="text-xs font-black text-white uppercase tracking-tighter">Commande #${order.id?.slice(-5) || '-'}</p>
                <p class="mt-1 text-[11px] font-medium text-white/40">${(order.items || []).length} article(s) • ${formatPrice(order.total_price || 0)}</p>
            </div>
            ${renderStatusBadge(order.status)}
        </div>
    </article>
`;

/**
 * Mise à jour de la barre de progression (Stepper)
 */
const updateStepper = (status) => {
    const currentIndex = Math.max(0, STEPS.indexOf(status));
    
    STEPS.forEach((step, index) => {
        const stepCircle = document.getElementById(`trackingStep${index + 1}`);
        if (stepCircle) {
            // Si l'étape est atteinte ou dépassée
            const isActive = index <= currentIndex;
            stepCircle.classList.toggle('is-active', isActive);
            
            // Style dynamique pour le cercle
            if (isActive) {
                stepCircle.classList.add('bg-amber-500', 'border-amber-500', 'text-white', 'shadow-lg', 'shadow-amber-500/20');
                stepCircle.classList.remove('bg-white', 'text-gray');
            } else {
                stepCircle.classList.remove('bg-amber-500', 'border-amber-500', 'text-white');
                stepCircle.classList.add('bg-white', 'text-gray');
            }
        }
    });

    const progress = document.getElementById('trackingProgress');
    if (progress) {
        // On calcule le pourcentage de progression (0 à 100%)
        const percent = (currentIndex / (STEPS.length - 1)) * 100;
        progress.style.width = `${percent}%`;
        progress.classList.add('bg-amber-500', 'transition-all', 'duration-700');
    }
};

// --- INITIALISATION ---
bindChrome();

// Countdown interval handle
let trackingCountdownInterval = null;

const formatCountdown = (seconds) => {
    const s = Math.max(0, Number(seconds || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

const startTrackingCountdown = (order) => {
    // clear previous
    if (trackingCountdownInterval) {
        clearInterval(trackingCountdownInterval);
        trackingCountdownInterval = null;
    }
    if (!order || !order.estimated_ready_at || ['served','cancelled'].includes(order.status)) return;
    const el = document.getElementById('trackingCountdown');
    if (!el) return;
    const target = new Date(el.dataset.target);
    const update = () => {
        const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
        el.textContent = formatCountdown(remaining);
        if (remaining === 0) {
            el.classList.remove('text-amber-500');
            el.classList.add('text-red-600', 'animate-pulse');
        }
    };
    update();
    trackingCountdownInterval = setInterval(update, 1000);
};

const stopTrackingCountdown = () => {
    if (trackingCountdownInterval) {
        clearInterval(trackingCountdownInterval);
        trackingCountdownInterval = null;
    }
};

if (!redirectToLoadingIfNeeded()) {
    (async () => {
        try {
            const orderDetails = document.getElementById('orderDetails');
            const main = document.getElementById('trackingMain');
            
            if (orderDetails) orderDetails.innerHTML = renderSkeleton('rows', 3);
            main?.classList.remove('hidden');

            const payload = await loadOrders();
            
            if (payload) {
                const orders = payload?.orders || [];
                const empty = document.getElementById('trackingEmpty');
                const main = document.getElementById('trackingMain');
                const historySection = document.getElementById('trackingHistorySection');
                const history = document.getElementById('trackingHistory');

                if (!orders.length) {
                    empty?.classList.remove('hidden');
                    main?.classList.add('hidden');
                } else {
                    // On cherche la commande active (non servie et non annulée)
                    const featured = orders.find((o) => o.status !== 'served' && o.status !== 'cancelled') || orders[0];
                    const remaining = orders.filter((o) => o.id !== featured.id);

                    empty?.classList.add('hidden');
                    main?.classList.remove('hidden');

                    // Mise à jour de l'en-tête de suivi
                    const codeNode = document.getElementById('trackingOrderCode');
                    if (codeNode) codeNode.textContent = featured.id?.slice(-8).toUpperCase() || featured.id || '-';
                    
                    const metaNode = document.getElementById('trackingOrderMeta');
                    if (metaNode) metaNode.textContent = `${getStatusLabel(featured.status)} • ${(featured.items || []).length} article(s)`;

                    const badge = document.getElementById('trackingStatusBadge');
                    if (badge) {
                        badge.className = `rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusTone(featured.status)}`;
                        badge.textContent = getStatusLabel(featured.status);
                    }

                    // Rendu du contenu
                    if (orderDetails) orderDetails.innerHTML = renderOrderDetails(featured);
                    updateStepper(featured.status);
                    // start countdown for featured order
                    startTrackingCountdown(featured);

                    // Historique
                    if (remaining.length) {
                        historySection?.classList.remove('hidden');
                        if (history) history.innerHTML = remaining.map(renderHistoryCard).join('');
                    } else {
                        historySection?.classList.add('hidden');
                    }
                    // stop countdown if there is no featured or it's served
                    if (!featured || ['served','cancelled'].includes(featured.status)) stopTrackingCountdown();
                }
            }
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erreur lors du chargement des commandes', 'error');
        }
    })();
}
