/**
 * Store centralisé - Gestion d'état réactive
 */

class Store {
    constructor() {
        this._state = {
            // Client state
            session: null,
            table: null,
            currentDay: null,
            selectedDay: null,
            consultableDays: [],
            plats: [],
            rawPlats: [],
            cart: null,
            orders: [],
            
            // User state
            user: null,
            userData: null,
            
            // UI state
            currentView: 'menu',
            isLoading: false,
            notifications: [],
            
            // Admin state
            platsList: [],
            compositionsList: [],
            tablesList: [],
            ordersList: []
        };
        
        this._listeners = new Map();
        this._batchUpdates = false;
        this._pendingUpdates = [];
    }

    /**
     * Abonnement aux changements d'une propriété
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }
        this._listeners.get(key).push(callback);
        
        // Retourne une fonction de désabonnement
        return () => {
            const callbacks = this._listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notification des changements
     */
    notify(key, value, oldValue) {
        if (this._listeners.has(key)) {
            this._listeners.get(key).forEach(cb => {
                try {
                    cb(value, oldValue);
                } catch (e) {
                    console.error(`Erreur dans listener de ${key}:`, e);
                }
            });
        }
    }

    /**
     * Récupère une valeur
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Définit une valeur et notifie les listeners
     */
    set(key, value) {
        const oldValue = this._state[key];
        
        if (this._batchUpdates) {
            this._pendingUpdates.push({ key, value, oldValue });
        } else {
            this._state[key] = value;
            this.notify(key, value, oldValue);
        }
        
        return value;
    }

    /**
     * Met à jour plusieurs propriétés en une seule fois
     */
    setMultiple(updates) {
        this._batchUpdates = true;
        
        try {
            for (const [key, value] of Object.entries(updates)) {
                const oldValue = this._state[key];
                this._state[key] = value;
                this._pendingUpdates.push({ key, value, oldValue });
            }
        } finally {
            this._batchUpdates = false;
            this.flushUpdates();
        }
    }

    /**
     * Exécute les mises à jour en attente
     */
    flushUpdates() {
        const updates = [...this._pendingUpdates];
        this._pendingUpdates = [];
        
        updates.forEach(({ key, value, oldValue }) => {
            this.notify(key, value, oldValue);
        });
    }

    /**
     * Réinitialise le store
     */
    reset() {
        const keys = Object.keys(this._state);
        const resetState = {
            session: null,
            table: null,
            currentDay: null,
            selectedDay: null,
            consultableDays: [],
            plats: [],
            rawPlats: [],
            cart: null,
            orders: [],
            user: null,
            userData: null,
            currentView: 'menu',
            isLoading: false,
            notifications: [],
            platsList: [],
            compositionsList: [],
            tablesList: [],
            ordersList: []
        };
        
        for (const key of keys) {
            this.set(key, resetState[key]);
        }
    }

    // ========== Méthodes utilitaires ==========
    
    getCartTotal() {
        if (!this._state.cart) return 0;
        return this._state.cart.total_price || 0;
    }
    
    getCartItemsCount() {
        if (!this._state.cart) return 0;
        return this._state.cart.total_items || 0;
    }
    
    isAdmin() {
        const user = this._state.userData;
        return user && user.role === 'admin';
    }
    
    isAuthenticated() {
        return !!this._state.user;
    }
}

// Instance unique
export const store = new Store();

// Export des constantes
export const CATEGORY_ORDER = ['entree', 'plat', 'boisson'];
export const CATEGORY_LABELS = {
    entree: 'Entrées',
    plat: 'Plats',
    boisson: 'Boissons'
};

export const STATUS_LABELS = {
    pending: { text: 'En attente', color: 'bg-yellow-100 text-yellow-800', progress: 25 },
    preparing: { text: 'En préparation', color: 'bg-blue-100 text-blue-800', progress: 60 },
    ready: { text: 'Prêt', color: 'bg-green-100 text-green-800', progress: 90 },
    served: { text: 'Servi', color: 'bg-gray-100 text-gray-800', progress: 100 },
    cancelled: { text: 'Annulé', color: 'bg-red-100 text-red-800', progress: 0 }
};

export const getStatusInfo = (status) => {
    return STATUS_LABELS[status] || STATUS_LABELS.pending;
};
