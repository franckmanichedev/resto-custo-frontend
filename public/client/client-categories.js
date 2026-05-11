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

/**
 * Rendu d'une carte catégorie (Grid item)
 */
const renderCategoryCard = (entry) => `
    <button class="liquid-glass group min-w-0 overflow-hidden rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95" 
            data-open-category="${escapeHtml(entry.name)}">
        <div class="relative aspect-square w-full overflow-hidden">
            <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.name)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
        </div>
        <div class="p-3 bg-white/5 backdrop-blur-sm border-t border-white/5">
            <h3 class="truncate text-xs font-black uppercase tracking-tight text-white group-hover:text-amber-500 transition-colors">${escapeHtml(entry.name)}</h3>
            <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-500/80">${entry.count} plat(s)</p>
        </div>
    </button>
`;

/**
 * Initialisation
 */
bindChrome();

if (!redirectToLoadingIfNeeded()) {
    (async () => {
        try {
            const grid = document.getElementById('categoriesGrid');
            const input = document.getElementById('categorySearchInput');
            const empty = document.getElementById('noCategoryResults');

            // 1. État de chargement (Skeleton)
            if (grid) {
                grid.innerHTML = Array.from({ length: 6 }, () => `
                    <article class="glass-card overflow-hidden rounded-2xl border border-white/5 shadow-sm">
                        <div class="skeleton aspect-square w-full opacity-20"></div>
                        <div class="space-y-2 p-3">
                            <div class="skeleton h-3 w-full rounded-full opacity-20"></div>
                            <div class="skeleton h-2 w-1/2 rounded-full opacity-10"></div>
                        </div>
                    </article>
                `).join('');
            }

            // 2. Chargement des données (SaaS : Source unique Menu)
            const payload = await loadMenu();
            
            if (payload) {
                const categories = createCategoryGroups(payload?.plats || []);
                const state = { query: '' };

                // Gestion des clics et redirections
                const bindCards = () => {
                    document.querySelectorAll('[data-open-category]').forEach((node) => {
                        node.onclick = (e) => {
                            e.preventDefault();
                            setButtonLoading(node, true, '');
                            // Redirige vers l'accueil avec le paramètre de catégorie pour ouvrir l'accordéon
                            redirectTo('index', { category: node.dataset.openCategory });
                        };
                    });
                };

                // Fonction de rendu dynamique (Filtrage)
                const render = () => {
                    const query = state.query.trim().toLowerCase();
                    const filtered = categories.filter((entry) => 
                        !query || entry.name.toLowerCase().includes(query)
                    );

                    grid.innerHTML = filtered.map(renderCategoryCard).join('');
                    
                    if (empty) {
                        empty.classList.toggle('hidden', filtered.length > 0);
                    }
                    
                    bindCards();
                };

                // Écouteur de recherche
                input?.addEventListener('input', () => {
                    state.query = input.value || '';
                    render();
                });

                // Premier rendu réel
                render();
                
                // Refresh silencieux du panier
                void loadCart().catch(() => {});
            }
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erreur de chargement des catégories', 'error');
        }
    })();
}
