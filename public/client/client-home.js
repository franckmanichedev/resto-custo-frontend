import { 
    bindChrome, 
    createCategoryGroups, 
    escapeHtml, 
    formatDayLabel, 
    formatDuration, 
    formatPrice, 
    getImageUrl, 
    getMenuCache, 
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

/**
 * Rendu d'une pastille (chip) de catégorie
 */
const renderCategory = (group) => `
    <button class="liquid-glass flex shrink-0 items-center gap-1 rounded-full p-1 pr-2 text-left transition hover:-translate-y-0.5 active:scale-95" data-go-category="${escapeHtml(group.name)}">
        <img src="${escapeHtml(group.image)}" alt="${escapeHtml(group.name)}" class="h-10 w-10 rounded-full object-cover border border-white/10">
        <span class="text-sm font-medium text-white px-1">${escapeHtml(group.name)}</span>
    </button>
`;

/**
 * Rendu d'une carte de plat
 */
const renderPlatCard = (plat, payload) => {
    const orderable = isOrderable(plat, payload);
    const actionButton = orderable 
        ? `<button class="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 active:scale-95 shadow-lg shadow-amber-900/20" data-open-detail="${escapeHtml(plat.id)}">Commander</button>` 
        : `<button class="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/50 px-4 py-2 text-sm font-semibold text-black/30 transition hover:bg-white/10" data-open-detail="${escapeHtml(plat.id)}">Consulter</button>`;

    return `
    <article class="glass-card flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1">
        <button class="relative block text-left overflow-hidden group" data-open-detail="${escapeHtml(plat.id)}">
            <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" class="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-110">
            ${plat.is_promo ? '<span class="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black text-white shadow-lg">PROMO</span>' : ''}
            <div class="absolute bottom-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-2 py-1 text-[11px] font-medium text-white border border-white/10">
                <i class="far fa-clock mr-1 text-amber-400"></i>${formatDuration(plat.prep_time)}
            </div>
        </button>
        <div class="flex flex-1 flex-col p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-amber-600/80">${escapeHtml(plat.categorie_name || plat.category || 'Menu')}</p>
                    <h3 class="mt-1 truncate text-base font-bold text-black">${escapeHtml(plat.name)}</h3>
                </div>
                <span class="text-right text-lg font-black text-amber-600">${formatPrice(plat.price)}</span>
            </div>
            <p class="mt-2 text-sm text-black/50 line-clamp-2 leading-relaxed">${escapeHtml(plat.description || 'Aucune description disponible pour ce plat.')}</p>
            <div class="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
                <span class="text-[11px] font-medium ${orderable ? 'text-green-800' : 'text-black/50'}">
                    <i class="fas ${orderable ? 'fa-check-circle' : 'fa-info-circle'} mr-1"></i>
                    ${orderable ? 'Disponible' : 'Indisponible'}
                </span>
                ${actionButton}
            </div>
        </div>
    </article>
    `;
};

/**
 * Fonction maîtresse de rendu de l'interface
 */
const renderMenuPayload = (payload) => {
    const categoriesList = document.getElementById('categoriesList');
    const platsContainer = document.getElementById('platsContainer');
    const infoBanner = document.getElementById('menuInfoBanner');
    const targetCategory = new URLSearchParams(window.location.search).get('category') || '';

    const groups = createCategoryGroups(payload?.plats || []);

    // 1. Rendu des Chips (Navigation horizontale)
    if (categoriesList) {
        categoriesList.innerHTML = groups.map(renderCategory).join('');
    }

    // 2. Gestion de la bannière d'information hors menu du jour
    if (infoBanner) {
        if (payload?.can_order === false) {
            infoBanner.classList.remove('hidden');
            infoBanner.innerHTML = `
                <div class="rounded-2xl bg-amber-500/10 backdrop-blur-md px-4 py-3 text-sm text-amber-200 border border-amber-500/20 shadow-xl">
                    <i class="fas fa-calendar-alt mr-2"></i> Consultation du menu du <strong>${escapeHtml(formatDayLabel(payload.requested_day))}</strong>.
                </div>
            `;
        } else {
            infoBanner.classList.add('hidden');
        }
    }

    // 3. Rendu des Sections par catégorie (Accordéons)
    if (platsContainer) {
        platsContainer.innerHTML = groups.length ? groups.map((group, index) => {
            const isTarget = targetCategory && group.name === targetCategory;
            const isOpen = targetCategory ? isTarget : index === 0;

            return `
            <section class="liquid-glass overflow-hidden rounded-3xl mb-6 shadow-2xl border border-white/5" data-category="${escapeHtml(group.name)}">
                <button class="flex w-full items-center justify-between gap-3 px-5 py-5 text-left transition-colors active:bg-white/5" 
                        data-accordion-toggle="${escapeHtml(group.name)}" aria-expanded="${isOpen}">
                    <div class="min-w-0">
                        <h2 class="truncate border-l-4 border-amber-500 pl-3 text-xl font-black text-white">${escapeHtml(group.name)}</h2>
                        <p class="mt-1 pl-4 text-xs font-medium text-white/40 uppercase tracking-widest">${group.count} plats</p>
                    </div>
                    <div class="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-transform ${isOpen ? 'rotate-180' : ''}" data-accordion-icon="${escapeHtml(group.name)}">
                        <i class="fas fa-chevron-down text-amber-500 text-sm"></i>
                    </div>
                </button>
                <div class="accordion-panel ${isOpen ? 'is-open' : ''}" data-accordion-panel="${escapeHtml(group.name)}">
                    <div class="grid grid-cols-1 gap-5 px-5 pb-6 lg:grid-cols-2 xl:grid-cols-3">
                        ${group.plats.map((plat) => renderPlatCard(plat, payload)).join('')}
                    </div>
                </div>
            </section>
            `;
        }).join('') : '<div class="liquid-glass rounded-2xl px-5 py-12 text-center text-white/60 font-medium">Aucun plat disponible pour cette sélection.</div>';
    }

    // 4. Initialisation des interactions
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
            setButtonLoading(node, true, '');
            redirectTo('index', { category: node.dataset.goCategory });
        });
    });

    document.querySelectorAll('[data-open-detail]').forEach((node) => {
        node.addEventListener('click', () => {
            setButtonLoading(node, true, '');
            redirectTo('detail', { id: node.dataset.openDetail });
        });
    });

    // Scroll vers la catégorie cible si nécessaire
    if (targetCategory) {
        setTimeout(() => {
            document.querySelector(`[data-category="${CSS.escape(targetCategory)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
    }

    void loadCart().catch(() => {});
};

/**
 * Initialisation au démarrage
 */
bindChrome();

// État des filtres
let activeFilters = {
    tags: [],
    maxPrice: 25000,
    prepTimes: [], // example values: 'prep-<10','prep-10-20','prep-20-40','prep->40'
    promoOnly: false,
    modifiableOnly: false,
    sortBy: 'relevance'
};

// View state (global so filters can target current list)
let currentViewAll = false;

// Fonction pour ouvrir la Popup
document.querySelector('[data-open-filter]')?.addEventListener('click', (e) => {
    // Note : On détourne ton bouton "Filtre" pour la popup au lieu des catégories si tu préfères
    openFilterModal();
});

const openFilterModal = () => {
    const modalRoot = document.getElementById('clientModalRoot');
    const template = document.getElementById('filterModalContent').innerHTML;
    modalRoot.innerHTML = template;

    // Récupérer les éléments dans la modale injectée
    const range = modalRoot.querySelector('#priceRange');
    const priceLabel = modalRoot.querySelector('#priceLabel');
    const applyBtn = modalRoot.querySelector('#applyFilters');
    const closeBtn = modalRoot.querySelector('[data-close-filter]');
    const promoCheckbox = modalRoot.querySelector('#filterPromo');
    const modifiableCheckbox = modalRoot.querySelector('#filterModifiable');
    const sortSelect = modalRoot.querySelector('#sortSelect');
    const resetBtn = modalRoot.querySelector('#resetFilters');

    // 1. Gérer le slider de prix
    range.value = activeFilters.maxPrice;
    priceLabel.textContent = formatPrice(activeFilters.maxPrice);
    range.oninput = (e) => {
        activeFilters.maxPrice = e.target.value;
        priceLabel.textContent = formatPrice(e.target.value);
    };

    // 2. Gérer les chips (Multi-sélection) — tags and prepTimes
    modalRoot.querySelectorAll('.filter-chip').forEach(chip => {
        const tag = chip.dataset.filter;
        // Determine if chip is a prep time filter or a tag
        if (tag && tag.startsWith('prep-')) {
            if (activeFilters.prepTimes.includes(tag)) chip.classList.add('is-active');
            chip.onclick = () => {
                chip.classList.toggle('is-active');
                if (activeFilters.prepTimes.includes(tag)) {
                    activeFilters.prepTimes = activeFilters.prepTimes.filter(t => t !== tag);
                } else {
                    activeFilters.prepTimes.push(tag);
                }
            };
        } else {
            if (activeFilters.tags.includes(tag)) chip.classList.add('is-active');
            chip.onclick = () => {
                chip.classList.toggle('is-active');
                if (activeFilters.tags.includes(tag)) {
                    activeFilters.tags = activeFilters.tags.filter(t => t !== tag);
                } else {
                    activeFilters.tags.push(tag);
                }
            };
        }
    });

    // Promo / modifiable / sort init
    promoCheckbox.checked = !!activeFilters.promoOnly;
    modifiableCheckbox.checked = !!activeFilters.modifiableOnly;
    sortSelect.value = activeFilters.sortBy || 'relevance';

    promoCheckbox.onchange = (e) => activeFilters.promoOnly = !!e.target.checked;
    modifiableCheckbox.onchange = (e) => activeFilters.modifiableOnly = !!e.target.checked;
    sortSelect.onchange = (e) => activeFilters.sortBy = e.target.value;

    // 3. Appliquer les filtres
    applyBtn.onclick = async () => {
        await renderFilteredMenu();
        modalRoot.innerHTML = ''; // Fermer
    };

    // Reset
    resetBtn?.addEventListener('click', () => {
        activeFilters = { tags: [], maxPrice: 25000, prepTimes: [], promoOnly: false, modifiableOnly: false, sortBy: 'relevance' };
        // reset UI
        modalRoot.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('is-active'));
        if (range) { range.value = activeFilters.maxPrice; priceLabel.textContent = formatPrice(activeFilters.maxPrice); }
        if (promoCheckbox) promoCheckbox.checked = false;
        if (modifiableCheckbox) modifiableCheckbox.checked = false;
        if (sortSelect) sortSelect.value = 'relevance';
    });

    closeBtn.onclick = () => modalRoot.innerHTML = '';
};

const renderFilteredMenu = async () => {
    console.log("Filtres appliqués :", activeFilters);
    try {
        let payload = null;
        if (currentViewAll) {
            const all = await loadAllPlats();
            payload = all.plats ? all : { plats: all };
        } else {
            payload = await loadMenu();
        }

        if (!payload || !payload.plats) return renderMenuPayload(payload || { plats: [] });

        let plats = Array.isArray(payload.plats) ? payload.plats.slice() : [];

        // Prix
        plats = plats.filter(p => (typeof p.price === 'number' ? p.price : Number(p.price || 0)) <= Number(activeFilters.maxPrice || 9999999));

        // Tags (simple inclusion on tags/categorie)
        if (activeFilters.tags.length) {
            plats = plats.filter(p => {
                const tags = [(p.categorie_name || p.category || ''), ...(p.tags || []), ...(p.labels || [])].map(String).join(' ').toLowerCase();
                return activeFilters.tags.every(t => tags.includes(t.toLowerCase()));
            });
        }

        // Prep times
        if (activeFilters.prepTimes.length) {
            plats = plats.filter(p => {
                const t = Number(p.prep_time || p.prep || 0);
                return activeFilters.prepTimes.some(key => {
                    switch (key) {
                        case 'prep-<10': return t < 10;
                        case 'prep-10-20': return t >= 10 && t <= 20;
                        case 'prep-20-40': return t >= 20 && t <= 40;
                        case 'prep->40': return t > 40;
                        default: return true;
                    }
                });
            });
        }

        // Promotions
        if (activeFilters.promoOnly) {
            plats = plats.filter(p => !!p.is_promo || !!p.promo || !!p.on_sale);
        }

        // Modifiable / personnalisable
        if (activeFilters.modifiableOnly) {
            plats = plats.filter(p => !!p.is_customizable || !!p.customizable || !!p.modifiable || !!p.can_customize);
        }

        // Sorting
        const sortBy = activeFilters.sortBy;
        const getNum = (p, keys) => { for (const k of keys) if (p[k] != null) return Number(p[k]); return 0; };
        if (sortBy && sortBy !== 'relevance') {
            plats.sort((a, b) => {
                switch (sortBy) {
                    case 'price_asc': return (Number(a.price||0) - Number(b.price||0));
                    case 'price_desc': return (Number(b.price||0) - Number(a.price||0));
                    case 'rating': return (getNum(b, ['rating','avg_rating','score']) - getNum(a, ['rating','avg_rating','score']));
                    case 'prep_time': return (Number(a.prep_time||0) - Number(b.prep_time||0));
                    case 'newest': return (getNum(b, ['created_at','createdAt','id']) - getNum(a, ['created_at','createdAt','id']));
                    case 'popularity': return (getNum(b, ['orders_count','popularity','ordered_count']) - getNum(a, ['orders_count','popularity','ordered_count']));
                    default: return 0;
                }
            });
        }

        // Passer un payload cloné aux fonctions existantes
        const filteredPayload = Object.assign({}, payload, { plats });
        renderMenuPayload(filteredPayload);

    } catch (err) {
        console.error('Erreur lors du rendu filtré', err);
        showToast('Erreur lors de l’application des filtres', 'error');
    }
};


if (!redirectToLoadingIfNeeded()) {
    (async () => {
        try {
            const categoriesList = document.getElementById('categoriesList');
            const platsContainer = document.getElementById('platsContainer');
            const viewTodayBtn = document.getElementById('viewTodayBtn');
            const viewAllBtn = document.getElementById('viewAllBtn');
            const searchTrigger = document.getElementById('homeSearchTrigger');

            
            const activeClasses = ['bg-white', 'text-slate-900', 'shadow-sm', 'font-bold'];
            const inactiveClasses = ['text-slate-300', 'font-medium', 'bg-transparent'];

            // Event Recherche
            searchTrigger?.addEventListener('click', () => redirectTo('search'));

            // Toggle UI logic
            const setToggleUI = (showAll) => {
                currentViewAll = !!showAll;
                const activeEl = showAll ? viewAllBtn : viewTodayBtn;
                const inactiveEl = showAll ? viewTodayBtn : viewAllBtn;
                activeEl?.classList.add(...activeClasses);
                activeEl?.classList.remove(...inactiveClasses);
                inactiveEl?.classList.add(...inactiveClasses);
                inactiveEl?.classList.remove(...activeClasses);
            };

            // Switch to Today Menu
            viewTodayBtn?.addEventListener('click', async () => {
                if (!currentViewAll) return;
                setToggleUI(false);
                if (categoriesList) categoriesList.innerHTML = renderSkeleton('chips', 5);
                if (platsContainer) platsContainer.innerHTML = renderSkeleton('cards', 4);
                const payload = await loadMenu();
                if (payload) renderMenuPayload(payload);
            });

            // Switch to All Plats
            viewAllBtn?.addEventListener('click', async () => {
                if (currentViewAll) return;
                setToggleUI(true);
                if (categoriesList) categoriesList.innerHTML = renderSkeleton('chips', 5);
                if (platsContainer) platsContainer.innerHTML = renderSkeleton('cards', 4);
                try {
                    const payload = await loadAllPlats();
                    if (payload) {
                        // Adapt payload structure if necessary
                        const data = payload.plats ? payload : { plats: payload };
                        renderMenuPayload(data);
                    }
                } catch (e) {
                    showToast('Impossible de charger tous les plats', 'error');
                }
            });

            // Lancement initial (Cache then Network)
            const cached = (typeof getMenuCache === 'function') ? getMenuCache() : null;
            if (cached) {
                console.debug('[client-home] Rendering from cache');
                renderMenuPayload(cached);
            }

            const payload = await loadMenu();
            if (payload) {
                console.debug('[client-home] Data fetched from network');
                renderMenuPayload(payload);
            }

        } catch (error) {
            console.error(error);
            showToast('Erreur lors de l’initialisation', 'error');
        }
    })();
}
