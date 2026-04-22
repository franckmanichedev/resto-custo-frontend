import { store } from '../store/clientStore.js';

const STORAGE_PREFIX = 'front-office-cart:';

const getSessionToken = () => store.get('session')?.session_token || null;
const getStorageKey = (sessionToken) => `${STORAGE_PREFIX}${sessionToken}`;

const clone = (value) => JSON.parse(JSON.stringify(value));

function sortCompositionActions(actions = []) {
    return [...actions]
        .map((action) => ({
            composition_id: action.composition_id,
            action: String(action.action || '').trim().toLowerCase()
        }))
        .sort((left, right) => {
            const actionCompare = String(left.action).localeCompare(String(right.action), 'fr', { sensitivity: 'base' });
            return actionCompare || String(left.composition_id).localeCompare(String(right.composition_id), 'fr', { sensitivity: 'base' });
        });
}

function getVariantSignature(platId, actions = []) {
    return `${platId}::${JSON.stringify(sortCompositionActions(actions))}`;
}

function buildCompositionEntries(plat, actions = []) {
    const compositionMap = new Map((plat.compositions || []).map((composition) => [composition.id, composition]));
    return sortCompositionActions(actions).map((action) => ({
        composition_id: action.composition_id,
        action: action.action,
        composition_name: compositionMap.get(action.composition_id)?.name || action.composition_id
    }));
}

function buildCartSummary(rawItems = []) {
    const items = rawItems.map((item) => ({
        ...item,
        total_price: Number(item.plat_price || 0) * Number(item.quantity || 0)
    }));

    const subtotal = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return {
        items,
        subtotal,
        tax: 0,
        total_items: totalItems,
        total_price: subtotal
    };
}

function readCart(sessionToken) {
    if (!sessionToken) return buildCartSummary([]);

    const raw = localStorage.getItem(getStorageKey(sessionToken));
    if (!raw) return buildCartSummary([]);

    try {
        const parsed = JSON.parse(raw);
        return buildCartSummary(Array.isArray(parsed.items) ? parsed.items : []);
    } catch (error) {
        console.error('Erreur lecture panier local:', error);
        return buildCartSummary([]);
    }
}

function writeCart(sessionToken, cart) {
    if (!sessionToken) return cart;
    localStorage.setItem(getStorageKey(sessionToken), JSON.stringify({ items: cart.items || [] }));
    return cart;
}

function syncStore(cart) {
    store.set('cart', cart);
    return cart;
}

export function hydrateLocalCart(sessionToken = getSessionToken()) {
    const cart = readCart(sessionToken);
    return syncStore(cart);
}

export function clearLocalCart(sessionToken = getSessionToken()) {
    if (sessionToken) {
        localStorage.removeItem(getStorageKey(sessionToken));
    }
    return syncStore(buildCartSummary([]));
}

export function addMenuItemToLocalCart(plat, lineItems = []) {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
        throw new Error('Session introuvable');
    }

    const currentCart = readCart(sessionToken);
    const nextItems = clone(currentCart.items || []);
    const normalizedLineItems = Array.isArray(lineItems) && lineItems.length
        ? lineItems
        : [{ quantity: 1, composition_actions: [] }];

    normalizedLineItems.forEach((lineItem) => {
        const quantity = Math.max(1, Number(lineItem.quantity || 1));
        const compositions = buildCompositionEntries(plat, lineItem.composition_actions || []);
        const signature = getVariantSignature(plat.id, compositions);
        const existingItem = nextItems.find((item) => item.signature === signature);

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.total_price = existingItem.plat_price * existingItem.quantity;
            return;
        }

        nextItems.push({
            id: signature,
            signature,
            plat_id: plat.id,
            plat_name: plat.name,
            plat_price: Number(plat.price || 0),
            prep_time: Number(plat.prep_time || 0),
            quantity,
            kind: plat.kind || 'plat',
            categorie_id: plat.categorie_id || null,
            categorie_name: plat.categorie_name || null,
            type_categorie_id: plat.type_categorie_id || null,
            type_categorie_name: plat.type_categorie_name || null,
            compositions,
            total_price: Number(plat.price || 0) * quantity
        });
    });

    const nextCart = buildCartSummary(nextItems);
    writeCart(sessionToken, nextCart);
    return syncStore(nextCart);
}

export function updateLocalCartItemQuantity(itemId, quantity) {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
        throw new Error('Session introuvable');
    }

    const currentCart = readCart(sessionToken);
    const nextItems = (currentCart.items || []).map((item) => ({ ...item }));
    const targetIndex = nextItems.findIndex((item) => item.id === itemId);

    if (targetIndex === -1) {
        throw new Error('Article du panier introuvable');
    }

    const safeQuantity = Math.max(1, Number(quantity || 1));
    nextItems[targetIndex].quantity = safeQuantity;
    nextItems[targetIndex].total_price = Number(nextItems[targetIndex].plat_price || 0) * safeQuantity;

    const nextCart = buildCartSummary(nextItems);
    writeCart(sessionToken, nextCart);
    return syncStore(nextCart);
}

export function removeLocalCartItem(itemId) {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
        throw new Error('Session introuvable');
    }

    const currentCart = readCart(sessionToken);
    const nextItems = (currentCart.items || []).filter((item) => item.id !== itemId);
    const nextCart = buildCartSummary(nextItems);
    writeCart(sessionToken, nextCart);
    return syncStore(nextCart);
}

export function getCartOrderPayload() {
    const cart = store.get('cart') || buildCartSummary([]);
    return (cart.items || []).map((item) => ({
        plat_id: item.plat_id,
        quantity: Number(item.quantity || 0),
        composition_actions: (item.compositions || []).map((composition) => ({
            composition_id: composition.composition_id,
            action: composition.action
        }))
    }));
}
