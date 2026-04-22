import {
    apiRequest,
    bindChrome,
    closeModal,
    escapeHtml,
    formatPrice,
    getImageUrl,
    getSessionToken,
    getProfile,
    loadCart,
    openModal,
    redirectTo,
    redirectToLoadingIfNeeded,
    saveProfile,
    showToast,
    updateChrome
} from './client-core.js';

const renderCart = (payload) => {
    const list = document.getElementById('cartItemsList');
    const empty = document.getElementById('emptyCartMessage');
    const totalContainer = document.getElementById('totalContainer');
    const totalNode = document.getElementById('totalPrice');
    const items = payload?.cart?.items || [];

    if (!items.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        totalContainer.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    totalContainer.classList.remove('hidden');
    totalNode.textContent = formatPrice(payload.cart.total_price || 0);
    list.innerHTML = items.map((item) => `
        <article class="rounded-[1.7rem] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div class="flex gap-4">
                <img src="${escapeHtml(getImageUrl({ name: item.plat_name }))}" alt="${escapeHtml(item.plat_name)}" class="h-20 w-20 rounded-[1.3rem] object-cover">
                <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <h3 class="text-base font-bold text-slate-900">${escapeHtml(item.plat_name)}</h3>
                            <p class="mt-1 text-sm text-slate-500">${formatPrice(item.plat_price)} l unite</p>
                        </div>
                        <p class="text-sm font-black text-amber-700">${formatPrice(item.total_price)}</p>
                    </div>
                    ${(item.compositions || []).length ? `
                        <div class="mt-3 flex flex-wrap gap-2">
                            ${(item.compositions || []).map((composition) => `<span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(composition.action)} - ${escapeHtml(composition.composition_name || composition.composition_id)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="mt-4 flex items-center justify-between gap-3">
                        <div class="flex items-center overflow-hidden rounded-full bg-slate-100">
                            <button class="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-700" data-cart-minus="${escapeHtml(item.id)}">-</button>
                            <span class="flex h-10 min-w-12 items-center justify-center text-sm font-bold text-slate-900">${Number(item.quantity || 0)}</span>
                            <button class="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-700" data-cart-plus="${escapeHtml(item.id)}">+</button>
                        </div>
                        <button class="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" data-cart-remove="${escapeHtml(item.id)}">Retirer</button>
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    document.querySelectorAll('[data-cart-minus]').forEach((node) => node.addEventListener('click', async () => {
        const item = items.find((entry) => entry.id === node.dataset.cartMinus);
        const response = item.quantity <= 1
            ? await apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}?session_token=${encodeURIComponent(getSessionToken())}`, { method: 'DELETE' })
            : await apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}`, { method: 'PUT', body: { session_token: getSessionToken(), quantity: Number(item.quantity) - 1 } });
        localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
        updateChrome(response.data);
        renderCart(response.data);
    }));

    document.querySelectorAll('[data-cart-plus]').forEach((node) => node.addEventListener('click', async () => {
        const item = items.find((entry) => entry.id === node.dataset.cartPlus);
        const response = await apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}`, { method: 'PUT', body: { session_token: getSessionToken(), quantity: Number(item.quantity) + 1 } });
        localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
        updateChrome(response.data);
        renderCart(response.data);
    }));

    document.querySelectorAll('[data-cart-remove]').forEach((node) => node.addEventListener('click', async () => {
        const response = await apiRequest(`/front-office/cart/items/${encodeURIComponent(node.dataset.cartRemove)}?session_token=${encodeURIComponent(getSessionToken())}`, { method: 'DELETE' });
        localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
        updateChrome(response.data);
        renderCart(response.data);
    }));
};

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadCart();
        renderCart(payload);

        document.getElementById('goToMenuBtn')?.addEventListener('click', () => redirectTo('index'));
        document.getElementById('checkoutBtn')?.addEventListener('click', () => {
            const profile = getProfile();
            openModal(`
                <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-8">
                    <div class="w-full max-w-md overflow-hidden rounded-[1.8rem] bg-white shadow-2xl">
                        <div class="bg-slate-950 px-5 py-4 text-white">
                            <p class="text-xs uppercase tracking-[0.3em] text-white/60">Validation</p>
                            <h3 class="mt-2 text-xl font-black">Finaliser la commande</h3>
                        </div>
                        <div class="space-y-4 p-5">
                            <input id="checkoutName" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" value="${escapeHtml(profile.name || '')}" placeholder="Votre nom">
                            <input id="checkoutPhone" type="tel" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" value="${escapeHtml(profile.phone || '')}" placeholder="Votre telephone">
                            <textarea id="checkoutNote" rows="3" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" placeholder="Note pour la cuisine (optionnel)"></textarea>
                            <div class="flex gap-3">
                                <button class="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600" data-close-modal>Annuler</button>
                                <button class="flex-1 rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-white" id="confirmCheckoutBtn">Commander</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            document.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
            document.getElementById('confirmCheckoutBtn')?.addEventListener('click', async () => {
                const name = document.getElementById('checkoutName')?.value.trim() || '';
                const phone = document.getElementById('checkoutPhone')?.value.trim() || '';
                const note = document.getElementById('checkoutNote')?.value.trim() || '';
                if (!name || !phone) {
                    showToast('Veuillez renseigner votre nom et votre telephone.', 'error');
                    return;
                }
                saveProfile({ name, phone });
                const response = await apiRequest('/front-office/cart/checkout', { method: 'POST', body: { session_token: getSessionToken(), customer: { name, phone }, note } });
                localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                closeModal();
                showToast('Commande envoyee avec succes.', 'success');
                redirectTo('tracking', response.data?.order?.id ? { order: response.data.order.id } : {});
            });
        });
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du panier', 'error');
    }
}
