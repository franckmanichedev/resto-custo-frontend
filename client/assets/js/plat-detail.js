/**
 * Détail du plat et personnalisation
 */

import { api, formatPrice, getWeekDayLabel } from '../../../shared/js/api.js';
import { store } from '../../../shared/js/store.js';
import { showToast, escapeHtml } from '../../../shared/js/utils.js';
import { sessionManager } from './session.js';

let currentPlat = null;
let unitCustomizations = [];
let currentQuantity = 1;
let isConfigExpanded = false;

// Helper pour vérifier l'existence des éléments
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

export function openPlatModal(plat) {
    currentPlat = plat;
    unitCustomizations = [];
    currentQuantity = 1;
    isConfigExpanded = false;
    
    // Définir isOrderable
    const isOrderable = store.get('selectedDay') === store.get('currentDay') && plat.is_orderable_today;

    // Vérifier que tous les éléments existent avant de continuer
    const nameEl = getElement('modal-plat-name');
    const descEl = getElement('modal-plat-description');
    const priceEl = getElement('modal-plat-price');
    const prepEl = getElement('modal-plat-prep');
    const imgEl = getElement('modal-plat-image');
    const orderableEl = getElement('modal-plat-orderable');
    const daysContainer = getElement('modal-plat-days');
    const quantitySpan = getElement('order-quantity');
    const totalPriceEl = getElement('modal-total-price');
    const configSection = getElement('unit-configurations-section');
    const configContainer = getElement('unit-configurations');
    const toggleBtn = getElement('toggle-configurations');

    // Si un élément essentiel manque, ne pas continuer
    if (!nameEl || !descEl || !priceEl || !prepEl) {
        console.error('Modal elements missing');
        showToast('Erreur d\'affichage du plat', 'error');
        return;
    }

    // Remplir les informations
    nameEl.textContent = plat.name || 'Sans nom';
    descEl.textContent = plat.description || 'Aucune description';
    priceEl.textContent = formatPrice(plat.price || 0);
    prepEl.textContent = `${plat.prep_time || 0} min`;
    
    // Image
    if (imgEl) {
        if (plat.image_url) {
            imgEl.src = plat.image_url;
            imgEl.alt = plat.name || 'Image du plat';
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }
    }
    
    // Disponibilité aujourd'hui
    if (orderableEl) {
        orderableEl.textContent = isOrderable ? '✅ Commandable aujourd\'hui' : '❌ Non commandable aujourd\'hui';
        orderableEl.className = isOrderable ? 'text-green-600 font-medium' : 'text-red-500';
    }
    
    // Jours consultables
    if (daysContainer) {
        if (plat.consultable_days && plat.consultable_days.length) {
            daysContainer.innerHTML = plat.consultable_days.map(day => `
                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    ${escapeHtml(getWeekDayLabel(day))}
                </span>
            `).join('');
        } else {
            daysContainer.innerHTML = '<span class="text-sm text-gray-500">Tous les jours</span>';
        }
    }
    
    // Compositions
    const compositions = plat.compositions || [];
    const hasCompositions = compositions.length > 0 && plat.is_decomposable === true;
    
    if (configSection && configContainer && toggleBtn) {
        if (hasCompositions && isOrderable) {
            configSection.classList.remove('hidden');
            renderUnitConfigurations(compositions);
            
            // Réinitialiser l'état du bouton "Voir plus"
            isConfigExpanded = false;
            toggleBtn.textContent = 'Voir plus';
            configContainer.classList.add('collapsed');
            
            // Vérifier si le contenu dépasse la hauteur maximale
            setTimeout(() => {
                checkConfigHeight();
            }, 100);
        } else {
            configSection.classList.add('hidden');
        }
    }
    
    // Quantité - initialiser l'affichage
    if (quantitySpan) {
        quantitySpan.textContent = currentQuantity;
        updateOrderTotal();
    }
    
    // Afficher la modal
    const modal = getElement('plat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // Setup événements
    setupModalEvents(compositions);
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
    
    const quantity = currentQuantity;
    
    // Ajuster le nombre de configurations
    while (unitCustomizations.length < quantity) {
        unitCustomizations.push({
            removedCompositionIds: new Set()
        });
    }
    while (unitCustomizations.length > quantity) {
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
                ${compositions.map(comp => {
                    const removed = unitConfig.removedCompositionIds.has(comp.id);
                    return `
                        <button
                            type="button"
                            data-unit-index="${index}"
                            data-composition-id="${escapeHtml(comp.id)}"
                            class="toggle-composition rounded-full px-3 py-2 text-xs font-medium transition-all flex-shrink-0 ${removed ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                        >
                            ${removed ? '✕ ' : ''}${escapeHtml(comp.name)}${comp.is_allergen ? ' ⚠️' : ''}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `);
    
    // Attacher les événements
    document.querySelectorAll('.toggle-composition').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const unitIndex = parseInt(btn.dataset.unitIndex);
            const compositionId = btn.dataset.compositionId;
            const unitConfig = unitCustomizations[unitIndex];
            
            if (unitConfig.removedCompositionIds.has(compositionId)) {
                unitConfig.removedCompositionIds.delete(compositionId);
            } else {
                unitConfig.removedCompositionIds.add(compositionId);
            }
            
            renderUnitConfigurations(compositions);
        });
    });
    
    setTimeout(() => {
        checkConfigHeight();
    }, 100);
}

function updateOrderTotal() {
    const totalPriceEl = document.getElementById('modal-total-price');
    
    if (!totalPriceEl || !currentPlat) return;
    
    const total = (currentPlat.price || 0) * currentQuantity;
    totalPriceEl.textContent = formatPrice(total);
}

function setupModalEvents(compositions) {
    const quantityMinusBtn = document.getElementById('quantity-minus');
    const quantityPlusBtn = document.getElementById('quantity-plus');
    const quantitySpan = document.getElementById('order-quantity');
    const closeBtn = document.getElementById('close-modal');
    const modal = document.getElementById('plat-modal');
    const form = document.getElementById('order-form');
    const configSection = document.getElementById('unit-configurations-section');
    const toggleBtn = document.getElementById('toggle-configurations');
    
    if (!modal || !form) return;
    
    // Gestion du bouton "Voir plus / Voir moins"
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleConfigExpand);
    }
    
    // Gestion des boutons de quantité
    const updateQuantity = (newQuantity) => {
        if (newQuantity < 1) return;
        if (newQuantity > 99) return;
        
        currentQuantity = newQuantity;
        if (quantitySpan) {
            quantitySpan.textContent = currentQuantity;
        }
        
        if (compositions && compositions.length && configSection && !configSection.classList.contains('hidden')) {
            renderUnitConfigurations(compositions);
        }
        
        updateOrderTotal();
    };
    
    if (quantityMinusBtn) {
        quantityMinusBtn.addEventListener('click', () => {
            updateQuantity(currentQuantity - 1);
        });
    }
    
    if (quantityPlusBtn) {
        quantityPlusBtn.addEventListener('click', () => {
            updateQuantity(currentQuantity + 1);
        });
    }
    
    // Fermeture
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        currentPlat = null;
        unitCustomizations = [];
        currentQuantity = 1;
        isConfigExpanded = false;
    };
    
    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
    
    // Soumission - Ajout au panier SANS demander les infos client
    const submitHandler = async (e) => {
        e.preventDefault();
        
        const session = store.get('session');
        const selectedDay = store.get('selectedDay');
        const currentDay = store.get('currentDay');
        
        if (!session?.session_token) {
            showToast('Session expirée, veuillez scanner à nouveau', 'error');
            closeModal();
            return;
        }
        
        if (!currentPlat) {
            showToast('Erreur: plat non trouvé', 'error');
            return;
        }
        
        if (selectedDay !== currentDay || !currentPlat.is_orderable_today) {
            showToast('Ce plat n\'est pas commandable aujourd\'hui', 'warning');
            return;
        }
        
        const quantity = currentQuantity;
        
        // Construire les line items
        const lineItems = unitCustomizations.map(unitConfig => ({
            quantity: 1,
            composition_actions: Array.from(unitConfig.removedCompositionIds).map(compId => ({
                composition_id: compId,
                action: 'removed'
            }))
        }));
        
        try {
            await api.session.addToCart(
                session.session_token,
                currentPlat.id,
                quantity,
                lineItems
            );
            
            // Rafraîchir le panier
            await sessionManager.refreshCart();
            
            showToast(`${currentPlat.name} ajouté au panier`, 'success');
            closeModal();
            
        } catch (error) {
            console.error('Add to cart error:', error);
            showToast(error.message || 'Erreur ajout au panier', 'error');
        }
    };
    
    form.removeEventListener('submit', submitHandler);
    form.addEventListener('submit', submitHandler);
}