import {
    apiRequest,
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    formatDuration,
    formatPrice,
    getImageUrl,
    getSessionToken,
    isOrderable,
    loadCart,
    loadMenu,
    redirectTo,
    redirectToLoadingIfNeeded,
    renderSkeleton,
    showToast,
    updateChrome,
    withButtonLoading,
    setButtonLoading
} from './client-core.js';

const renderChip = (name, active = false) => `
    <button class="rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-amber-500 text-white' : 'liquid-glass text-white hover:bg-amber-100'}" data-category-chip="${escapeHtml(name)}">
        ${escapeHtml(name)}
    </button>
`;

const renderRow = (plat, payload) => `
    <article class="liquid-glass mb-3 rounded-2xl p-3">
        <div class="flex items-center gap-3">
            <button class="flex min-w-0 flex-1 items-center gap-3 text-left" data-open-detail="${escapeHtml(plat.id)}">
                <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-14 w-14 rounded-lg object-cover">
                <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                        <h3 class="truncate text-sm font-semibold text-gray-200">
                            ${escapeHtml(
                                plat.name.split(' ').slice(0, 2).join(' ') + (plat.name.split(' ').length > 2 ? '...' : '')
                            )}
                        </h3>
                        <span class="text-sm font-bold text-amber-500">${formatPrice(plat.price)}</span>
                    </div>
                    <p class="text-xs text-gray-400 line-clamp-2">${escapeHtml(plat.description || '')} ${plat.description ? '-' : ''} ${formatDuration(plat.prep_time)}</p>
                    <p class="mt-1 text-xs text-amber-500">${escapeHtml(plat.categorie_name || 'Autres')}</p>
                </div>
            </button>
            <button class="flex h-9 w-9 items-center justify-center rounded-full ${isOrderable(plat, payload) ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-200 text-gray'}" data-add-item="${escapeHtml(plat.id)}" ${isOrderable(plat, payload) ? '' : 'disabled'}>
                <i class="fas ${isOrderable(plat, payload) ? 'fa-plus' : 'fa-eye'} text-xs"></i>
            </button>
        </div>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const chips = document.getElementById('searchCategoriesList');
        const results = document.getElementById('resultsContainer');
        if (chips) chips.innerHTML = renderSkeleton('chips', 5);
        if (results) results.innerHTML = renderSkeleton('rows', 5);

        const payload = await loadMenu();
        if (payload) {
            const input = document.getElementById('searchInput');
            const noResults = document.getElementById('noResults');
            const categories = createCategoryGroups(payload?.plats || []);
            const state = { query: '', category: '' };

            const render = () => {
                const query = state.query.trim().toLowerCase();
                const source = state.category ? (categories.find((entry) => entry.name === state.category)?.plats || []) : (payload?.plats || []);
                const filtered = source.filter((plat) => !query || [plat.name, plat.description, plat.categorie_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));

                chips.innerHTML = categories.map((entry) => renderChip(entry.name, entry.name === state.category)).join('');
                results.innerHTML = filtered.map((plat) => renderRow(plat, payload)).join('');
                noResults.classList.toggle('hidden', filtered.length > 0);

                document.querySelectorAll('[data-category-chip]').forEach((node) => {
                    node.addEventListener('click', () => {
                        state.category = state.category === node.dataset.categoryChip ? '' : node.dataset.categoryChip;
                        render();
                    });
                });
                document.querySelectorAll('[data-open-detail]').forEach((node) => {
                    node.addEventListener('click', () => {
                        setButtonLoading(node, true, 'Ouverture');
                        redirectTo('detail', { id: node.dataset.openDetail });
                    });
                });
                document.querySelectorAll('[data-add-item]').forEach((node) => {
                    node.addEventListener('click', async () => {
                        const plat = filtered.find((entry) => String(entry.id) === String(node.dataset.addItem));
                        if (!plat) return;
                        if (!isOrderable(plat, payload)) {
                            redirectTo('detail', { id: node.dataset.addItem });
                            return;
                        }
                        try {
                            const response = await withButtonLoading(node, () => apiRequest('/front-office/cart/items', {
                                method: 'POST',
                                body: {
                                    session_token: getSessionToken(),
                                    plat_id: plat.id,
                                    quantity: 1
                                }
                            }), 'Ajout');
                            localStorage.setItem('resto.client.cart', JSON.stringify({ savedAt: Date.now(), data: response.data }));
                            updateChrome(response.data);
                            showToast(`${plat.name} ajoute au panier`, 'success');
                            await loadCart().catch(() => {});
                            redirectTo('cart');
                        } catch (error) {
                            showToast(error.message || 'Impossible d ajouter ce plat.', 'error');
                        }
                    });
                });
            };

            input?.addEventListener('input', () => {
                state.query = input.value || '';
                render();
            });

            render();
            void loadCart().catch(() => {});
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement de la recherche', 'error');
    }
}
