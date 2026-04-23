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
    <button class="rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-amber-100'}" data-category-filter="${escapeHtml(name)}">
        ${name === 'all' ? 'Toutes' : escapeHtml(name)}
    </button>
`;

const renderCategoryCard = (entry) => `
    <button class="overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl" data-category-filter="${escapeHtml(entry.name)}">
        <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.name)}" class="h-44 w-full object-cover">
        <div class="p-4">
            <div class="flex items-center justify-between gap-3">
                <h3 class="text-lg font-bold text-gray-800">${escapeHtml(entry.name)}</h3>
                <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">${entry.count}</span>
            </div>
        </div>
    </button>
`;

const renderPlat = (plat) => `
    <article class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <button class="block w-full text-left" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-40 w-full object-cover">
            <div class="space-y-2 p-4">
                <div class="flex items-start justify-between gap-3">
                    <h3 class="text-base font-bold text-gray-800">${escapeHtml(plat.name)}</h3>
                    <span class="text-sm font-bold text-amber-700">${formatPrice(plat.price)}</span>
                </div>
                <p class="text-sm text-gray-500">${escapeHtml(plat.description || 'Sans description')}</p>
            </div>
        </button>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadMenu();
        if (payload) {
            const categories = createCategoryGroups(payload?.plats || []);
            const selected = new URLSearchParams(window.location.search).get('category') || 'all';
            const list = document.getElementById('categoryFilters');
            const grid = document.getElementById('categoriesGrid');
            const platsContainer = document.getElementById('categoryPlatsContainer');
            const title = document.getElementById('categoryCurrentTitle');
            const activeEntry = selected === 'all' ? null : categories.find((entry) => entry.name === selected);
            const visiblePlats = activeEntry ? activeEntry.plats : (payload?.plats || []);

            list.innerHTML = [renderChip('all', selected === 'all'), ...categories.map((entry) => renderChip(entry.name, entry.name === selected))].join('');
            grid.innerHTML = categories.map(renderCategoryCard).join('');
            title.textContent = selected === 'all' ? 'Toutes les categories' : selected;

            platsContainer.innerHTML = visiblePlats.length
                ? `<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">${visiblePlats.map(renderPlat).join('')}</div>`
                : '<div class="rounded-2xl bg-white px-5 py-8 text-center text-gray-600 shadow-sm">Aucun plat dans cette categorie.</div>';

            document.querySelectorAll('[data-category-filter]').forEach((node) => {
                node.addEventListener('click', () => {
                    redirectTo('categories', node.dataset.categoryFilter === 'all' ? {} : { category: node.dataset.categoryFilter });
                });
            });
            document.querySelectorAll('[data-open-detail]').forEach((node) => {
                node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail }));
            });

            void loadCart().catch(() => {});
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement des categories', 'error');
    }
}
