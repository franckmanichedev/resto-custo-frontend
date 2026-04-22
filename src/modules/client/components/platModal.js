/**
 * Detail du plat et personnalisation
 */

import { formatPrice, getWeekDayLabel } from '../../../shared/api/apiClient.js';
import { showToast, escapeHtml } from '../../../shared/utils/index.js';
import { store } from '../store/clientStore.js';
import { sessionManager } from '../services/sessionService.js';
import { addMenuItemToLocalCart } from '../services/localCartService.js';

let currentPlat = null;
let unitCustomizations = [];
let currentQuantity = 1;
let isConfigExpanded = false;
let modalEventsInitialized = false;

function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

function closeCurrentModal() {
    const modal = document.getElementById('plat-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentPlat = null;
    unitCustomizations = [];
    currentQuantity = 1;
    isConfigExpanded = false;
}

export function openPlatModal(plat) {
    currentPlat = plat;
    unitCustomizations = [];
    currentQuantity = 1;
    isConfigExpanded = false;

    const isOrderable = store.get('selectedDay') === store.get('currentDay') && plat.is_orderable_today;

    const nameEl = getElement('modal-plat-name');
    const descEl = getElement('modal-plat-description');
    const priceEl = getElement('modal-plat-price');
    const prepEl = getElement('modal-plat-prep');
    const imgEl = getElement('modal-plat-image');
    const orderableEl = document.getElementById('modal-plat-orderable');
    const daysContainer = getElement('modal-plat-days');
    const taxonomyContainer = getElement('modal-plat-taxonomy');
    const quantitySpan = getElement('order-quantity');
    const configSection = getElement('unit-configurations-section');
    const configContainer = getElement('unit-configurations');
    const toggleBtn = getElement('toggle-configurations');

    if (!nameEl || !descEl || !priceEl || !prepEl) {
        console.error('Modal elements missing');
        showToast('Erreur d\'affichage du plat', 'error');
        return;
    }

    nameEl.textContent = plat.name || 'Sans nom';
    descEl.textContent = plat.description || 'Aucune description';
    priceEl.textContent = formatPrice(plat.price || 0);
    prepEl.textContent = `${plat.prep_time || 0} min`;

    if (taxonomyContainer) {
        const taxonomy = [
            {
                label: (plat.kind || plat.category) === 'boisson' ? 'Boisson' : 'Plat',
                classes: 'bg-gray-100 text-gray-700'
            },
            plat.categorie_name ? {
                label: plat.categorie_name,
                classes: 'bg-yellow-100 text-yellow-700'
            } : null,
            plat.type_categorie_name ? {
                label: plat.type_categorie_name,
                classes: 'bg-blue-100 text-blue-700'
            } : null
        ].filter(Boolean);

        taxonomyContainer.innerHTML = taxonomy.map((entry) => `
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${entry.classes}">
                ${escapeHtml(entry.label)}
            </span>
        `).join('');
    }

    if (imgEl) {
        if (plat.image_url) {
            imgEl.src = plat.image_url;
            imgEl.alt = plat.name || 'Image du plat';
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }
    }

    if (orderableEl) {
        orderableEl.textContent = isOrderable ? 'Commandable aujourd\'hui' : 'Non commandable aujourd\'hui';
        orderableEl.className = isOrderable ? 'text-sm font-medium text-green-600' : 'text-sm font-medium text-red-500';
    }

    if (daysContainer) {
        if (plat.consultable_days && plat.consultable_days.length) {
            daysContainer.innerHTML = plat.consultable_days.map((day) => `
                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    ${escapeHtml(getWeekDayLabel(day))}
                </span>
            `).join('');
        } else {
            daysContainer.innerHTML = '<span class="text-sm text-gray-500">Tous les jours</span>';
        }
    }

    const compositions = plat.compositions || [];
    const hasCompositions = compositions.length > 0 && plat.is_decomposable === true;

    if (configSection && configContainer && toggleBtn) {
        if (hasCompositions && isOrderable) {
            configSection.classList.remove('hidden');
            renderUnitConfigurations(compositions);
            isConfigExpanded = false;
            toggleBtn.textContent = 'Voir plus';
            configContainer.classList.add('collapsed');
            setTimeout(checkConfigHeight, 100);
        } else {
            configSection.classList.add('hidden');
            configContainer.innerHTML = '';
            toggleBtn.classList.add('hidden');
        }
    }

    if (quantitySpan) {
        quantitySpan.textContent = String(currentQuantity);
        updateOrderTotal();
    }

    const modal = getElement('plat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    initializeModalEvents();
}

function checkConfigHeight() {
    const configContainer = document.getElementById('unit-configurations');
    const toggleBtn = document.getElementById('toggle-configurations');

    if (!configContainer || !toggleBtn) return;

    const actualHeight = configContainer.scrollHeight;
    const maxHeight = 400;

    if (actualHeight > maxHeight) {
        toggleBtn.classList.remove('hidden');
    } else {
        toggleBtn.classList.add('hidden');
        configContainer.classList.remove('collapsed');
    }
}

function toggleConfigExpand() {
    const configContainer = document.getElementById('unit-configurations');
    const toggleBtn = document.getElementById('toggle-configurations');

    if (!configContainer || !toggleBtn) return;

    isConfigExpanded = !isConfigExpanded;

    if (isConfigExpanded) {
        configContainer.classList.remove('collapsed');
        toggleBtn.textContent = 'Voir moins';
    } else {
        configContainer.classList.add('collapsed');
        toggleBtn.textContent = 'Voir plus';
        configContainer.scrollTop = 0;
    }
}

function renderUnitConfigurations(compositions) {
    const container = document.getElementById('unit-configurations');
    const toggleBtn = document.getElementById('toggle-configurations');

    if (!container) return;

    while (unitCustomizations.length < currentQuantity) {
        unitCustomizations.push({ removedCompositionIds: new Set() });
    }
    while (unitCustomizations.length > currentQuantity) {
        unitCustomizations.pop();
    }

    if (!compositions.length) {
        container.innerHTML = '<p class="text-sm text-gray-500">Aucune composition configurable pour ce plat.</p>';
        if (toggleBtn) toggleBtn.classList.add('hidden');
        return;
    }

    container.innerHTML = unitCustomizations.map((unitConfig, index) => `
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <p class="font-medium text-gray-800">Exemplaire ${index + 1}</p>
                <span class="text-xs bg-gray-100 px-2 py-1 rounded-full">${unitConfig.removedCompositionIds.size} retrait(s)</span>
            </div>
            <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                ${compositions.map((comp) => {
                    const removed = unitConfig.removedCompositionIds.has(comp.id);
                    return `
                        <button
                            type="button"
                            data-unit-index="${index}"
                            data-composition-id="${escapeHtml(comp.id)}"
                            class="toggle-composition rounded-full px-3 py-2 text-xs font-medium transition-all flex-shrink-0 ${removed ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                        >
                            ${removed ? 'x ' : ''}${escapeHtml(comp.name)}${comp.is_allergen ? ' !' : ''}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.toggle-composition').forEach((btn) => {
        btn.addEventListener('click', () => {
            const unitIndex = parseInt(btn.dataset.unitIndex, 10);
            const compositionId = btn.dataset.compositionId;
            const unitConfig = unitCustomizations[unitIndex];
            if (!unitConfig) return;

            if (unitConfig.removedCompositionIds.has(compositionId)) {
                unitConfig.removedCompositionIds.delete(compositionId);
            } else {
                unitConfig.removedCompositionIds.add(compositionId);
            }

            renderUnitConfigurations(compositions);
        });
    });

    setTimeout(checkConfigHeight, 100);
}

function updateOrderTotal() {
    const totalPriceEl = document.getElementById('modal-total-price');
    if (!totalPriceEl || !currentPlat) return;

    const total = (currentPlat.price || 0) * currentQuantity;
    totalPriceEl.textContent = formatPrice(total);
}

function updateQuantity(nextQuantity) {
    if (nextQuantity < 1 || nextQuantity > 99) return;

    currentQuantity = nextQuantity;
    const quantitySpan = document.getElementById('order-quantity');
    if (quantitySpan) {
        quantitySpan.textContent = String(currentQuantity);
    }

    const configSection = document.getElementById('unit-configurations-section');
    const compositions = currentPlat?.compositions || [];
    if (compositions.length && configSection && !configSection.classList.contains('hidden')) {
        renderUnitConfigurations(compositions);
    }

    updateOrderTotal();
}

async function handleSubmit(event) {
    event.preventDefault();

    const session = store.get('session');
    const selectedDay = store.get('selectedDay');
    const currentDay = store.get('currentDay');

    if (!session?.session_token) {
        showToast('Session expiree, veuillez scanner a nouveau', 'error');
        closeCurrentModal();
        return;
    }

    if (!currentPlat) {
        showToast('Erreur: plat non trouve', 'error');
        return;
    }

    if (selectedDay !== currentDay || !currentPlat.is_orderable_today) {
        showToast('Ce plat n\'est pas commandable aujourd\'hui', 'warning');
        return;
    }

    const lineItems = unitCustomizations.length
        ? unitCustomizations.map((unitConfig) => ({
            quantity: 1,
            composition_actions: Array.from(unitConfig.removedCompositionIds).map((compId) => ({
                composition_id: compId,
                action: 'removed'
            }))
        }))
        : Array.from({ length: currentQuantity }, () => ({
            quantity: 1,
            composition_actions: []
        }));

    try {
        addMenuItemToLocalCart(currentPlat, lineItems);
        await sessionManager.refreshCart();
        showToast(`${currentPlat.name} ajoute au panier`, 'success');
        closeCurrentModal();
    } catch (error) {
        console.error('Add to cart error:', error);
        showToast(error.message || 'Erreur ajout au panier', 'error');
    }
}

function initializeModalEvents() {
    if (modalEventsInitialized) return;

    const quantityMinusBtn = document.getElementById('quantity-minus');
    const quantityPlusBtn = document.getElementById('quantity-plus');
    const closeBtn = document.getElementById('close-modal');
    const modal = document.getElementById('plat-modal');
    const form = document.getElementById('order-form');
    const toggleBtn = document.getElementById('toggle-configurations');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleConfigExpand);
    }

    if (quantityMinusBtn) {
        quantityMinusBtn.addEventListener('click', () => updateQuantity(currentQuantity - 1));
    }

    if (quantityPlusBtn) {
        quantityPlusBtn.addEventListener('click', () => updateQuantity(currentQuantity + 1));
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeCurrentModal);
    }

    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeCurrentModal();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    modalEventsInitialized = true;
}
