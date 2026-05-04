import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    loadCart,
    loadMenu,
    redirectTo,
    redirectToLoadingIfNeeded,
    renderSkeleton,
    setButtonLoading,
    showToast
} from './client-core.js';

const renderCategoryCard = (entry) => `
    <button class="liquid-glass min-w-0 overflow-hidden rounded-2xl text-left transition hover:-translate-y-1" data-open-category="${escapeHtml(entry.name)}">
        <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.name)}" class="aspect-square w-full object-cover">
        <div class="p-2">
            <h3 class="truncate text-xs font-black text-gray-300">${escapeHtml(entry.name)}</h3>
            <p class="mt-1 text-[11px] font-semibold text-amber-500">${entry.count} plat(s)</p>
        </div>
    </button>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const grid = document.getElementById('categoriesGrid');
        const input = document.getElementById('categorySearchInput');
        const empty = document.getElementById('noCategoryResults');
        if (grid) {
            grid.innerHTML = Array.from({ length: 6 }, () => `
                <article class="glass-card overflow-hidden rounded-2xl">
                    <div class="skeleton aspect-square w-full"></div>
                    <div class="space-y-2 p-2">
                        <div class="skeleton h-3 w-full rounded-full"></div>
                        <div class="skeleton h-3 w-2/3 rounded-full"></div>
                    </div>
                </article>
            `).join('');
        }

        const payload = await loadMenu();
        if (payload) {
            const categories = createCategoryGroups(payload?.plats || []);
            const state = { query: '' };

            const bindCards = () => {
                document.querySelectorAll('[data-open-category]').forEach((node) => {
                    node.addEventListener('click', () => {
                        setButtonLoading(node, true, 'Ouverture');
                        redirectTo('index', { category: node.dataset.openCategory });
                    });
                });
            };

            const render = () => {
                const query = state.query.trim().toLowerCase();
                const filtered = categories.filter((entry) => !query || entry.name.toLowerCase().includes(query));
                grid.innerHTML = filtered.map(renderCategoryCard).join('');
                empty?.classList.toggle('hidden', filtered.length > 0);
                bindCards();
            };

            input?.addEventListener('input', () => {
                state.query = input.value || '';
                render();
            });

            render();
            void loadCart().catch(() => {});
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement des categories', 'error');
    }
}
