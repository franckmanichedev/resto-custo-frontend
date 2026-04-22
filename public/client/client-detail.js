import {
    apiRequest,
    bindChrome,
    escapeHtml,
    formatDuration,
    formatPrice,
    getSessionToken,
    getImageUrl,
    isOrderable,
    loadCart,
    loadPlat,
    redirectToLoadingIfNeeded,
    showToast
} from './client-core.js';

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const platId = new URLSearchParams(window.location.search).get('id');
        const payload = await loadPlat(platId);
        const plat = payload?.plat;
        const compositions = plat?.compositions || [];
        const state = { quantity: 1, units: [{ removed: [] }], expanded: false };
        const image = document.getElementById('platImage');
        const categoryImage = document.getElementById('categorieImage');
        const nameNode = document.getElementById('platNom');
        const badges = document.getElementById('badgesContainer');
        const description = document.getElementById('platDescription');
        const descriptionButton = document.getElementById('seeMoreBtn');
        const priceNode = document.getElementById('prixUnitaire');
        const prepNode = document.getElementById('tempsPrep');
        const unitsNode = document.getElementById('unitsContainer');
        const totalNode = document.getElementById('totalPrice');
        const qtyValue = document.getElementById('qtyValue');

        image.src = getImageUrl(plat);
        categoryImage.src = getImageUrl({ image_url: plat?.category_details?.image_url || '', name: plat?.categorie_name || plat?.category });
        nameNode.textContent = plat.name;
        priceNode.textContent = formatPrice(plat.price);
        prepNode.textContent = formatDuration(plat.prep_time);
        badges.innerHTML = `
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</span>
            ${plat.is_promo ? '<span class="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">Promo</span>' : ''}
        `;

        const renderDescription = () => {
            const fullText = plat.description || 'Aucune description disponible.';
            if (fullText.length <= 140) {
                description.textContent = fullText;
                descriptionButton.classList.add('hidden');
                return;
            }
            description.textContent = state.expanded ? fullText : `${fullText.slice(0, 140)}...`;
            descriptionButton.classList.remove('hidden');
            descriptionButton.textContent = state.expanded ? 'Voir moins' : 'Voir plus';
        };

        const renderUnits = () => {
            if (!compositions.length) {
                unitsNode.innerHTML = '<div class="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200">Ce plat n a pas de personnalisation disponible.</div>';
                return;
            }

            unitsNode.innerHTML = state.units.map((unit, index) => `
                <div class="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-bold text-slate-900">Exemplaire ${index + 1}</p>
                            <p class="text-xs text-slate-500">Retirez les compositions que vous ne souhaitez pas.</p>
                        </div>
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">${unit.removed.length} retrait(s)</span>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${compositions.map((composition) => {
                            const active = unit.removed.includes(composition.id);
                            return `
                                <button class="rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}" data-toggle-composition="${escapeHtml(composition.id)}" data-unit-index="${index}">
                                    ${active ? 'Retire' : 'Garder'} ${escapeHtml(composition.name)}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('[data-toggle-composition]').forEach((node) => node.addEventListener('click', () => {
                const index = Number(node.dataset.unitIndex);
                const compositionId = node.dataset.toggleComposition;
                const removed = state.units[index].removed;
                state.units[index].removed = removed.includes(compositionId) ? removed.filter((entry) => entry !== compositionId) : [...removed, compositionId];
                renderUnits();
            }));
        };

        const syncQuantity = () => {
            qtyValue.textContent = String(state.quantity);
            totalNode.textContent = formatPrice(Number(plat.price || 0) * state.quantity);
        };

        const setQuantity = (nextValue) => {
            state.quantity = Math.max(1, Math.min(20, nextValue));
            while (state.units.length < state.quantity) state.units.push({ removed: [] });
            if (state.units.length > state.quantity) state.units = state.units.slice(0, state.quantity);
            renderUnits();
            syncQuantity();
        };

        document.getElementById('backToMenuBtn')?.addEventListener('click', () => window.history.back());
        document.getElementById('qtyMinus')?.addEventListener('click', () => setQuantity(state.quantity - 1));
        document.getElementById('qtyPlus')?.addEventListener('click', () => setQuantity(state.quantity + 1));
        descriptionButton?.addEventListener('click', () => {
            state.expanded = !state.expanded;
            renderDescription();
        });

        document.getElementById('addToCartBtn')?.addEventListener('click', async () => {
            if (!isOrderable(plat, { can_order: plat.is_orderable_today !== false })) {
                showToast('Ce plat ne peut pas etre commande maintenant.', 'error');
                return;
            }
            try {
                const response = await apiRequest('/front-office/cart/items', {
                    method: 'POST',
                    body: {
                        session_token: getSessionToken(),
                        plat_id: plat.id,
                        line_items: state.units.map((unit) => ({
                            quantity: 1,
                            composition_actions: unit.removed.map((compositionId) => ({ composition_id: compositionId, action: 'removed' }))
                        }))
                    }
                });
                localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                showToast(`${state.quantity} ${plat.name} ajoute(s) au panier`, 'success');
                await loadCart().catch(() => {});
            } catch (error) {
                showToast(error.message || 'Impossible d ajouter ce plat au panier.', 'error');
            }
        });

        renderDescription();
        renderUnits();
        syncQuantity();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du plat', 'error');
    }
}
