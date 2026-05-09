import { 
    bindChrome, 
    createCategoryGroups, 
    escapeHtml, 
    formatPrice, 
    getImageUrl, 
    loadAllPlats, 
    loadCart, 
    redirectTo, 
    redirectToLoadingIfNeeded, 
    renderSkeleton, 
    showToast 
} from './client-core.js';

/**
 * Rendu d'un résultat de recherche (Format liste compacte)
 */
const renderResultItem = (plat) => `
    <button class="liquid-glass mb-3 flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:-translate-y-0.5 active:scale-[0.98]" 
            data-open-detail="${escapeHtml(plat.id)}">
        <img src="${escapeHtml(getImageUrl(plat))}" alt="${escapeHtml(plat.name)}" 
             class="h-16 w-16 shrink-0 rounded-xl object-cover shadow-md">
        <div class="min-w-0 flex-1">
            <p class="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">${escapeHtml(plat.categorie_name || plat.category || 'Plat')}</p>
            <h3 class="truncate text-base font-bold text-white">${escapeHtml(plat.name)}</h3>
            <p class="mt-1 text-sm font-black text-amber-500">${formatPrice(plat.price)}</p>
        </div>
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-amber-500 shadow-inner">
            <i class="fas fa-chevron-right text-xs"></i>
        </div>
    </button>
`;

/**
 * Rendu des chips de catégories pour le filtrage rapide
 */
const renderSearchCategory = (name) => `
    <button class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-amber-500 hover:text-white active:scale-95" 
            data-filter-cat="${escapeHtml(name)}">
        ${escapeHtml(name)}
    </button>
`;

// --- INITIALISATION ---
bindChrome();

if (!redirectToLoadingIfNeeded()) {
    (async () => {
        try {
            const resultsContainer = document.getElementById('resultsContainer');
            const searchInput = document.getElementById('searchInput');
            const categoriesContainer = document.getElementById('searchCategoriesList');
            const noResults = document.getElementById('noResults');

            if (resultsContainer) resultsContainer.innerHTML = renderSkeleton('rows', 5);

            // On charge tous les plats (SaaS : accès à l'inventaire complet)
            const payload = await loadAllPlats();
            const allPlats = payload?.plats || payload || [];
            
            // Extraction des noms de catégories uniques
            const categoryNames = [...new Set(allPlats.map(p => p.categorie_name || p.category))].filter(Boolean);

            const state = { query: '', category: '' };

            const render = () => {
                const q = state.query.toLowerCase().trim();
                const filtered = allPlats.filter(plat => {
                    const matchesQuery = !q || 
                        plat.name.toLowerCase().includes(q) || 
                        (plat.description && plat.description.toLowerCase().includes(q));
                    const matchesCat = !state.category || 
                        (plat.categorie_name || plat.category) === state.category;
                    return matchesQuery && matchesCat;
                });

                resultsContainer.innerHTML = filtered.map(renderResultItem).join('');
                noResults?.classList.toggle('hidden', filtered.length > 0);

                // Bind des clics
                document.querySelectorAll('[data-open-detail]').forEach(node => {
                    node.onclick = () => redirectTo('detail', { id: node.dataset.openDetail });
                });
            };

            // Rendu des catégories
            if (categoriesContainer) {
                categoriesContainer.innerHTML = categoryNames.map(renderSearchCategory).join('');
                document.querySelectorAll('[data-filter-cat]').forEach(node => {
                    node.onclick = () => {
                        // Toggle logic
                        const cat = node.dataset.filterCat;
                        state.category = state.category === cat ? '' : cat;
                        
                        // Update UI des boutons
                        document.querySelectorAll('[data-filter-cat]').forEach(btn => {
                            const active = btn.dataset.filterCat === state.category;
                            btn.classList.toggle('bg-amber-500', active);
                            btn.classList.toggle('text-white', active);
                            btn.classList.toggle('border-amber-500', active);
                        });
                        render();
                    };
                });
            }

            // Écouteur de saisie
            searchInput?.addEventListener('input', (e) => {
                state.query = e.target.value;
                render();
            });

            // Premier rendu
            render();
            
            // Focus automatique pour gagner du temps
            setTimeout(() => searchInput?.focus(), 300);

            // Boutons de navigation
            document.querySelector('[data-back]')?.addEventListener('click', () => window.history.back());
            
            void loadCart().catch(() => {});

        } catch (error) {
            console.error(error);
            showToast('Erreur lors de la recherche', 'error');
        }
    })();
}
