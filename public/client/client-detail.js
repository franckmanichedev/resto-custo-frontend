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
    (async () => {
        try {
            const unitsNodeInitial = document.getElementById('unitsContainer');
            if (unitsNodeInitial) unitsNodeInitial.innerHTML = renderSkeleton('detail');

            const platId = new URLSearchParams(window.location.search).get('id');
            if (!platId) throw new Error('Plat introuvable.');

            const payload = await loadPlat(platId);
            if (!payload?.plat) throw new Error('Plat introuvable.');

            const plat = payload.plat;
            const compositions = plat.compositions || [];

            // --- ÉTAT DE LA PAGE ---
            const state = {
                quantity: 1,
                units: [{ removed: [] }],
                expanded: false,
                sheetFullscreen: false
            };

            // --- ÉLÉMENTS DOM ---
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
            const addToCartBtn = document.getElementById('addToCartBtn');

            // --- LOGIQUE D'AFFICHAGE ---
            const updateSheetMode = (fullscreen) => {
                state.sheetFullscreen = fullscreen && window.innerWidth < MOBILE_BREAKPOINT;
                bottomSheet?.classList.toggle('is-fullscreen', state.sheetFullscreen);
                if (imageZone) imageZone.style.display = state.sheetFullscreen ? 'none' : '';
            };

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
                    unitsNode.innerHTML = '<div class="glass-card rounded-[1.25rem] p-4 text-sm text-slate-700">Ce plat n\'a pas de personnalisation disponible.</div>';
                    return;
                }
                unitsNode.innerHTML = state.units.map((unit, index) => `
                    <div class="glass-card rounded-[1.25rem] p-4 mb-3 border border-white/5 shadow-sm">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p class="text-sm font-bold text-slate-900">Exemplaire ${index + 1}</p>
                                <p class="text-[11px] text-slate-500 font-medium uppercase tracking-tight">Ingrédients à retirer</p>
                            </div>
                            <span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600 border border-slate-200">
                                ${unit.removed.length} RETRAIT(S)
                            </span>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            ${compositions.map((comp) => {
                                const active = unit.removed.includes(comp.id);
                                return `
                                    <button class="rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95 ${active ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-inner' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}" 
                                            data-toggle-composition="${escapeHtml(comp.id)}" data-unit-index="${index}">
                                        ${active ? '<i class="fas fa-minus-circle mr-1"></i> Sans ' : ''}${escapeHtml(comp.name)}
                                    </button>`;
                            }).join('')}
                        </div>
                    </div>
                `).join('');

                // Re-bind des clics sur les ingrédients
                document.querySelectorAll('[data-toggle-composition]').forEach((node) => {
                    node.onclick = () => {
                        const idx = Number(node.dataset.unitIndex);
                        const compId = node.dataset.toggleComposition;
                        const removed = state.units[idx].removed;
                        state.units[idx].removed = removed.includes(compId) ? removed.filter(id => id !== compId) : [...removed, compId];
                        renderUnits();
                    };
                });
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

            // --- INITIALISATION VISUELLE ---
            image.src = getImageUrl(plat);
            categoryImage.src = getImageUrl({ image_url: plat?.category_details?.image_url || '', name: plat?.categorie_name || plat?.category });
            nameNode.textContent = plat.name;
            priceNode.textContent = formatPrice(plat.price);
            prepNode.textContent = formatDuration(plat.prep_time);
            badges.innerHTML = `
                <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</span>
                ${plat.is_promo ? '<span class="rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-md">PROMO</span>' : ''}
            `;

            // --- GESTION DE LA DISPONIBILITÉ ---
            const orderable = isOrderable(plat, { can_order: payload?.can_order ?? true });
            const consultableDaysNode = document.getElementById('consultableDays');
            
            if (!orderable) {
                const days = Array.isArray(plat.consultable_days) ? plat.consultable_days.map(d => formatDayLabel(d)).join(', ') : '';
                const messageHtml = `
                    <div class="px-4 py-3">
                        <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 ring-1 ring-slate-200 border-l-4 border-amber-500 shadow-sm">
                            Ce plat n'est pas commandable aujourd'hui. <br>Disponible le : <strong>${escapeHtml(days)}</strong>.
                        </div>
                    </div>`;
                if (consultableDaysNode) { consultableDaysNode.classList.remove('hidden'); consultableDaysNode.innerHTML = messageHtml; }
                const footer = document.querySelector('.detail-footer');
                if (footer) footer.innerHTML = messageHtml;
            }

            // --- ÉVÈNEMENTS ---
            document.getElementById('backBtn')?.addEventListener('click', () => window.history.back());
            document.getElementById('qtyMinus')?.addEventListener('click', () => setQuantity(state.quantity - 1));
            document.getElementById('qtyPlus')?.addEventListener('click', () => setQuantity(state.quantity + 1));
            descriptionButton?.addEventListener('click', () => { state.expanded = !state.expanded; renderDescription(); });

            // Drag Bottom Sheet
            let dragStartY = 0;
            dragHandle?.addEventListener('touchstart', (e) => { dragStartY = e.touches[0].clientY; }, { passive: true });
            dragHandle?.addEventListener('touchmove', (e) => {
                const diff = dragStartY - e.touches[0].clientY;
                if (!state.sheetFullscreen && diff > 50) updateSheetMode(true);
                if (state.sheetFullscreen && diff < -50) updateSheetMode(false);
            }, { passive: true });

            // --- AJOUT AU PANIER ---
            addToCartBtn?.addEventListener('click', async () => {
                await withButtonLoading(addToCartBtn, async () => {
                    try {
                        const response = await apiRequest('/front-office/cart/items', {
                            method: 'POST',
                            body: {
                                session_token: getSessionToken(),
                                plat_id: plat.id,
                                line_items: state.units.map(unit => ({
                                    quantity: 1,
                                    composition_actions: unit.removed.map(id => ({ composition_id: id, action: 'removed' }))
                                }))
                            }
                        });
                        
                        localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                        showToast(`${state.quantity} ${plat.name} ajouté(s)`, 'success');
                        await loadCart().catch(() => {});
                        redirectTo('cart');
                    } catch (err) {
                        showToast(err.message || 'Erreur lors de l\'ajout', 'error');
                    }
                }, 'Ajout...');
            });

            // Lancement final
            renderDescription();
            renderUnits();
            syncQuantity();
            updateSheetMode(false);
            void loadCart().catch(() => {});

        } catch (error) {
            showToast(error.message || 'Erreur de chargement', 'error');
            setTimeout(() => redirectTo('index'), 800);
        }
    })();
}
