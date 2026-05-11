import {
    apiRequest,
    bindChrome,
    escapeHtml,
    formatDuration,
    formatDayLabel,
    formatPrice,
    getSessionToken,
    getImageUrl,
    isOrderable,
    loadCart,
    loadPlat,
    redirectTo,
    redirectToLoadingIfNeeded,
    renderSkeleton,
    showToast,
    withButtonLoading
} from './client-core.js';

const MOBILE_BREAKPOINT = 1100;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const unitsNodeInitial = document.getElementById('unitsContainer');
        if (unitsNodeInitial) unitsNodeInitial.innerHTML = renderSkeleton('detail');

        const platId = new URLSearchParams(window.location.search).get('id');
        if (!platId) {
            throw new Error('Plat introuvable.');
        }

        const payload = await loadPlat(platId);
        if (!payload?.plat) {
            throw new Error('Plat introuvable.');
        }
        const plat = payload?.plat;
        const compositions = plat?.compositions || [];
        const state = { quantity: 1, units: [{ removed: [] }], expanded: false, sheetFullscreen: false };
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
        const bottomSheet = document.getElementById('bottomSheet');
        const dragHandle = document.getElementById('dragHandle');
        const imageZone = document.getElementById('detailImageZone');

        const updateSheetMode = (fullscreen) => {
            state.sheetFullscreen = fullscreen && window.innerWidth < MOBILE_BREAKPOINT;
            bottomSheet?.classList.toggle('is-fullscreen', state.sheetFullscreen);
            if (imageZone) {
                imageZone.style.display = state.sheetFullscreen ? 'none' : '';
            }
        };

        image.src = getImageUrl(plat);
        image.alt = plat?.name || 'Plat';
        categoryImage.src = getImageUrl({ image_url: plat?.category_details?.image_url || '', name: plat?.categorie_name || plat?.category });
        categoryImage.alt = plat?.categorie_name || 'Categorie';
        nameNode.textContent = plat.name;
        priceNode.textContent = formatPrice(plat.price);
        prepNode.textContent = formatDuration(plat.prep_time);
        badges.innerHTML = `
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</span>
            ${plat.is_promo ? '<span class="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">PROMO</span>' : ''}
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
                unitsNode.innerHTML = '<div class="glass-card rounded-[1.25rem] p-4 text-sm text-slate-700">Ce plat n a pas de personnalisation disponible.</div>';
                return;
            }

            unitsNode.innerHTML = state.units.map((unit, index) => `
                <div class="glass-card rounded-[1.25rem] p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-bold text-slate-900">Exemplaire ${index + 1}</p>
                            <p class="text-xs text-slate-500">Personnalisation individuelle pour cette portion.</p>
                        </div>
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">${unit.removed.length} retrait(s)</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        ${compositions.map((composition) => {
                            const active = unit.removed.includes(composition.id);
                            return `
                                <button class="rounded-full border px-3 py-2 text-xs font-bold transition ${active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}" data-toggle-composition="${escapeHtml(composition.id)}" data-unit-index="${index}">
                                    ${active ? 'Retire ' : ''}${escapeHtml(composition.name)}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('[data-toggle-composition]').forEach((node) => {
                node.addEventListener('click', () => {
                    const index = Number(node.dataset.unitIndex);
                    const compositionId = node.dataset.toggleComposition;
                    const removed = state.units[index].removed;
                    state.units[index].removed = removed.includes(compositionId)
                        ? removed.filter((entry) => entry !== compositionId)
                        : [...removed, compositionId];
                    renderUnits();
                });
            });
        };

        // Orderability: if the plat is not orderable today, replace footer with availability dates
        const orderable = isOrderable(plat, { can_order: payload?.can_order ?? true });
        const consultableDaysNode = document.getElementById('consultableDays');
        if (!orderable) {
            const days = Array.isArray(plat.consultable_days) ? plat.consultable_days.map((d) => formatDayLabel(d)).join(', ') : '';
            const messageHtml = `
                <div class="px-4 py-3">
                    <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 ring-1 ring-slate-200">
                        Ce plat n'est pas commandable aujourd'hui. Disponible: <strong>${escapeHtml(days)}</strong>.
                    </div>
                </div>
            `;

            // show message inside the sheet (under description)
            if (consultableDaysNode) {
                consultableDaysNode.classList.remove('hidden');
                consultableDaysNode.innerHTML = messageHtml;
            }

            // replace footer (remove qty / total / add to cart)
            const footer = document.querySelector('.detail-footer');
            if (footer) footer.innerHTML = messageHtml;
        }

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

        let dragStartY = 0;
        let dragActive = false;
        const onDragStart = (event) => {
            if (window.innerWidth >= MOBILE_BREAKPOINT) return;
            dragStartY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            dragActive = true;
        };
        const onDragMove = (event) => {
            if (!dragActive) return;
            const currentY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const diff = dragStartY - currentY;
            if (!state.sheetFullscreen && diff > 40) {
                updateSheetMode(true);
                dragActive = false;
            } else if (state.sheetFullscreen && diff < -40) {
                updateSheetMode(false);
                dragActive = false;
            }
        };
        const onDragEnd = () => {
            dragActive = false;
        };

        document.getElementById('backBtn')?.addEventListener('click', () => window.history.back());
        document.getElementById('qtyMinus')?.addEventListener('click', () => setQuantity(state.quantity - 1));
        document.getElementById('qtyPlus')?.addEventListener('click', () => setQuantity(state.quantity + 1));
        descriptionButton?.addEventListener('click', () => {
            state.expanded = !state.expanded;
            renderDescription();
        });
        dragHandle?.addEventListener('mousedown', onDragStart);
        dragHandle?.addEventListener('touchstart', onDragStart, { passive: true });
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove, { passive: true });
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
        window.addEventListener('resize', () => updateSheetMode(false));

        document.getElementById('addToCartBtn')?.addEventListener('click', async () => {
            if (!isOrderable(plat, { can_order: plat.is_orderable_today !== false })) {
                showToast('Ce plat ne peut pas etre commande maintenant.', 'error');
                return;
            }
            try {
                const response = await withButtonLoading(document.getElementById('addToCartBtn'), () => apiRequest('/front-office/cart/items', {
                    method: 'POST',
                    body: {
                        session_token: getSessionToken(),
                        plat_id: plat.id,
                        line_items: state.units.map((unit) => ({
                            quantity: 1,
                            composition_actions: unit.removed.map((compositionId) => ({ composition_id: compositionId, action: 'removed' }))
                        }))
                    }
                }), 'Ajout');
                localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                showToast(`${state.quantity} ${plat.name} ajoute(s) au panier`, 'success');
                await loadCart().catch(() => {});
                redirectTo('cart');
            } catch (error) {
                showToast(error.message || 'Impossible d ajouter ce plat au panier.', 'error');
            }
        });

        renderDescription();
        renderUnits();
        syncQuantity();
        updateSheetMode(false);
        void loadCart().catch(() => {});
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du plat', 'error');
        setTimeout(() => redirectTo('index'), 700);
    }
}
