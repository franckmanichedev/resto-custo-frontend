// client/js/cart.js

import { api, formatPrice } from '../../../shared/api/apiClient.js';
import { showToast, confirmDialog, groupItemsByVariant, escapeHtml } from '../../../shared/utils/index.js';
import { store } from '../store/clientStore.js';
import { sessionManager } from '../services/sessionService.js';
import {
    removeLocalCartItem,
    updateLocalCartItemQuantity,
    getCartOrderPayload,
    clearLocalCart
} from '../services/localCartService.js';

export async function initCart() {
    updateCartBadges();
    renderCart();

    const unsubscribe = store.subscribe('cart', () => {
        renderCart();
        updateCartBadges();
    });

    return unsubscribe;
}

function updateCartBadges() {
    const cart = store.get('cart');
    const totalItems = cart?.total_items || 0;

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
        cartItemsContainer.innerHTML = '';
        return;
    }

    if (cartEmpty) cartEmpty.classList.add('hidden');
    if (cartSummary) cartSummary.classList.remove('hidden');

    const groupedItems = groupCartItems(cart.items);
    cartItemsContainer.innerHTML = groupedItems.map((group) => renderCartGroup(group)).join('');
    updateCartTotals(cart);
    attachCartEvents();
}

function groupCartItems(items) {
    const groups = {};

    items.forEach((item) => {
        const key = item.id;
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

function renderCartTaxonomy(item) {
    const labels = [];

    if (item.kind) {
        labels.push({
            text: item.kind === 'boisson' ? 'Boisson' : 'Plat',
            classes: 'bg-gray-100 text-gray-700'
        });
    }

    if (item.categorie_name) {
        labels.push({
            text: item.categorie_name,
            classes: 'bg-yellow-50 text-yellow-700'
        });
    }

    if (item.type_categorie_name) {
        labels.push({
            text: item.type_categorie_name,
            classes: 'bg-blue-50 text-blue-700'
        });
    }

    if (!labels.length) return '';

    return `
        <div class="mt-2 flex flex-wrap gap-2">
            ${labels.map((label) => `
                <span class="rounded-full px-2 py-0.5 text-xs font-medium ${label.classes}">
                    ${escapeHtml(label.text)}
                </span>
            `).join('')}
        </div>
    `;
}

function renderCartGroup(item) {
    const variantGroups = groupItemsByVariant([item]);
    const hasVariants = variantGroups.length > 1 || (variantGroups[0]?.label !== 'Standard');

    return `
        <div class="cart-group bg-white rounded-xl p-4 shadow-sm border border-gray-100" data-item-id="${escapeHtml(item.id)}">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-semibold text-gray-800">${escapeHtml(item.plat_name)}</h4>
                    ${renderCartTaxonomy(item)}
                    <p class="text-sm text-gray-500">${formatPrice(item.plat_price)} l'unite</p>
                </div>
                <button class="remove-all text-gray-400 hover:text-red-500" data-id="${escapeHtml(item.id)}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>

            ${hasVariants ? `
                <div class="mb-3">
                    ${variantGroups.map((variant) => `
                        <div class="text-sm text-gray-600 mb-2 pb-2 border-b border-gray-100 last:border-0">
                            <span class="font-medium">${escapeHtml(variant.label)}</span>
                            <div class="flex items-center justify-between mt-1">
                                <span class="text-gray-500">Quantite: ${variant.quantity}</span>
                                <span class="font-medium">${formatPrice(variant.totalPrice)}</span>
                            </div>
                            ${variant.compositions.length ? `
                                <div class="flex flex-wrap gap-1 mt-2">
                                    ${variant.compositions.map((comp) => `
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
    document.querySelectorAll('.remove-all').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            const confirmed = await confirmDialog('Supprimer cet article du panier ?');
            if (confirmed) {
                await removeCartItem(itemId);
            }
        });
    });

    document.querySelectorAll('.decrease-qty').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await changeCartItemQuantity(itemId, -1);
        });
    });

    document.querySelectorAll('.increase-qty').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await changeCartItemQuantity(itemId, 1);
        });
    });

    const validateBtn = document.getElementById('validate-order');
    if (validateBtn) {
        validateBtn.addEventListener('click', openCustomerInfoModal);
    }
}

async function removeCartItem(itemId) {
    try {
        removeLocalCartItem(itemId);
        showToast('Article retire du panier', 'success');
    } catch (error) {
        showToast(error.message || 'Erreur suppression', 'error');
    }
}

async function changeCartItemQuantity(itemId, delta) {
    const cart = store.get('cart');
    if (!cart) return;

    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) return;

    const newQuantity = Math.max(1, item.quantity + delta);

    try {
        updateLocalCartItemQuantity(itemId, newQuantity);
    } catch (error) {
        showToast(error.message || 'Erreur mise a jour', 'error');
    }
}

function openCustomerInfoModal() {
    const cart = store.get('cart');
    if (!cart || !cart.items?.length) {
        showToast('Votre panier est vide', 'warning');
        return;
    }

    const modal = document.getElementById('customer-info-modal');
    if (!modal) return;

    const savedName = localStorage.getItem('frontOfficeCustomerName') || '';
    const savedPhone = localStorage.getItem('frontOfficeCustomerPhone') || '';
    const savedGuests = localStorage.getItem('frontOfficeGuests') || '2';

    const nameInput = document.getElementById('checkout-customer-name');
    const phoneInput = document.getElementById('checkout-customer-phone');
    const guestsCount = document.getElementById('checkout-guests-count');

    if (nameInput) nameInput.value = savedName;
    if (phoneInput) phoneInput.value = savedPhone;
    if (guestsCount) guestsCount.textContent = savedGuests;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setupCustomerModalEvents();
}

function setupCustomerModalEvents() {
    const modal = document.getElementById('customer-info-modal');
    const confirmBtn = document.getElementById('confirm-checkout');
    const cancelBtn = document.getElementById('cancel-checkout');
    const guestsMinus = document.getElementById('checkout-guests-minus');
    const guestsPlus = document.getElementById('checkout-guests-plus');
    const guestsCount = document.getElementById('checkout-guests-count');

    if (!modal) return;

    if (guestsMinus && guestsPlus && guestsCount) {
        const updateGuests = (delta) => {
            const current = parseInt(guestsCount.textContent, 10) || 2;
            const nextValue = Math.max(1, Math.min(20, current + delta));
            guestsCount.textContent = nextValue;
        };

        guestsMinus.onclick = () => updateGuests(-1);
        guestsPlus.onclick = () => updateGuests(1);
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
    }

    modal.onclick = (event) => {
        if (event.target === modal) closeModal();
    };

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const nameInput = document.getElementById('checkout-customer-name');
            const phoneInput = document.getElementById('checkout-customer-phone');
            const guestsCountSpan = document.getElementById('checkout-guests-count');

            const customerName = nameInput?.value.trim() || '';
            const customerPhone = phoneInput?.value.trim() || '';
            const guests = parseInt(guestsCountSpan?.textContent || '2', 10);

            if (!customerName || !customerPhone) {
                showToast('Veuillez renseigner votre nom et telephone', 'warning');
                return;
            }

            localStorage.setItem('frontOfficeCustomerName', customerName);
            localStorage.setItem('frontOfficeCustomerPhone', customerPhone);
            localStorage.setItem('frontOfficeGuests', String(guests));
            store.set('customerInfo', { name: customerName, phone: customerPhone, guests });

            closeModal();
            await validateOrder(customerName, customerPhone, guests);
        };
    }
}

async function validateOrder(customerName, customerPhone, guests) {
    const session = store.get('session');
    const cart = store.get('cart');

    if (!session?.session_token || !cart || !cart.items?.length) {
        showToast('Votre panier est vide', 'warning');
        return;
    }

    try {
        const response = await api.session.createOrder({
            session_token: session.session_token,
            customer: {
                name: customerName,
                phone: customerPhone,
                guests
            },
            note: '',
            items: getCartOrderPayload()
        });

        clearLocalCart(session.session_token);
        store.setMultiple({
            session: response.data.session,
            orders: response.data.orders || [response.data.order].filter(Boolean)
        });
        showToast('Commande envoyee avec succes !', 'success');
        store.set('currentView', 'track');
        await sessionManager.refreshSessionData();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la commande', 'error');
    }
}
