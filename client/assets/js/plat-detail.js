/**
 * Détail du plat et personnalisation
 */

import { api, formatPrice, getWeekDayLabel } from '../../../shared/js/api.js';
import { store } from '../../../shared/js/store.js';
import { showToast, escapeHtml } from '../../../shared/js/utils.js';
import { sessionManager } from './session.js';

let currentPlat = null;
let unitCustomizations = [];

export function openPlatModal(plat) {
    currentPlat = plat;
    unitCustomizations = [];
    
    // Remplir les informations
    document.getElementById('modal-plat-name').textContent = plat.name;
    document.getElementById('modal-plat-description').textContent = plat.description || 'Aucune description';
    document.getElementById('modal-plat-price').textContent = formatPrice(plat.price);
    document.getElementById('modal-plat-prep').textContent = `${plat.prep_time || 0} min`;
    
    // Image
    const img = document.getElementById('modal-plat-image');
    if (plat.image_url) {
        img.src = plat.image_url;
        img.alt = plat.name;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
    
    // Disponibilité
    const isOrderable = store.get('selectedDay') === store.get('currentDay') && plat.is_orderable_today;
    document.getElementById('modal-plat-orderable').textContent = isOrderable ? 'Oui' : 'Non';
    document.getElementById('modal-plat-orderable').className = isOrderable ? 'text-green-600 font-bold' : 'text-red-500 font-bold';
    
    // Jours consultables
    const daysContainer = document.getElementById('modal-plat-days');
    if (plat.consultable_days?.length) {
        daysContainer.innerHTML = plat.consultable_days.map(day => `
            <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">${escapeHtml(getWeekDayLabel(day))}</span>
        `).join('');
    } else {
        daysContainer.innerHTML = '<span class="text-sm text-gray-500">Tous les jours</span>';
    }
    
    // Compositions
    const compositions = plat.compositions || [];
    const hasCompositions = compositions.length > 0;
    const configSection = document.getElementById('unit-configurations-section');
    
    if (hasCompositions && isOrderable) {
        configSection.classList.remove('hidden');
        renderUnitConfigurations(compositions);
    } else {
        configSection.classList.add('hidden');
    }
    
    // Restaurer les infos client
    const savedName = localStorage.getItem('frontOfficeCustomerName');
    const savedPhone = localStorage.getItem('frontOfficeCustomerPhone');
    if (savedName) document.getElementById('customer-name').value = savedName;
    if (savedPhone) document.getElementById('customer-phone').value = savedPhone;
    
    // Quantité
    document.getElementById('order-quantity').value = 1;
    updateOrderTotal();
    
    // Afficher la modal
    const modal = document.getElementById('plat-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Setup événements
    setupModalEvents(compositions);
}

function renderUnitConfigurations(compositions) {
    const quantity = Math.max(1, Number(document.getElementById('order-quantity').value || 1));
    
    // Ajuster le nombre de configurations
    while (unitCustomizations.length < quantity) {
        unitCustomizations.push({
            removedCompositionIds: new Set()
        });
    }
    while (unitCustomizations.length > quantity) {
        unitCustomizations.pop();
    }
    
    const container = document.getElementById('unit-configurations');
    if (!container) return;
    
    if (!compositions.length) {
        container.innerHTML = '<p class="text-sm text-gray-500">Aucune composition configurable pour ce plat.</p>';
        return;
    }
    
    container.innerHTML = unitCustomizations.map((unitConfig, index) => `
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <p class="font-medium text-gray-800">Exemplaire ${index + 1}</p>
                <span class="text-xs bg-gray-100 px-2 py-1 rounded-full">${unitConfig.removedCompositionIds.size} retrait(s)</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${compositions.map(comp => {
                    const removed = unitConfig.removedCompositionIds.has(comp.id);
                    return `
                        <button
                            type="button"
                            data-unit-index="${index}"
                            data-composition-id="${escapeHtml(comp.id)}"
                            class="toggle-composition rounded-full px-3 py-2 text-xs font-medium transition-all ${removed ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
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
}

function updateOrderTotal() {
    const quantity = Number(document.getElementById('order-quantity').value || 1);
    const total = (currentPlat?.price || 0) * quantity;
    document.getElementById('modal-total-price').textContent = formatPrice(total);
}

function setupModalEvents(compositions) {
    const quantityInput = document.getElementById('order-quantity');
    const closeBtn = document.getElementById('close-modal');
    const modal = document.getElementById('plat-modal');
    const form = document.getElementById('order-form');
    
    // Nouveau handler pour éviter les doublons
    const newQuantityHandler = () => {
        if (compositions.length) {
            renderUnitConfigurations(compositions);
        }
        updateOrderTotal();
    };
    
    // Remplacer l'ancien handler
    quantityInput.removeEventListener('input', updateOrderTotal);
    quantityInput.addEventListener('input', newQuantityHandler);
    
    // Fermeture
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        currentPlat = null;
        unitCustomizations = [];
    };
    
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
    
    // Soumission
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
        
        if (selectedDay !== currentDay || !currentPlat.is_orderable_today) {
            showToast('Ce plat n\'est pas commandable aujourd\'hui', 'warning');
            return;
        }
        
        const quantity = Number(quantityInput.value || 1);
        const customerName = document.getElementById('customer-name').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        
        // Sauvegarder les infos client
        if (customerName) localStorage.setItem('frontOfficeCustomerName', customerName);
        if (customerPhone) localStorage.setItem('frontOfficeCustomerPhone', customerPhone);
        
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
            showToast(error.message || 'Erreur ajout au panier', 'error');
        }
    };
    
    form.removeEventListener('submit', submitHandler);
    form.addEventListener('submit', submitHandler);
}