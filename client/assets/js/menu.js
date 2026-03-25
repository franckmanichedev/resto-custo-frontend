/**
 * Menu client - Affichage et gestion du menu
 */

import { api, formatPrice, getWeekDayLabel, getCurrentDay } from '../../../shared/js/api.js';
import { store, CATEGORY_ORDER, CATEGORY_LABELS } from '../../../shared/js/store.js';
import { showToast, debounce, escapeHtml } from '../../../shared/js/utils.js';
import { sessionManager } from './session.js';
import { openPlatModal } from './plat-detail.js';

let currentPlats = [];
let activeFilters = {
    category: 'all',
    selectedDay: null,
    sortBy: 'category:asc',
    search: ''
};

export async function initMenu() {
    const plats = store.get('plats');
    const selectedDay = store.get('selectedDay');
    const currentDay = store.get('currentDay');
    const consultableDays = store.get('consultableDays');
    
    currentPlats = plats || [];
    
    // Restaurer les filtres depuis localStorage
    loadFiltersFromStorage();
    
    renderDayTabs(consultableDays, selectedDay, currentDay);
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
    
    container.innerHTML = days.map(day => `
        <button type="button" data-day="${day}" class="day-tab rounded-2xl px-4 py-2 text-sm font-bold transition-all ${day === selectedDay ? 'bg-yellow-500 text-white shadow-md' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}">
            ${escapeHtml(getWeekDayLabel(day))}
            ${day === currentDay ? '<span class="ml-1 text-xs">(aujourd\'hui)</span>' : ''}
        </button>
    `).join('');
    
    document.querySelectorAll('.day-tab').forEach(btn => {
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
    
    // Appliquer les filtres
    let filteredPlats = applyFiltersToPlats(plats, selectedDay);
    
    if (!filteredPlats.length) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Aucun plat ne correspond à vos critères</p>
                <button id="clear-filters-btn" class="mt-4 text-primary font-medium">Réinitialiser les filtres →</button>
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
    
    // Grouper par catégorie
    const grouped = {};
    CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
    filteredPlats.forEach(plat => {
        const cat = plat.category || 'plat';
        if (grouped[cat]) grouped[cat].push(plat);
        else grouped[cat] = [plat];
    });
    
    let html = '';
    
    for (const category of CATEGORY_ORDER) {
        const categoryPlats = grouped[category] || [];
        if (!categoryPlats.length) continue;
        
        html += `
            <section class="col-span-full mb-8">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-serif font-semibold text-gray-800">${CATEGORY_LABELS[category] || category}</h2>
                    <span class="text-sm text-gray-500">${categoryPlats.length} plat(s)</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${categoryPlats.map(plat => renderPlatCard(plat, selectedDay, currentDay)).join('')}
                </div>
            </section>
        `;
    }
    
    container.innerHTML = html;
    
    document.querySelectorAll('.open-plat-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const platId = btn.dataset.id;
            const plat = filteredPlats.find(p => p.id === platId);
            if (plat) openPlatModal(plat);
        });
    });
}

function applyFiltersToPlats(plats, selectedDay) {
    let filtered = [...plats];
    
    // Filtre par recherche
    if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        filtered = filtered.filter(p => 
            p.name?.toLowerCase().includes(searchLower) ||
            p.description?.toLowerCase().includes(searchLower) ||
            p.compositions?.some(c => c.name?.toLowerCase().includes(searchLower))
        );
    }
    
    // Filtre par catégorie
    if (activeFilters.category !== 'all') {
        filtered = filtered.filter(p => (p.category || 'plat') === activeFilters.category);
    }
    
    // Filtre par jour de disponibilité
    if (activeFilters.selectedDay) {
        filtered = filtered.filter(p => {
            // Si le plat est disponible tous les jours
            if (p.availability_mode === 'everyday') return true;
            // Si le plat a des jours spécifiques
            if (p.available_days && p.available_days.includes(activeFilters.selectedDay)) return true;
            return false;
        });
    }
    
    // Tri
    const [sortBy, sortOrder] = activeFilters.sortBy.split(':');
    filtered.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
            comparison = (a.name || '').localeCompare(b.name || '');
        } else if (sortBy === 'price') {
            comparison = (a.price || 0) - (b.price || 0);
        } else {
            comparison = ((a.category || 'plat') > (b.category || 'plat') ? 1 : -1);
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
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-semibold text-lg">${escapeHtml(plat.name)}</h3>
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
        searchInput.addEventListener('input', debounce((e) => {
            activeFilters.search = e.target.value;
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
    
    // Ouvrir la modal
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            // Synchroniser les valeurs actuelles dans la modal
            syncModalWithFilters();
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    }
    
    // Fermer la modal
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Appliquer les filtres
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            // Récupérer les valeurs de la modal
            const selectedCategory = document.querySelector('.filter-category-btn.active')?.dataset.category || 'all';
            const selectedDayBtn = document.querySelector('.filter-day-btn.active');
            const selectedDay = selectedDayBtn ? selectedDayBtn.dataset.day : null;
            const selectedSort = document.querySelector('.filter-sort-btn.active')?.dataset.sort || 'category:asc';
            
            activeFilters.category = selectedCategory;
            activeFilters.selectedDay = selectedDay;
            activeFilters.sortBy = selectedSort;
            
            saveFiltersToStorage();
            applyFiltersAndRender();
            updateActiveFiltersCount();
            closeModal();
        });
    }
    
    // Réinitialiser les filtres
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetAllFilters();
            syncModalWithFilters();
            applyFiltersAndRender();
            updateActiveFiltersCount();
        });
    }
    
    // Événements pour les boutons dans la modal
    document.querySelectorAll('.filter-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-category-btn').forEach(b => {
                b.classList.remove('bg-yellow-500', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        });
    });
    
    document.querySelectorAll('.filter-day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-day-btn').forEach(b => {
                b.classList.remove('bg-yellow-500', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        });
    });
    
    document.querySelectorAll('.filter-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-sort-btn').forEach(b => {
                b.classList.remove('bg-yellow-500', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        });
    });
}

function syncModalWithFilters() {
    // Synchroniser la catégorie
    document.querySelectorAll('.filter-category-btn').forEach(btn => {
        if (btn.dataset.category === activeFilters.category) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
    
    // Synchroniser le jour
    document.querySelectorAll('.filter-day-btn').forEach(btn => {
        if (btn.dataset.day === activeFilters.selectedDay) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
    
    // Synchroniser le tri
    document.querySelectorAll('.filter-sort-btn').forEach(btn => {
        if (btn.dataset.sort === activeFilters.sortBy) {
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            btn.classList.add('bg-yellow-500', 'text-white');
        } else {
            btn.classList.remove('bg-yellow-500', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
}

function resetAllFilters() {
    activeFilters = {
        category: 'all',
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
    
    const filtered = applyFiltersToPlats(plats, selectedDay);
    store.set('plats', filtered);
    renderMenu(filtered, selectedDay, currentDay);
}

function updateActiveFiltersCount() {
    let count = 0;
    if (activeFilters.category !== 'all') count++;
    if (activeFilters.selectedDay) count++;
    if (activeFilters.sortBy !== 'category:asc') count++;
    if (activeFilters.search) count++;
    
    const badge = document.getElementById('active-filters-count');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function saveFiltersToStorage() {
    localStorage.setItem('menuFilters', JSON.stringify(activeFilters));
}

function loadFiltersFromStorage() {
    const saved = localStorage.getItem('menuFilters');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            activeFilters = { ...activeFilters, ...parsed };
            
            const searchInput = document.getElementById('menu-search');
            if (searchInput) searchInput.value = activeFilters.search;
        } catch (e) {
            console.error('Error loading filters:', e);
        }
    }
}

function setupMenuEvents() {
    const unsubscribe = store.subscribe('plats', (plats) => {
        if (plats !== currentPlats) {
            currentPlats = plats;
            renderMenu(plats, store.get('selectedDay'), store.get('currentDay'));
        }
    });
    
    return unsubscribe;
}