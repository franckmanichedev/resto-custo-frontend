import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    filterByCategory,
    formatDayLabel,
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

const renderCard = (plat, payload) => `
    <article class="overflow-hidden rounded-[1.6rem] bg-white shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-lg">
        <div class="block w-full text-left" data-open-detail="${escapeHtml(plat.id)}">
            <div class="relative">
                <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-44 w-full object-cover">
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/60 to-transparent px-4 pb-4 pt-10">
                    <div class="flex items-end justify-between gap-3 text-white">
                        <span class="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold backdrop-blur">${formatDuration(plat.prep_time)}</span>
                        ${plat.is_promo ? '<span class="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase">Promo</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
        <div class="space-y-3 p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</p>
                    <h3 class="mt-1 text-lg font-bold text-slate-900">${escapeHtml(plat.name)}</h3>
                </div>
                <p class="text-right text-base font-black text-amber-700">${formatPrice(plat.price)}</p>
            </div>
            <p class="text-sm leading-6 text-slate-600">${escapeHtml(plat.description || 'Aucune description pour le moment.')}</p>
            <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-slate-500">${isOrderable(plat, payload) ? 'Disponible maintenant' : 'Consultation uniquement'}</span>
                <button class="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600" data-open-detail="${escapeHtml(plat.id)}">
                    Voir le detail
                </button>
            </div>
        </div>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadMenu();
        const groups = createCategoryGroups(payload?.plats || []);
        const category = new URLSearchParams(window.location.search).get('category') || '';
        const filteredPlats = filterByCategory(payload?.plats || [], category);
        const filteredGroups = createCategoryGroups(filteredPlats);
        const categoriesList = document.getElementById('categoriesList');
        const platsContainer = document.getElementById('platsContainer');
        const infoBanner = document.getElementById('menuInfoBanner');

        document.getElementById('homeSearchTrigger')?.addEventListener('click', () => redirectTo('search'));

        categoriesList.innerHTML = groups.map((group) => `
            <button class="min-w-[150px] rounded-[1.6rem] bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-lg" data-go-category="${escapeHtml(group.name)}">
                <img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.name)}" class="h-16 w-full rounded-2xl object-cover">
                <p class="mt-3 text-sm font-bold text-slate-900">${escapeHtml(group.name)}</p>
                <p class="mt-1 text-xs text-slate-500">${group.count} plat(s)</p>
            </button>
        `).join('');

        if (payload?.can_order === false) {
            infoBanner.classList.remove('hidden');
            infoBanner.innerHTML = `
                <div class="rounded-[1.4rem] bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    Consultation du menu du <strong>${escapeHtml(formatDayLabel(payload.requested_day))}</strong>. Les commandes restent actives pour le menu du jour.
                </div>
            `;
        }

        platsContainer.innerHTML = filteredGroups.length
            ? filteredGroups.map((group) => `
                <section class="space-y-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Categorie</p>
                            <h2 class="text-2xl font-black text-slate-950">${escapeHtml(group.name)}</h2>
                        </div>
                        <button class="text-sm font-semibold text-amber-600" data-go-category="${escapeHtml(group.name)}">Explorer</button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                        ${group.plats.map((plat) => renderCard(plat, payload)).join('')}
                    </div>
                </section>
            `).join('')
            : '<div class="soft-card rounded-[1.75rem] px-5 py-8 text-center text-slate-600">Aucun plat dans cette categorie.</div>';

        document.querySelectorAll('[data-go-category]').forEach((node) => node.addEventListener('click', () => redirectTo('categories', { category: node.dataset.goCategory })));
        document.querySelectorAll('[data-open-detail]').forEach((node) => node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail })));
        void loadCart().catch(() => {});
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du menu', 'error');
    }
}
