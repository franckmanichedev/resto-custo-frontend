/**
 * Gestion du panier client
 */

import { api, formatPrice } from '../../shared/js/api.js';
import { store } from '../../shared/js/store.js';
import { showToast, confirmDialog, groupItemsByVariant, escapeHtml } from '../../shared/js/utils.js';
import { sessionManager } from './session.js';

let cartItemsContainer = null;

export async function initCart() {
    const cart = store.get('cart');
    
    // Mettre à jour les badges
    updateCartBadges();
    
    // Remplir le contenu
    renderCart();
    
    // Écouter les changements de panier
    const unsubscribe = store.subscribe('cart', () => {
        renderCart();
        updateCartBadges();
    });
    
    return unsubscribe;
}

function updateCartBadges() {
    const cart = store.get('cart');
    const totalItems = cart?.total_items || 0;
    
    // Mobile badge
    const mobileBadge = document.getElementById('mobile-cart-badge');
    const floatingBadge = document.getElementById('floating-cart-count');
    const desktopSidebarBadge = document.getElementById('desktop-sidebar-cart-count');
    const desktopCartCount = document.getElementById('desktop-cart-count');
    const floatingCart = document.getElementById('floating-cart');
    
    if (totalItems > 0) {
        if (mobileBadge) {
            mobileBadge.textContent = totalItems > 99 ? '99+' : totalItems;
            mobileBadge.classList.remove('hidden');
        }
        if (floatingBadge) {
            floatingBadge.textContent = totalItems > 99 ? '99+' : totalItems;
            floatingBadge.classList.remove('hidden');
        }
        if (desktopSidebarBadge) {
            desktopSidebarBadge.textContent = totalItems > 99 ? '99+' : totalItems;
            desktopSidebarBadge.classList.remove('hidden');
        }
        if (desktopCartCount) {
            desktopCartCount.textContent = totalItems > 99 ? '99+' : totalItems;
        }
        if (floatingCart) floatingCart.classList.remove('hidden');
    } else {
        if (mobileBadge) mobileBadge.classList.add('hidden');
        if (floatingBadge) floatingBadge.classList.add('hidden');
        if (desktopSidebarBadge) desktopSidebarBadge.classList.add('hidden');
        if (desktopCartCount) desktopCartCount.textContent = '0';
        if (floatingCart) floatingCart.classList.add('hidden');
    }
}

function renderCart() {
    const cart = store.get('cart');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartItemsContainer) return;
    
    if (!cart || !cart.items || cart.items.length === 0) {
        if (cartEmpty) cartEmpty.classList.remove('hidden');
        if (cartSummary) cartSummary.classList.add('hidden');
        return;
    }
    
    if (cartEmpty) cartEmpty.classList.add('hidden');
    if (cartSummary) cartSummary.classList.remove('hidden');
    
    // Grouper les items par plat et variante
    const groupedItems = groupCartItems(cart.items);
    
    cartItemsContainer.innerHTML = groupedItems.map(group => renderCartGroup(group)).join('');
    
    // Mettre à jour les totaux
    updateCartTotals(cart);
    
    // Attacher les événements
    attachCartEvents();
}

function groupCartItems(items) {
    const groups = {};
    
    items.forEach(item => {
        const key = `${item.plat_id}_${JSON.stringify(item.compositions || [])}`;
        if (!groups[key]) {
            groups[key] = {
                ...item,
                quantity: 0,
                total_price: 0
            };
        }
        groups[key].quantity += item.quantity;
        groups[key].total_price += item.total_price;
    });
    
    return Object.values(groups);
}

function renderCartGroup(item) {
    const variantGroups = groupItemsByVariant([item]);
    const hasVariants = variantGroups.length > 1 || (variantGroups[0]?.label !== 'Standard');
    
    return `
        <div class="cart-group bg-white rounded-xl p-4 shadow-sm border border-gray-100" data-item-id="${escapeHtml(item.id)}">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-semibold text-gray-800">${escapeHtml(item.plat_name)}</h4>
                    <p class="text-sm text-gray-500">${formatPrice(item.plat_price)} l'unité</p>
                </div>
                <button class="remove-all text-gray-400 hover:text-red-500" data-id="${escapeHtml(item.id)}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            
            ${hasVariants ? `
                <div class="mb-3">
                    ${variantGroups.map((variant, idx) => `
                        <div class="text-sm text-gray-600 mb-2 pb-2 border-b border-gray-100 last:border-0">
                            <span class="font-medium">${escapeHtml(variant.label)}</span>
                            <div class="flex items-center justify-between mt-1">
                                <span class="text-gray-500">Quantité: ${variant.quantity}</span>
                                <span class="font-medium">${formatPrice(variant.totalPrice)}</span>
                            </div>
                            ${variant.compositions.length ? `
                                <div class="flex flex-wrap gap-1 mt-2">
                                    ${variant.compositions.map(comp => `
                                        <span class="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                            ${escapeHtml(comp.action)} ${escapeHtml(comp.composition_name || comp.composition_id)}
                                        </span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <button class="decrease-qty w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50" data-id="${escapeHtml(item.id)}">
                            <i class="fas fa-minus text-xs"></i>
                        </button>
                        <span class="qty w-8 text-center font-medium">${item.quantity}</span>
                        <button class="increase-qty w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50" data-id="${escapeHtml(item.id)}">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                    </div>
                    <span class="font-bold text-primary">${formatPrice(item.total_price)}</span>
                </div>
            `}
        </div>
    `;
}

function updateCartTotals(cart) {
    const subtotal = cart.subtotal || 0;
    const tax = cart.tax || 0;
    const total = cart.total_price || 0;
    
    const subtotalEl = document.getElementById('subtotal');
    const taxEl = document.getElementById('tax');
    const totalEl = document.getElementById('total');
    
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (taxEl) taxEl.textContent = formatPrice(tax);
    if (totalEl) totalEl.textContent = formatPrice(total);
}

function attachCartEvents() {
    // Boutons de suppression
    document.querySelectorAll('.remove-all').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = btn.dataset.id;
            const confirmed = await confirmDialog('Supprimer cet article du panier ?');
            if (confirmed) {
                await removeCartItem(itemId);
            }
        });
    });
    
    // Boutons de quantité (si pas de variantes)
    document.querySelectorAll('.decrease-qty').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await updateCartItemQuantity(itemId, -1);
        });
    });
    
    document.querySelectorAll('.increase-qty').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await updateCartItemQuantity(itemId, 1);
        });
    });
    
    // Bouton de validation
    const validateBtn = document.getElementById('validate-order');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateOrder);
    }
}

async function removeCartItem(itemId) {
    const session = store.get('session');
    if (!session?.session_token) return;
    
    try {
        const response = await api.session.removeFromCart(session.session_token, itemId);
        store.set('cart', response.data.cart);
        showToast('Article retiré du panier', 'success');
    } catch (error) {
        showToast(error.message || 'Erreur suppression', 'error');
    }
}

async function updateCartItemQuantity(itemId, delta) {
    const session = store.get('session');
    const cart = store.get('cart');
    if (!session?.session_token || !cart) return;
    
    const item = cart.items.find(i => i.id === itemId);
    if (!item) return;
    
    const newQuantity = Math.max(1, item.quantity + delta);
    
    try {
        const response = await api.session.updateCartItem(session.session_token, itemId, newQuantity);
        store.set('cart', response.data.cart);
    } catch (error) {
        showToast(error.message || 'Erreur mise à jour', 'error');
    }
}

async function validateOrder() {
    const session = store.get('session');
    const cart = store.get('cart');
    
    if (!session?.session_token || !cart || !cart.items?.length) {
        showToast('Votre panier est vide', 'warning');
        return;
    }
    
    // Récupérer les infos client
    const customerName = localStorage.getItem('frontOfficeCustomerName') || '';
    const customerPhone = localStorage.getItem('frontOfficeCustomerPhone') || '';
    
    if (!customerName || !customerPhone) {
        showToast('Veuillez renseigner votre nom et téléphone dans l\'onglet Client', 'warning');
        store.set('currentView', 'profile');
        return;
    }
    
    const confirmed = await confirmDialog(`Confirmer la commande pour ${customerName} ?`, 'Validation');
    if (!confirmed) return;
    
    try {
        const response = await api.session.checkout(session.session_token, {
            name: customerName,
            phone: customerPhone
        }, '');
        
        store.setMultiple({
            session: response.data.session,
            cart: response.data.cart,
            orders: response.data.orders || []
        });
        
        showToast('Commande envoyée avec succès !', 'success');
        store.set('currentView', 'track');
        
    } catch (error) {
        showToast(error.message || 'Erreur lors de la commande', 'error');
    }
}