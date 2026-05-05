import {
    bindChrome,
    createCategoryGroups,
    escapeHtml,
    formatDayLabel,
    formatDuration,
    formatPrice,
    getImageUrl,
    getMenuCache,
    getPlatsAllCache,
    isOrderable,
    loadCart,
    loadMenu,
    loadAllPlats,
    redirectTo,
    redirectToLoadingIfNeeded,
    renderSkeleton,
    setButtonLoading,
    showToast
} from './client-core.js';

const renderCategory = (group) => `
    <button class="liquid-glass flex shrink-0 items-center gap-3 rounded-full p-2 pr-5 text-left transition hover:-translate-y-0.5" data-go-category="${escapeHtml(group.name)}">
        <img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.name)}" class="h-12 w-12 rounded-full object-cover">
        <span class="text-sm font-medium text-white">${escapeHtml(group.name)}</span>
    </button>
`;

const renderPlatCard = (plat, payload) => {
    const orderable = isOrderable(plat, payload);
    const actionButton = orderable
        ? `<button class="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600" data-open-detail="${escapeHtml(plat.id)}">Je veux ca</button>`
        : `<button class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600" data-open-detail="${escapeHtml(plat.id)}">Consulter</button>`;

    return `
    <article class="glass-card flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-1">
        <button class="relative block text-left" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-44 w-full object-cover">
            ${plat.is_promo ? '<span class="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">PROMO</span>' : ''}
            <div class="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-1 text-xs text-white">
                <i class="far fa-clock mr-1"></i>${formatDuration(plat.prep_time)}
            </div>
        </button>
        <div class="flex flex-1 flex-col p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-wide text-amber-600">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</p>
                    <h3 class="mt-1 truncate text-base font-bold text-gray-800">${escapeHtml(plat.name)}</h3>
                </div>
                <span class="text-right text-lg font-bold text-amber-700">${formatPrice(plat.price)}</span>
            </div>
            <p class="mt-2 text-sm text-gray-500 line-clamp-2">${escapeHtml(plat.description || 'Sans description')}</p>
            <div class="mt-4 flex items-center justify-between gap-3">
                <span class="text-xs text-gray-500">${orderable ? 'Disponible maintenant' : 'Consultation uniquement'}</span>
                ${actionButton}
            </div>
        </div>
    </article>
    `;
};

bindChrome();

if (!redirectToLoadingIfNeeded()) {
    try {
        const categoriesList = document.getElementById('categoriesList');
        const platsContainer = document.getElementById('platsContainer');
        const viewTodayBtn = document.getElementById('viewTodayBtn');
        const viewAllBtn = document.getElementById('viewAllBtn');
        let currentViewAll = false;

        const activeClasses = ['bg-white', 'text-slate-900', 'shadow-sm', 'font-semibold', 'hover:bg-white/90'];
        const inactiveClasses = ['text-slate-300', 'font-medium', 'bg-transparent', 'shadow-none', 'hover:bg-white/10'];

        const setToggleUI = (showAll) => {
            currentViewAll = !!showAll;
            
            // On définit qui est actif et qui est inactif
            const activeEl = showAll ? viewAllBtn : viewTodayBtn;
            const inactiveEl = showAll ? viewTodayBtn : viewAllBtn;

            // On applique les classes de façon propre
            activeEl.classList.add(...activeClasses);
            activeEl.classList.remove(...inactiveClasses);

            inactiveEl.classList.add(...inactiveClasses);
            inactiveEl.classList.remove(...activeClasses);
        };

        viewTodayBtn?.addEventListener('click', () => {
            if (!currentViewAll) return;
            setToggleUI(false);
            // reload today's menu
            void (async () => {
                if (categoriesList) categoriesList.innerHTML = renderSkeleton('chips', 5);
                if (platsContainer) platsContainer.innerHTML = renderSkeleton('cards', 4);
                const payload = await loadMenu();
                if (payload) renderMenuPayload(payload);
            })();
        });

        viewAllBtn?.addEventListener('click', () => {
            if (currentViewAll) return;
            setToggleUI(true);
            void (async () => {
                if (categoriesList) categoriesList.innerHTML = renderSkeleton('chips', 5);
                if (platsContainer) platsContainer.innerHTML = renderSkeleton('cards', 4);
                try {
                    const payload = await loadAllPlats();
                    if (payload) {
                        // payload expected to be { plats: [...], ... }
                        const groups = createCategoryGroups(payload?.plats || payload || []);
                        categoriesList.innerHTML = groups.map(renderCategory).join('');
                        platsContainer.innerHTML = groups.length
                            ? groups.map((group) => `
                                <section class="liquid-glass overflow-hidden rounded-2xl" data-category="${escapeHtml(group.name)}">
                                    <div class="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
                                        ${group.plats.map((plat) => renderPlatCard(plat, payload)).join('')}
                                    </div>
                                </section>
                            `).join('')
                            : '<div class="liquid-glass rounded-2xl px-5 py-8 text-center text-white">Aucun plat disponible pour le moment.</div>';

                        document.querySelectorAll('[data-open-detail]').forEach((node) => node.addEventListener('click', () => redirectTo('detail', { id: node.dataset.openDetail })));
                    }
                } catch (e) {
                    showToast(e.message || 'Impossible de charger tous les plats', 'error');
                }
            })();
        });

        const renderMenuPayload = (payload) => {
            const groups = createCategoryGroups(payload?.plats || []);
            const targetCategory = new URLSearchParams(window.location.search).get('category') || '';
            const infoBanner = document.getElementById('menuInfoBanner');

            document.getElementById('homeSearchTrigger')?.addEventListener('click', () => redirectTo('search'));
            if (categoriesList) categoriesList.innerHTML = groups.map(renderCategory).join('');
            if (payload?.can_order === false && infoBanner) {
                infoBanner.classList.remove('hidden');
                infoBanner.innerHTML = `
                    <div class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                        Consultation du menu du <strong>${escapeHtml(formatDayLabel(payload.requested_day))}</strong>. Les commandes restent actives pour le menu du jour.
                    </div>
                `;
            }

            if (platsContainer) platsContainer.innerHTML = groups.length
                ? groups.map((group, index) => {
                    const isTarget = targetCategory && group.name === targetCategory;
                    const isOpen = targetCategory ? isTarget : index === 0;
                    return `
                    <section class="liquid-glass overflow-hidden rounded-2xl" data-category="${escapeHtml(group.name)}">
                        <button class="flex w-full items-center justify-between gap-3 px-4 py-4 text-left" data-accordion-toggle="${escapeHtml(group.name)}" aria-expanded="${isOpen ? 'true' : 'false'}">
                            <div class="min-w-0">
                                <h2 class="truncate border-l-4 border-amber-500 pl-2 text-lg font-bold text-amber-500">${escapeHtml(group.name)}</h2>
                                <p class="mt-1 text-xs text-gray-300">${group.count} plat(s)</p>
                            </div>
                            <i class="fas fa-chevron-down text-sm text-amber-700 transition-transform ${isOpen ? 'rotate-180' : ''}" data-accordion-icon="${escapeHtml(group.name)}"></i>
                        </button>
                        <div class="accordion-panel ${isOpen ? 'is-open' : ''}" data-accordion-panel="${escapeHtml(group.name)}">
                            <div>
                                <div class="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
                                    ${group.plats.map((plat) => renderPlatCard(plat, payload)).join('')}
                                </div>
                            </div>
                        </div>
                    </section>
                `; }).join('')
                : '<div class="liquid-glass rounded-2xl px-5 py-8 text-center text-white">Aucun plat disponible pour le moment.</div>';

            if (targetCategory) {
                document.querySelector(`[data-category="${CSS.escape(targetCategory)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            document.querySelectorAll('[data-accordion-toggle]').forEach((node) => {
                node.addEventListener('click', () => {
                    const key = node.dataset.accordionToggle;
                    const panel = document.querySelector(`[data-accordion-panel="${CSS.escape(key)}"]`);
                    const icon = document.querySelector(`[data-accordion-icon="${CSS.escape(key)}"]`);
                    const open = !panel?.classList.contains('is-open');
                    panel?.classList.toggle('is-open', open);
                    icon?.classList.toggle('rotate-180', open);
                    node.setAttribute('aria-expanded', String(open));
                });
            });

            document.querySelectorAll('[data-go-category]').forEach((node) => {
                node.addEventListener('click', () => {
                    setButtonLoading(node, true, 'Ouverture');
                    redirectTo('index', { category: node.dataset.goCategory });
                });
            });
            document.querySelectorAll('[data-open-detail]').forEach((node) => {
                node.addEventListener('click', () => {
                    setButtonLoading(node, true, 'Ouverture');
                    redirectTo('detail', { id: node.dataset.openDetail });
                });
            });

            void loadCart().catch(() => {});
        };

            let skipNetwork = false;
            const cached = (typeof getMenuCache === 'function') ? getMenuCache() : null;
        if (cached) {
            // render immediately from cache
            const payload = cached;
            const groups = createCategoryGroups(payload?.plats || []);
            const targetCategory = new URLSearchParams(window.location.search).get('category') || '';
            const infoBanner = document.getElementById('menuInfoBanner');

            document.getElementById('homeSearchTrigger')?.addEventListener('click', () => redirectTo('search'));
            if (categoriesList) categoriesList.innerHTML = groups.map(renderCategory).join('');
            if (payload?.can_order === false && infoBanner) {
                infoBanner.classList.remove('hidden');
                infoBanner.innerHTML = `
                    <div class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                        Consultation du menu du <strong>${escapeHtml(formatDayLabel(payload.requested_day))}</strong>. Les commandes restent actives pour le menu du jour.
                    </div>
                `;
            }

            if (platsContainer) platsContainer.innerHTML = groups.length
                ? groups.map((group, index) => {
                    const isTarget = targetCategory && group.name === targetCategory;
                    const isOpen = targetCategory ? isTarget : index === 0;
                    return `
                    <section class="liquid-glass overflow-hidden rounded-2xl" data-category="${escapeHtml(group.name)}">
                        <button class="flex w-full items-center justify-between gap-3 px-4 py-4 text-left" data-accordion-toggle="${escapeHtml(group.name)}" aria-expanded="${isOpen ? 'true' : 'false'}">
                            <div class="min-w-0">
                                <h2 class="truncate border-l-4 border-amber-500 pl-2 text-lg font-bold text-amber-500">${escapeHtml(group.name)}</h2>
                                <p class="mt-1 text-xs text-gray-300">${group.count} plat(s)</p>
                            </div>
                            <i class="fas fa-chevron-down text-sm text-amber-700 transition-transform ${isOpen ? 'rotate-180' : ''}" data-accordion-icon="${escapeHtml(group.name)}"></i>
                        </button>
                        <div class="accordion-panel ${isOpen ? 'is-open' : ''}" data-accordion-panel="${escapeHtml(group.name)}">
                            <div>
                                <div class="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
                                    ${group.plats.map((plat) => renderPlatCard(plat, payload)).join('')}
                                </div>
                            </div>
                        </div>
                    </section>
                `; }).join('')
                : '<div class="liquid-glass rounded-2xl px-5 py-8 text-center text-white">Aucun plat disponible pour le moment.</div>';

            document.querySelectorAll('[data-accordion-toggle]').forEach((node) => {
                node.addEventListener('click', () => {
                    const key = node.dataset.accordionToggle;
                    const panel = document.querySelector(`[data-accordion-panel="${CSS.escape(key)}"]`);
                    const icon = document.querySelector(`[data-accordion-icon="${CSS.escape(key)}"]`);
                    const open = !panel?.classList.contains('is-open');
                    panel?.classList.toggle('is-open', open);
                    icon?.classList.toggle('rotate-180', open);
                    node.setAttribute('aria-expanded', String(open));
                });
            });

            document.querySelectorAll('[data-go-category]').forEach((node) => {
                node.addEventListener('click', () => {
                    setButtonLoading(node, true, 'Ouverture');
                    redirectTo('index', { category: node.dataset.goCategory });
                });
            });
            document.querySelectorAll('[data-open-detail]').forEach((node) => {
                node.addEventListener('click', () => {
                    setButtonLoading(node, true, 'Ouverture');
                    redirectTo('detail', { id: node.dataset.openDetail });
                });
            });

            void loadCart().catch(() => {});
            skipNetwork = true;
            console.debug('[client-home] rendered from cache, skipping network load');
        }

        if (!skipNetwork) {
        }

        console.debug('[client-home] no cache: showing skeletons and fetching');
        if (categoriesList) categoriesList.innerHTML = renderSkeleton('chips', 5);
        if (platsContainer) platsContainer.innerHTML = renderSkeleton('cards', 4);

        const payload = await loadMenu();
        console.debug('[client-home] loadMenu resolved, payload present:', !!payload);
        if (payload) {
            renderMenuPayload(payload);
        }
        // end if (!skipNetwork)
    } catch (error) {
        showToast(error.message || 'Erreur de chargement du menu', 'error');
    }
}
