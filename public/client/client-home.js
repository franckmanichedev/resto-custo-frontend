import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
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

const renderCategory = (group) => `
    <button class="flex shrink-0 items-center gap-3 rounded-full border border-gray-100 bg-white p-2 pr-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" data-go-category="${escapeHtml(group.name)}">
        <img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.name)}" class="h-12 w-12 rounded-full object-cover">
        <span class="text-sm font-medium text-gray-700">${escapeHtml(group.name)}</span>
    </button>
`;

const renderPlatCard = (plat, payload) => `
    <article class="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl">
        <button class="relative block text-left" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-44 w-full object-cover">
            ${plat.is_promo ? '<span class="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">PROMO</span>' : ''}
            <div class="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-1 text-xs text-white">
                <i class="far fa-clock mr-1"></i>${formatDuration(plat.prep_time)}
            </div>
        </button>
        <div class="flex flex-1 flex-col p-4 bg-white/20 backdrop-blur-md">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-wide text-amber-600">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</p>
                    <h3 class="mt-1 truncate text-base font-bold text-gray-800">${escapeHtml(plat.name)}</h3>
                </div>
                <span class="text-right text-lg font-bold text-amber-700">${formatPrice(plat.price)}</span>
            </div>
            <p class="mt-2 text-sm text-gray-500 line-clamp-2">${escapeHtml(plat.description || 'Sans description')}</p>
            <div class="mt-4 flex items-center justify-between gap-3">
                <span class="text-xs text-gray-500">${isOrderable(plat, payload) ? 'Disponible maintenant' : 'Consultation uniquement'}</span>
                <button class="rounded-full bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600" data-open-detail="${escapeHtml(plat.id)}">
                    Je veux ca
                </button>
            </div>
        </div>
    </article>
`;

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const payload = await loadMenu();
        if (payload) {
            const groups = createCategoryGroups(payload?.plats || []);
            const categoriesList = document.getElementById('categoriesList');
            const platsContainer = document.getElementById('platsContainer');
            const infoBanner = document.getElementById('menuInfoBanner');

            document.getElementById('homeSearchTrigger')?.addEventListener('click', () => redirectTo('search'));

            categoriesList.innerHTML = groups.map(renderCategory).join('');

            if (payload?.can_order === false) {
                infoBanner.classList.remove('hidden');
                infoBanner.innerHTML = `
                    <div class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                        Consultation du menu du <strong>${escapeHtml(formatDayLabel(payload.requested_day))}</strong>. Les commandes restent actives pour le menu du jour.
                    </div>
                `;
            }

            platsContainer.innerHTML = groups.length
                ? groups.map((group) => `
                    <section class="space-y-4" data-category="${escapeHtml(group.name)}">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h2 class="border-l-4 border-amber-500 pl-2 text-lg font-bold text-gray-800">${escapeHtml(group.name)}</h2>
                                <p class="mt-1 text-xs text-gray-500">${group.count} plat(s)</p>
                            </div>
                            <button class="text-sm font-semibold text-amber-600" data-go-category="${escapeHtml(group.name)}">Explorer</button>
                        </div>
                        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            ${group.plats.map((plat) => renderPlatCard(plat, payload)).join('')}
                        </div>
                    </section>
                `).join('')
                : '<div class="rounded-2xl bg-white px-5 py-8 text-center text-gray-600 shadow-sm">Aucun plat disponible pour le moment.</div>';

            document.querySelectorAll('[data-go-category]').forEach((node) => {
                node.addEventListener('click', () => redirectTo('categories', { category: node.dataset.goCategory }));
            });
            document.querySelectorAll('[data-open-detail]').forEach((node) => {
                node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail }));
            });

            void loadCart().catch(() => {});
        }
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du menu', 'error');
    }
}
