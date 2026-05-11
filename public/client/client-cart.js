import { 
    apiRequest, 
    bindChrome, 
    enableSpaNavigation, 
    closeModal, 
    escapeHtml, 
    formatPrice, 
    getImageUrl, 
    getSessionToken, 
    getProfile, 
    getCartCache, 
    loadCart, 
    openModal, 
    redirectTo, 
    redirectToLoadingIfNeeded, 
    renderSkeleton, 
    saveProfile, 
    showToast, 
    updateChrome, 
    withButtonLoading 
} from './client-core.js';

/**
 * Fonction de rendu principal du panier
 */
const renderCart = (payload) => {
    const list = document.getElementById('cartItemsList');
    const empty = document.getElementById('emptyCartMessage');
    const totalContainer = document.getElementById('totalContainer');
    const totalNode = document.getElementById('totalPrice');
    
    const items = payload?.cart?.items || [];

    if (!items.length) {
        if (list) list.innerHTML = '';
        empty?.classList.remove('hidden');
        totalContainer?.classList.add('hidden');
        return;
    }

    empty?.classList.add('hidden');
    totalContainer?.classList.remove('hidden');
    if (totalNode) totalNode.textContent = formatPrice(payload.cart.total_price || 0);

    list.innerHTML = items.map((item) => `
        <article class="liquid-glass rounded-[1.7rem] p-4 mb-4 border border-white/5 shadow-xl transition-all">
            <div class="flex gap-4">
                <img src="${escapeHtml(getImageUrl({ name: item.plat_name }))}" alt="${escapeHtml(item.plat_name)}" 
                     class="h-20 w-20 rounded-[1.3rem] object-cover shadow-lg">
                
                <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <h3 class="truncate text-base font-bold text-white">${escapeHtml(item.plat_name)}</h3>
                            <p class="text-xs text-white/40">${formatPrice(item.plat_price)} / unité</p>
                        </div>
                        <span class="text-sm font-black text-amber-500 whitespace-nowrap">${formatPrice(item.total_price)}</span>
                    </div>

                    ${(item.compositions || []).length ? `
                        <div class="mt-2 flex flex-wrap gap-1">
                            ${item.compositions.map(c => `
                                <span class="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300 uppercase">
                                    Sans ${escapeHtml(c.composition_name || 'ingrédient')}
                                </span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="mt-4 flex items-center justify-between gap-3">
                        <div class="flex items-center rounded-xl bg-black/40 border border-white/10 p-0.5">
                            <button class="flex h-8 w-8 items-center justify-center text-lg font-bold text-white/60 hover:text-amber-500 transition" 
                                    data-cart-minus="${escapeHtml(item.id)}">
                                <i class="fas fa-minus text-xs"></i>
                            </button>
                            <span class="flex h-8 min-w-10 items-center justify-center text-sm font-black text-white">
                                ${Number(item.quantity || 0)}
                            </span>
                            <button class="flex h-8 w-8 items-center justify-center text-lg font-bold text-white/60 hover:text-amber-500 transition" 
                                    data-cart-plus="${escapeHtml(item.id)}">
                                <i class="fas fa-plus text-xs"></i>
                            </button>
                        </div>
                        
                        <button class="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 transition uppercase tracking-tighter" 
                                data-cart-remove="${escapeHtml(item.id)}">
                            <i class="fas fa-trash-alt"></i> Retirer
                        </button>
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    attachCartEvents(items);
};

/**
 * Attachement des événements sur les boutons du panier
 */
const attachCartEvents = (items) => {
    // Bouton Moins (-) ou Supprimer si qté = 1
    document.querySelectorAll('[data-cart-minus]').forEach(node => {
        node.onclick = async () => {
            const item = items.find(entry => entry.id === node.dataset.cartMinus);
            if (!item) return;
            
            try {
                let response;
                if (item.quantity <= 1) {
                    response = await withButtonLoading(node, () => apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}?session_token=${encodeURIComponent(getSessionToken())}`, { method: 'DELETE' }));
                } else {
                    response = await withButtonLoading(node, () => apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}`, { 
                        method: 'PUT', body: { session_token: getSessionToken(), quantity: Number(item.quantity) - 1 } 
                    }));
                }
                updateData(response.data);
            } catch (error) {
                showToast(error.message || 'Erreur modification', 'error');
            }
        };
    });

    // Bouton Plus (+)
    document.querySelectorAll('[data-cart-plus]').forEach(node => {
        node.onclick = async () => {
            const item = items.find(entry => entry.id === node.dataset.cartPlus);
            try {
                const response = await withButtonLoading(node, () => apiRequest(`/front-office/cart/items/${encodeURIComponent(item.id)}`, { 
                    method: 'PUT', body: { session_token: getSessionToken(), quantity: Number(item.quantity) + 1 } 
                }));
                updateData(response.data);
            } catch (error) {
                showToast(error.message || 'Erreur modification', 'error');
            }
        };
    });

    // Bouton Supprimer direct
    document.querySelectorAll('[data-cart-remove]').forEach(node => {
        node.onclick = async () => {
            try {
                const response = await withButtonLoading(node, () => apiRequest(`/front-office/cart/items/${encodeURIComponent(node.dataset.cartRemove)}?session_token=${encodeURIComponent(getSessionToken())}`, { method: 'DELETE' }));
                updateData(response.data);
            } catch (error) {
                showToast(error.message || 'Erreur suppression', 'error');
            }
        };
    });
};

const updateData = (data) => {
    localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data }));
    updateChrome(data);
    renderCart(data);
};

// Initialisation
bindChrome();
enableSpaNavigation({ autoLoad: true });

if (!redirectToLoadingIfNeeded()) {
    (async () => {
        try {
            const cached = getCartCache?.() || null;
            if (cached) renderCart(cached);

            const payload = await loadCart();
            if (payload) {
                renderCart(payload);
                
                document.getElementById('goToMenuBtn')?.addEventListener('click', () => redirectTo('index'));
                
                document.getElementById('checkoutBtn')?.addEventListener('click', () => {
                    const profile = getProfile();
                    openModal(`
                        <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
                            <div class="liquid-glass w-full max-w-md overflow-hidden rounded-[2.2rem] shadow-2xl border border-white/10">
                                <div class="bg-amber-600 px-6 py-5 text-white">
                                    <h3 class="text-xl font-black italic uppercase tracking-tighter">Finaliser la commande</h3>
                                    <p class="text-xs text-white/80">Dernière étape avant la dégustation</p>
                                </div>
                                <div class="space-y-4 p-6 bg-slate-900">
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-amber-500 uppercase ml-2">Votre Nom</label>
                                        <input id="checkoutName" type="text" class="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-amber-500 transition" value="${escapeHtml(profile.name || '')}" placeholder="Ex: Jean Dupont">
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-amber-500 uppercase ml-2">Téléphone</label>
                                        <input id="checkoutPhone" type="tel" class="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-amber-500 transition" value="${escapeHtml(profile.phone || '')}" placeholder="Ex: 690 00 00 00">
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-amber-500 uppercase ml-2">Note (Allergies, cuisson...)</label>
                                        <textarea id="checkoutNote" rows="2" class="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-amber-500 transition" placeholder="Optionnel"></textarea>
                                    </div>
                                    <div class="flex gap-3 pt-2">
                                        <button class="flex-1 rounded-full border border-white/10 py-3 text-sm font-bold text-white/60" data-close-modal>Annuler</button>
                                        <button class="flex-1 rounded-full bg-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/20" id="confirmCheckoutBtn">Envoyer !</button>
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
                            showToast('Nom et téléphone requis.', 'error');
                            return;
                        }

                        saveProfile({ name, phone });
                        
                        try {
                            const response = await withButtonLoading(document.getElementById('confirmCheckoutBtn'), () => apiRequest('/front-office/cart/checkout', { 
                                method: 'POST', body: { session_token: getSessionToken(), customer: { name, phone }, note } 
                            }), 'Envoi...');
                            
                            localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                            closeModal();
                            showToast('Commande envoyée avec succès !', 'success');
                            redirectTo('tracking', response.data?.order?.id ? { order: response.data.order.id } : {});
                        } catch (err) {
                            showToast(err.message || "Erreur lors de l'envoi", 'error');
                        }
                    });
                });
            }
        } catch (error) {
            showToast(error.message || 'Erreur panier', 'error');
        }
    })();
}
