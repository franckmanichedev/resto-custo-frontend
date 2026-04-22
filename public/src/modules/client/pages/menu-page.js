/**
 * Menu client - Affichage et gestion du menu
 */

import { formatPrice, getWeekDayLabel } from '../../../shared/api/apiClient.js';
import { showToast, debounce, escapeHtml } from '../../../shared/utils/index.js';
import { store } from '../store/clientStore.js';
import { sessionManager } from '../services/sessionService.js';
import { openPlatModal } from '../components/platModal.js';

let currentPlats = [];
let activeFilters = {
    kind: 'all',
    categoryId: 'all',
    selectedDay: null,
    sortBy: 'category:asc',
    search: ''
};

const KIND_ORDER = { plat: 0, boisson: 1 };

const getNormalizedKind = (item) =>
    item.kind || (String(item.category || '').toLowerCase() === 'boisson' ? 'boisson' : 'plat');

const getLegacyCategoryLabel = (category) => {
    const labels = {
        entree: 'Entree',
        plat: 'Plat',
        boisson: 'Boisson'
    };

    return labels[String(category || '').toLowerCase()] || String(category || 'Plat');
};

const getDisplayCategoryName = (item) =>
    item.categorie_name
    || item.category_details?.name
    || getLegacyCategoryLabel(item.category || item.kind);

const getDisplayTypeCategoryName = (item) =>
    item.type_categorie_name
    || item.type_category_details?.name
    || '';

const getItemCategoryId = (item) =>
    item.categorie_id
    || item.category_details?.id
    || '';

function getAvailableCategories(plats = []) {
    const categories = {};

    plats.forEach((item) => {
        const id = getItemCategoryId(item);
        const name = getDisplayCategoryName(item);
        if (!name) return;

        const key = id || `legacy:${name.toLowerCase()}`;
        if (!categories[key]) {
            categories[key] = {
                id: key,
                label: name,
                kind: getNormalizedKind(item),
                count: 0
            };
        }

        categories[key].count += 1;
    });

    return Object.values(categories).sort((left, right) =>
        left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' })
    );
}

export async function initMenu() {
    const plats = store.get('plats');
    const selectedDay = store.get('selectedDay');
    const currentDay = store.get('currentDay');
    const consultableDays = store.get('consultableDays');

    currentPlats = plats || [];

    loadFiltersFromStorage();

    renderDayTabs(consultableDays, selectedDay, currentDay);
    renderCategoryFilters(store.get('rawPlats') || currentPlats);
    renderMenu(currentPlats, selectedDay, currentDay);
    setupFilters();
    setupFilterModal();
    setupMenuEvents();
    updateActiveFiltersCount();
}

function renderDayTabs(days, selectedDay, currentDay) {
    const container = document.getElementById('day-tabs');
    if (!container) return;

    if (!days || !days.length) {
        container.innerHTML = '<span class="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">Aucun jour disponible</span>';
        return;
    }

    container.innerHTML = days.map((day) => `
        <button type="button" data-day="${day}" class="day-tab rounded-2xl px-4 py-2 text-sm font-bold transition-all ${day === selectedDay ? 'bg-yellow-500 text-white shadow-md' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}">
            ${escapeHtml(getWeekDayLabel(day))}
            ${day === currentDay ? '<span class="ml-1 text-xs">(aujourd\'hui)</span>' : ''}
        </button>
    `).join('');

    document.querySelectorAll('.day-tab').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const day = btn.dataset.day;
            if (day === store.get('selectedDay')) return;

            try {
                await sessionManager.loadMenuForDay(day);
                initMenu();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    });
}

function renderMenu(plats, selectedDay, currentDay) {
    const container = document.getElementById('menu-list');
    if (!container) return;

    const filteredPlats = applyFiltersToPlats(plats, selectedDay);

    if (!filteredPlats.length) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Aucun article ne correspond a vos criteres</p>
                <button id="clear-filters-btn" class="mt-4 text-primary font-medium">Reinitialiser les filtres</button>
            </div>
        `;

        const clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                resetAllFilters();
                applyFiltersAndRender();
            });
        }
        return;
    }

    const grouped = filteredPlats.reduce((accumulator, item) => {
        const kind = getNormalizedKind(item);
        const categoryName = getDisplayCategoryName(item);
        const key = `${kind}::${categoryName}`;

        if (!accumulator[key]) {
            accumulator[key] = {
                kind,
                categoryName,
                items: []
            };
        }

        accumulator[key].items.push(item);
        return accumulator;
    }, {});

    const orderedGroups = Object.values(grouped).sort((left, right) => {
        const kindComparison = (KIND_ORDER[left.kind] ?? 99) - (KIND_ORDER[right.kind] ?? 99);
        if (kindComparison !== 0) return kindComparison;
        return (left.categoryName || '').localeCompare(right.categoryName || '', 'fr', { sensitivity: 'base' });
    });

    let html = '';

    orderedGroups.forEach((group) => {
        html += `
            <section class="col-span-full mb-8">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-2xl font-serif font-semibold text-gray-800">${escapeHtml(group.categoryName)}</h2>
                        <p class="text-sm text-gray-500">${group.kind === 'boisson' ? 'Boissons' : 'Plats'}</p>
                    </div>
                    <span class="text-sm text-gray-500">${group.items.length} article(s)</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${group.items.map((plat) => renderPlatCard(plat, selectedDay, currentDay)).join('')}
                </div>
            </section>
        `;
    });

    container.innerHTML = html;

    document.querySelectorAll('.open-plat-detail').forEach((btn) => {
        btn.addEventListener('click', () => {
            const platId = btn.dataset.id;
            const plat = filteredPlats.find((p) => p.id === platId);
            if (plat) openPlatModal(plat);
        });
    });
}

function renderCategoryFilters(plats) {
    const container = document.getElementById('filter-category-buttons');
    if (!container) return;

    const availableCategories = getAvailableCategories(plats).filter((category) =>
        activeFilters.kind === 'all' ? true : category.kind === activeFilters.kind
    );

    if (activeFilters.categoryId !== 'all' && !availableCategories.some((category) => category.id === activeFilters.categoryId)) {
        activeFilters.categoryId = 'all';
    }

    container.innerHTML = `
        <button data-category-id="all" class="filter-menu-category-btn py-2 px-3 rounded-xl text-sm font-medium transition-all ${activeFilters.categoryId === 'all' ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
            Toutes
        </button>
        ${availableCategories.map((category) => `
            <button data-category-id="${escapeHtml(category.id)}" class="filter-menu-category-btn py-2 px-3 rounded-xl text-sm font-medium transition-all ${activeFilters.categoryId === category.id ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                ${escapeHtml(category.label)}
                <span class="ml-1 text-xs opacity-70">${category.count}</span>
            </button>
        `).join('')}
    `;

    document.querySelectorAll('.filter-menu-category-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-menu-category-btn').forEach((entry) => {
                entry.classList.remove('bg-yellow-400', 'text-white');
                entry.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-400', 'text-white');
        });
    });
}

function applyFiltersToPlats(plats) {
    let filtered = [...plats];

    if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        filtered = filtered.filter((item) =>
            item.name?.toLowerCase().includes(searchLower)
            || item.description?.toLowerCase().includes(searchLower)
            || item.compositions?.some((composition) => composition.name?.toLowerCase().includes(searchLower))
            || getDisplayCategoryName(item).toLowerCase().includes(searchLower)
            || getDisplayTypeCategoryName(item).toLowerCase().includes(searchLower)
        );
    }

    if (activeFilters.kind !== 'all') {
        filtered = filtered.filter((item) => getNormalizedKind(item) === activeFilters.kind);
    }

    if (activeFilters.categoryId !== 'all') {
        filtered = filtered.filter((item) => {
            const categoryId = getItemCategoryId(item);
            const legacyKey = `legacy:${getDisplayCategoryName(item).toLowerCase()}`;
            return categoryId === activeFilters.categoryId || legacyKey === activeFilters.categoryId;
        });
    }

    if (activeFilters.selectedDay) {
        filtered = filtered.filter((item) => {
            if (item.availability_mode === 'everyday') return true;
            return Array.isArray(item.available_days) && item.available_days.includes(activeFilters.selectedDay);
        });
    }

    const [sortBy, sortOrder] = activeFilters.sortBy.split(':');
    filtered.sort((left, right) => {
        let comparison = 0;

        if (sortBy === 'name') {
            comparison = (left.name || '').localeCompare(right.name || '', 'fr', { sensitivity: 'base' });
        } else if (sortBy === 'price') {
            comparison = (left.price || 0) - (right.price || 0);
        } else {
            const leftCategory = getDisplayCategoryName(left);
            const rightCategory = getDisplayCategoryName(right);
            comparison = leftCategory.localeCompare(rightCategory, 'fr', { sensitivity: 'base' });
        }

        return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
}

function renderPlatCard(plat, selectedDay, currentDay) {
    const isOrderable = selectedDay === currentDay && plat.is_orderable_today;
    const statusBadge = isOrderable
        ? '<span class="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">Commandable</span>'
        : '<span class="absolute top-3 right-3 bg-gray-400 text-white text-xs px-2 py-1 rounded-full">Consultation</span>';
    const typeCategoryName = getDisplayTypeCategoryName(plat);

    return `
        <article class="plat-card bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-gray-100 relative">
            ${plat.is_promo ? '<div class="absolute top-3 left-3 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Promo</div>' : ''}
            ${statusBadge}
            <div class="aspect-video bg-gradient-to-br from-gray-100 to-gray-200">
                ${plat.image_url
                    ? `<img src="${escapeHtml(plat.image_url)}" alt="${escapeHtml(plat.name)}" class="w-full h-full object-cover">`
                    : '<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-utensils text-4xl"></i></div>'}
            </div>
            <div class="p-4">
                <div class="flex justify-between items-start mb-2 gap-3">
                    <div>
                        <h3 class="font-semibold text-lg">${escapeHtml(plat.name)}</h3>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">${escapeHtml(getNormalizedKind(plat) === 'boisson' ? 'Boisson' : 'Plat')}</span>
                            <span class="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">${escapeHtml(getDisplayCategoryName(plat))}</span>
                            ${typeCategoryName ? `<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">${escapeHtml(typeCategoryName)}</span>` : ''}
                        </div>
                    </div>
                    <span class="font-bold text-primary">${formatPrice(plat.price)}</span>
                </div>
                <p class="text-gray-500 text-sm line-clamp-2">${escapeHtml(plat.description || 'Aucune description')}</p>
                <div class="flex items-center justify-between mt-4">
                    <div class="flex items-center gap-1 text-sm text-gray-400">
                        <i class="far fa-clock"></i>
                        <span>${plat.prep_time || 0} min</span>
                    </div>
                    <button class="open-plat-detail bg-yellow-100 hover:bg-yellow-500 text-primary hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all" data-id="${escapeHtml(plat.id)}">
                        <i class="fas fa-plus mr-1"></i> Voir
                    </button>
                </div>
            </div>
        </article>
    `;
}

function setupFilters() {
    const searchInput = document.getElementById('menu-search');

    if (searchInput) {
        searchInput.value = activeFilters.search;
        searchInput.addEventListener('input', debounce((event) => {
            activeFilters.search = event.target.value;
            saveFiltersToStorage();
            applyFiltersAndRender();
            updateActiveFiltersCount();
        }, 300));
    }
}

function setupFilterModal() {
    const modal = document.getElementById('filter-modal');
    const openBtn = document.getElementById('open-filter-modal');
    const closeBtn = document.getElementById('close-filter-modal');
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');

    if (!modal) return;

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            renderCategoryFilters(store.get('rawPlats') || currentPlats);
            syncModalWithFilters();
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const selectedKind = document.querySelector('.filter-kind-btn.active')?.dataset.kind || 'all';
            const selectedCategoryId = document.querySelector('.filter-menu-category-btn.bg-yellow-400')?.dataset.categoryId || 'all';
            const selectedDayBtn = document.querySelector('.filter-day-btn.active');
            const selectedDay = selectedDayBtn ? selectedDayBtn.dataset.day : null;
            const selectedSort = document.querySelector('.filter-sort-btn.active')?.dataset.sort || 'category:asc';

            activeFilters.kind = selectedKind;
            activeFilters.categoryId = selectedCategoryId;
            activeFilters.selectedDay = selectedDay;
            activeFilters.sortBy = selectedSort;

            saveFiltersToStorage();
            renderCategoryFilters(store.get('rawPlats') || []);
            applyFiltersAndRender();
            updateActiveFiltersCount();
            closeModal();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetAllFilters();
            renderCategoryFilters(store.get('rawPlats') || []);
            syncModalWithFilters();
            applyFiltersAndRender();
            updateActiveFiltersCount();
        });
    }

    document.querySelectorAll('.filter-kind-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-kind-btn').forEach((entry) => {
                entry.classList.remove('bg-yellow-500', 'text-white', 'active', 'bg-yellow-400');
                entry.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');

            const nextKind = btn.dataset.kind || 'all';
            const rawPlats = store.get('rawPlats') || [];
            const availableCategoryIds = new Set(
                getAvailableCategories(rawPlats)
                    .filter((category) => nextKind === 'all' ? true : category.kind === nextKind)
                    .map((category) => category.id)
            );

            if (activeFilters.categoryId !== 'all' && !availableCategoryIds.has(activeFilters.categoryId)) {
                activeFilters.categoryId = 'all';
            }

            renderCategoryFilters(rawPlats);
            syncModalWithFilters();
        });
    });

    document.querySelectorAll('.filter-day-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-day-btn').forEach((entry) => {
                entry.classList.remove('bg-yellow-500', 'text-white', 'active');
                entry.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');
        });
    });

    document.querySelectorAll('.filter-sort-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-sort-btn').forEach((entry) => {
                entry.classList.remove('bg-yellow-500', 'text-white', 'active');
                entry.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');
        });
    });
}

function syncModalWithFilters() {
    document.querySelectorAll('.filter-kind-btn').forEach((btn) => {
        if (btn.dataset.kind === activeFilters.kind) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white', 'active');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });

    document.querySelectorAll('.filter-menu-category-btn').forEach((btn) => {
        if (btn.dataset.categoryId === activeFilters.categoryId) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-400', 'text-white');
        } else {
            btn.classList.remove('bg-yellow-400', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });

    document.querySelectorAll('.filter-day-btn').forEach((btn) => {
        if (btn.dataset.day === activeFilters.selectedDay) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white', 'active');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });

    document.querySelectorAll('.filter-sort-btn').forEach((btn) => {
        if (btn.dataset.sort === activeFilters.sortBy) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white', 'active');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white', 'active');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
}

function resetAllFilters() {
    activeFilters = {
        kind: 'all',
        categoryId: 'all',
        selectedDay: null,
        sortBy: 'category:asc',
        search: ''
    };

    const searchInput = document.getElementById('menu-search');
    if (searchInput) searchInput.value = '';

    saveFiltersToStorage();
}

function applyFiltersAndRender() {
    const plats = store.get('rawPlats') || [];
    const selectedDay = store.get('selectedDay');
    const currentDay = store.get('currentDay');

    renderCategoryFilters(plats);
    const filtered = applyFiltersToPlats(plats);
    store.set('plats', filtered);
    renderMenu(filtered, selectedDay, currentDay);
}

function updateActiveFiltersCount() {
    let count = 0;
    if (activeFilters.kind !== 'all') count += 1;
    if (activeFilters.categoryId !== 'all') count += 1;
    if (activeFilters.selectedDay) count += 1;
    if (activeFilters.sortBy !== 'category:asc') count += 1;
    if (activeFilters.search) count += 1;

    const badge = document.getElementById('active-filters-count');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function saveFiltersToStorage() {
    localStorage.setItem('menuFilters', JSON.stringify(activeFilters));
}

function loadFiltersFromStorage() {
    const saved = localStorage.getItem('menuFilters');
    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);
        activeFilters = { ...activeFilters, ...parsed };
        if (parsed.category && !parsed.kind) {
            activeFilters.kind = parsed.category;
        }

        const searchInput = document.getElementById('menu-search');
        if (searchInput) searchInput.value = activeFilters.search;
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

function setupMenuEvents() {
    const unsubscribe = store.subscribe('plats', (plats) => {
        if (plats !== currentPlats) {
            currentPlats = plats;
            renderCategoryFilters(store.get('rawPlats') || plats || []);
            renderMenu(plats, store.get('selectedDay'), store.get('currentDay'));
        }
    });

    return unsubscribe;
}
