/**
 * Utilitaires généraux
 */

import { store } from './store.js';
import { api, formatPrice as formatPriceApi, escapeHtml as escapeHtmlApi } from './api.js';

// Ré-export des helpers
export const formatPrice = formatPriceApi;
export const escapeHtml = escapeHtmlApi;

/**
 * Toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-primary'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.className = `fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-80 ${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in-up`;
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${icons[type] || icons.info}"></i>
            <span class="flex-1 text-sm">${escapeHtml(message)}</span>
            <button class="toast-close text-white/80 hover:text-white">×</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, duration);
    
    // Ajouter à l'état des notifications
    store.set('notifications', [...store.get('notifications'), { message, type, timestamp: Date.now() }]);
}

/**
 * Confirmation dialog
 */
export function confirmDialog(message, title = 'Confirmation') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
        modal.innerHTML = `
            <div class="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-scale-in">
                <div class="p-6">
                    <h3 class="text-lg font-semibold text-gray-900">${escapeHtml(title)}</h3>
                    <p class="mt-2 text-sm text-gray-600">${escapeHtml(message)}</p>
                </div>
                <div class="flex border-t border-gray-100">
                    <button class="confirm-cancel flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                    <button class="confirm-ok flex-1 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-l border-gray-100">Confirmer</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const close = (result) => {
            modal.remove();
            resolve(result);
        };
        
        modal.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
        modal.querySelector('.confirm-ok').addEventListener('click', () => close(true));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close(false);
        });
    });
}

/**
 * Loading spinner
 */
let loadingOverlay = null;

export function showLoading(text = 'Chargement...') {
    if (loadingOverlay) hideLoading();
    
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    loadingOverlay.innerHTML = `
        <div class="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl">
            <div class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p class="text-sm text-gray-600">${escapeHtml(text)}</p>
        </div>
    `;
    
    document.body.appendChild(loadingOverlay);
    store.set('isLoading', true);
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    }
    store.set('isLoading', false);
}

/**
 * Debounce
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format date
 */
export function formatDate(date, locale = 'fr-FR') {
    const d = new Date(date);
    return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Gestion du stockage local avec expiration
 */
export const storage = {
    set(key, value, ttl = null) {
        const item = {
            value,
            expiry: ttl ? Date.now() + ttl : null
        };
        localStorage.setItem(key, JSON.stringify(item));
    },
    
    get(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        try {
            const parsed = JSON.parse(item);
            if (parsed.expiry && Date.now() > parsed.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return parsed.value;
        } catch {
            return null;
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    },
    
    clear() {
        localStorage.clear();
    }
};

/**
 * Normalisation des compositions pour les variantes
 */
export function normalizeVariantCompositions(compositions = []) {
    return [...compositions]
        .map((comp) => ({
            action: comp.action || '',
            label: comp.composition_name || comp.composition_id || ''
        }))
        .sort((a, b) => {
            const actionCompare = String(a.action).localeCompare(String(b.action), 'fr', { sensitivity: 'base' });
            return actionCompare || String(a.label).localeCompare(String(b.label), 'fr', { sensitivity: 'base' });
        });
}

export function getVariantSignature(compositions = []) {
    return JSON.stringify(normalizeVariantCompositions(compositions));
}

export function getVariantLabel(compositions = []) {
    const normalized = normalizeVariantCompositions(compositions);
    if (!normalized.length) return 'Standard';
    return normalized.map(c => `${c.action} ${c.label}`).join(' • ');
}

export function groupItemsByVariant(items = []) {
    return Object.values(
        items.reduce((acc, item) => {
            const signature = getVariantSignature(item.compositions || []);
            
            if (!acc[signature]) {
                acc[signature] = {
                    signature,
                    label: getVariantLabel(item.compositions || []),
                    itemIds: [],
                    quantity: 0,
                    totalPrice: 0,
                    compositions: item.compositions || [],
                    countdownTarget: item.estimated_ready_at || null,
                    countdownActive: item.countdown_active || false,
                    status: item.status || null
                };
            }
            
            acc[signature].itemIds.push(item.id);
            acc[signature].quantity += Number(item.quantity || 0);
            acc[signature].totalPrice += Number(item.total_price || 0);
            return acc;
        }, {})
    );
}

/**
 * Animation CSS
 */
export const animations = `
    @keyframes fade-in-up {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes scale-in {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .animate-fade-in-up {
        animation: fade-in-up 0.3s ease-out;
    }
    
    .animate-scale-in {
        animation: scale-in 0.2s ease-out;
    }
    
    .animate-spin {
        animation: spin 1s linear infinite;
    }
`;

// Injecter les animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = animations;
    document.head.appendChild(style);
}