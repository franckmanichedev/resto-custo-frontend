/**
 * Menu client - Affichage et gestion du menu
 */

import { api, formatPrice, getWeekDayLabel, WEEK_DAYS, getCurrentDay } from '../../shared/js/api.js';
import { store, CATEGORY_ORDER, CATEGORY_LABELS } from '../../shared/js/store.js';
import { showToast, debounce, escapeHtml } from '../../shared/js/utils.js';
import { sessionManager } from './session.js';
import { openPlatModal } from './plat-detail.js';

let currentPlats = [];
let menuSearchTimeout = null;

export async function initMenu() {
    // Récupérer les données
    const plats = store.get('plats');
    const selectedDay = store.get('selectedDay');
    const currentDay = store.get('currentDay');
    const consultableDays = store.get('consultableDays');
    
    currentPlats = plats || [];
    
    // Remplir les jours
    renderDayTabs(consultableDays, selectedDay, currentDay);
    
    // Remplir le menu
    renderMenu(currentPlats, selectedDay, currentDay);
    
    // Setup des filtres
    setupFilters();
    
    // Setup des événements
    setupMenuEvents();
}

function renderDayTabs(days, selectedDay, currentDay) {
    const container = document.getElementById('day-tabs');
    if (!container) return;
    
    if (!days || !days.length) {
        container.innerHTML = '<span class="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">Aucun jour disponible</span>';
        return;
    }
    
    container.innerHTML = days.map(day => `
        <button type="button" data-day="${day}" class="day-tab rounded-2xl px-4 py-2 text-sm font-bold transition-all ${day === selectedDay ? 'bg-primary text-white shadow-md' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}">
            ${escapeHtml(getWeekDayLabel(day))}
            ${day === currentDay ? '<span class="ml-1 text-xs">(aujourd\'hui)</span>' : ''}
        </button>
    `).join('');
    
    // Écouter les changements de jour
    document.querySelectorAll('.day-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            const day = btn.dataset.day;
            if (day === store.get('selectedDay')) return;
            
            try {
                await sessionManager.loadMenuForDay(day);
                // Re-render après chargement
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
    
    if (!plats.length) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Aucun plat disponible pour ce jour.</div>';
        return;
    }
    
    // Grouper par catégorie
    const grouped = {};
    CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
    plats.forEach(plat => {
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
    
    // Attacher les événements aux cartes
    document.querySelectorAll('.open-plat-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const platId = btn.dataset.id;
            const plat = plats.find(p => p.id === platId);
            if (plat) openPlatModal(plat);
        });
    });
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
                    <button class="open-plat-detail bg-primary/10 hover:bg-primary text-primary hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all" data-id="${escapeHtml(plat.id)}">
                        <i class="fas fa-plus mr-1"></i> Voir
                    </button>
                </div>
            </div>
        </article>
    `;
}

function setupFilters() {
    const searchInput = document.getElementById('menu-search');
    const categoryFilter = document.getElementById('menu-category-filter');
    const sortSelect = document.getElementById('menu-sort');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            applyFilters();
        }, 300));
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => applyFilters());
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => applyFilters());
    }
}

function applyFilters() {
    const rawPlats = store.get('rawPlats') || [];
    const search = document.getElementById('menu-search')?.value.trim().toLowerCase() || '';
    const category = document.getElementById('menu-category-filter')?.value || 'all';
    const sortValue = document.getElementById('menu-sort')?.value || 'category:asc';
    const [sortBy, sortOrder] = sortValue.split(':');
    
    let filtered = [...rawPlats];
    
    // Filtre catégorie
    if (category !== 'all') {
        filtered = filtered.filter(p => (p.category || 'plat') === category);
    }
    
    // Filtre recherche
    if (search) {
        filtered = filtered.filter(p => 
            p.name?.toLowerCase().includes(search) ||
            p.description?.toLowerCase().includes(search) ||
            p.compositions?.some(c => c.name?.toLowerCase().includes(search))
        );
    }
    
    // Tri
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
    
    store.set('plats', filtered);
    renderMenu(filtered, store.get('selectedDay'), store.get('currentDay'));
}

function setupMenuEvents() {
    // Refresh après changement de store
    const unsubscribe = store.subscribe('plats', (plats) => {
        if (plats !== currentPlats) {
            currentPlats = plats;
            renderMenu(plats, store.get('selectedDay'), store.get('currentDay'));
        }
    });
    
    return unsubscribe;
}