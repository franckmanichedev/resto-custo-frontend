export const formatPrice = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XAF`;

export const buildRestaurantTenantId = (restaurantName, prefix = 'tenant') => {
    const normalizedName = String(restaurantName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36);

    const entropy = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(-8);

    return normalizedName
        ? `${prefix}-${normalizedName}-${entropy}`
        : `${prefix}-${entropy}`;
};

export const escapeHtml = (value) => {
    if (!value && value !== 0) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

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
            <button class="toast-close text-white/80 hover:text-white">x</button>
        </div>
    `;

    document.body.appendChild(toast);

    toast.querySelector('.toast-close')?.addEventListener('click', () => {
        toast.remove();
    });

    window.setTimeout(() => {
        toast.remove();
    }, duration);
}

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

        modal.querySelector('.confirm-cancel')?.addEventListener('click', () => close(false));
        modal.querySelector('.confirm-ok')?.addEventListener('click', () => close(true));
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close(false);
        });
    });
}

let loadingOverlay = null;

export function showLoading(text = 'Chargement...') {
    hideLoading();

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    loadingOverlay.innerHTML = `
        <div class="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl">
            <div class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p class="text-sm text-gray-600">${escapeHtml(text)}</p>
        </div>
    `;

    document.body.appendChild(loadingOverlay);
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
    }
}

export function debounce(callback, wait) {
    let timeoutId;

    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => callback(...args), wait);
    };
}

export function throttle(callback, limit) {
    let inThrottle = false;

    return (...args) => {
        if (inThrottle) return;

        callback(...args);
        inThrottle = true;

        window.setTimeout(() => {
            inThrottle = false;
        }, limit);
    };
}

export function formatDate(value, locale = 'fr-FR') {
    return new Date(value).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export const storage = {
    set(key, value, ttl = null) {
        const payload = {
            value,
            expiry: ttl ? Date.now() + ttl : null
        };

        localStorage.setItem(key, JSON.stringify(payload));
    },

    get(key) {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) return null;

        try {
            const parsed = JSON.parse(rawValue);

            if (parsed.expiry && Date.now() > parsed.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            return parsed.value;
        } catch (error) {
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

export function normalizeVariantCompositions(compositions = []) {
    return [...compositions]
        .map((composition) => ({
            action: composition.action || '',
            label: composition.composition_name || composition.composition_id || ''
        }))
        .sort((left, right) => {
            const actionCompare = String(left.action).localeCompare(String(right.action), 'fr', { sensitivity: 'base' });
            return actionCompare || String(left.label).localeCompare(String(right.label), 'fr', { sensitivity: 'base' });
        });
}

export function getVariantSignature(compositions = []) {
    return JSON.stringify(normalizeVariantCompositions(compositions));
}

export function getVariantLabel(compositions = []) {
    const normalized = normalizeVariantCompositions(compositions);
    if (!normalized.length) return 'Standard';
    return normalized.map((composition) => `${composition.action} ${composition.label}`).join(' • ');
}

export function groupItemsByVariant(items = []) {
    return Object.values(
        items.reduce((accumulator, item) => {
            const signature = getVariantSignature(item.compositions || []);

            if (!accumulator[signature]) {
                accumulator[signature] = {
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

            accumulator[signature].itemIds.push(item.id);
            accumulator[signature].quantity += Number(item.quantity || 0);
            accumulator[signature].totalPrice += Number(item.total_price || 0);
            return accumulator;
        }, {})
    );
}

const animations = `
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

if (typeof document !== 'undefined' && !document.querySelector('[data-app-animations]')) {
    const style = document.createElement('style');
    style.dataset.appAnimations = 'true';
    style.textContent = animations;
    document.head.appendChild(style);
}
