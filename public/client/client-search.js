import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    formatDuration,
    formatPrice,
    getImageUrl,
    isOrderable,
    loadCart,
    loadMenu,
    redirectTo,
    redirectToLoadingIfNeeded,
    showToast
} from './client-core.js';

const renderChip = (name, active = false) => `
    <button class="rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'}" data-category-chip="${escapeHtml(name)}">
        ${escapeHtml(name)}
    </button>
`;

const renderRow = (plat, payload) => `
    <article class="flex items-center gap-3 rounded-[1.5rem] bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200/70">
        <button class="flex min-w-0 flex-1 items-center gap-3 text-left" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-16 w-16 rounded-2xl object-cover">
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="truncate text-base font-bold text-slate-900">${escapeHtml(plat.name)}</h3>
                        <p class="mt-1 line-clamp-2 text-sm text-slate-600">${escapeHtml(plat.description || 'Sans description')}</p>
                    </div>
                    <span class="text-sm font-black text-amber-700">${formatPrice(plat.price)}</span>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</span>
                    <span>•</span>
                    <span>${formatDuration(plat.prep_time)}</span>
                </div>
            </div>
        </button>
        <button class="flex h-10 w-10 items-center justify-center rounded-full ${isOrderable(plat, payload) ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-200 text-slate-500'}" data-open-detail="${escapeHtml(plat.id)}">
            <i class="fas ${isOrderable(plat, payload) ? 'fa-plus' : 'fa-eye'} text-xs"></i>
        </button>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadMenu();
        const input = document.getElementById('searchInput');
        const chips = document.getElementById('searchCategoriesList');
        const results = document.getElementById('resultsContainer');
        const noResults = document.getElementById('noResults');
        const categories = createCategoryGroups(payload?.plats || []);
        const state = { query: '', category: '' };

        const render = () => {
            const query = state.query.trim().toLowerCase();
            const source = state.category ? (categories.find((entry) => entry.name === state.category)?.plats || []) : (payload.plats || []);
            const filtered = source.filter((plat) => !query || [plat.name, plat.description, plat.categorie_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
            chips.innerHTML = categories.map((entry) => renderChip(entry.name, entry.name === state.category)).join('');
            results.innerHTML = filtered.map((plat) => renderRow(plat, payload)).join('');
            noResults.classList.toggle('hidden', filtered.length > 0);
            document.querySelectorAll('[data-category-chip]').forEach((node) => node.addEventListener('click', () => {
                state.category = state.category === node.dataset.categoryChip ? '' : node.dataset.categoryChip;
                render();
            }));
            document.querySelectorAll('[data-open-detail]').forEach((node) => node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail })));
        };

        input?.addEventListener('input', () => {
            state.query = input.value || '';
            render();
        });

        render();
        void loadCart().catch(() => {});
    } catch (error) {
        showToast(error.message || 'Erreur de chargement de la recherche', 'error');
    }
}
