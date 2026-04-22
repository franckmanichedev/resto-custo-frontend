import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    formatPrice,
    getImageUrl,
    loadCart,
    loadMenu,
    redirectTo,
    redirectToLoadingIfNeeded,
    showToast
} from './client-core.js';

const renderChip = (name, active = false) => `
    <button class="rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'}" data-category-filter="${escapeHtml(name)}">
        ${name === 'all' ? 'Toutes' : escapeHtml(name)}
    </button>
`;

const renderPlat = (plat) => `
    <article class="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200/70">
        <button class="block w-full text-left" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-40 w-full object-cover">
            <div class="space-y-2 p-4">
                <div class="flex items-start justify-between gap-3">
                    <h3 class="text-base font-bold text-slate-900">${escapeHtml(plat.name)}</h3>
                    <span class="text-sm font-black text-amber-700">${formatPrice(plat.price)}</span>
                </div>
                <p class="text-sm text-slate-600">${escapeHtml(plat.description || 'Sans description')}</p>
            </div>
        </button>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadMenu();
        const categories = createCategoryGroups(payload?.plats || []);
        const selected = new URLSearchParams(window.location.search).get('category') || categories[0]?.name || 'all';
        const list = document.getElementById('categoryFilters');
        const grid = document.getElementById('categoriesGrid');
        const platsContainer = document.getElementById('categoryPlatsContainer');
        const title = document.getElementById('categoryCurrentTitle');
        const visiblePlats = selected === 'all' ? payload.plats || [] : (categories.find((entry) => entry.name === selected)?.plats || []);

        list.innerHTML = [renderChip('all', selected === 'all'), ...categories.map((entry) => renderChip(entry.name, entry.name === selected))].join('');
        grid.innerHTML = categories.map((entry) => `
            <button class="overflow-hidden rounded-[1.6rem] bg-white text-left shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-lg" data-category-filter="${escapeHtml(entry.name)}">
                <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.name)}" class="h-28 w-full object-cover">
                <div class="p-4">
                    <div class="flex items-center justify-between gap-3">
                        <h3 class="text-base font-bold text-slate-900">${escapeHtml(entry.name)}</h3>
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${entry.count}</span>
                    </div>
                </div>
            </button>
        `).join('');
        title.textContent = selected === 'all' ? 'Toutes les categories' : selected;
        platsContainer.innerHTML = visiblePlats.length
            ? `<div class="grid gap-4 md:grid-cols-2">${visiblePlats.map((plat) => renderPlat(plat)).join('')}</div>`
            : '<div class="soft-card rounded-[1.75rem] px-5 py-8 text-center text-slate-600">Aucun plat dans cette categorie.</div>';

        document.querySelectorAll('[data-category-filter]').forEach((node) => node.addEventListener('click', () => redirectTo('categories', node.dataset.categoryFilter === 'all' ? {} : { category: node.dataset.categoryFilter })));
        document.querySelectorAll('[data-open-detail]').forEach((node) => node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail })));
        void loadCart().catch(() => {});
    } catch (error) {
        showToast(error.message || 'Erreur de chargement des categories', 'error');
    }
}
