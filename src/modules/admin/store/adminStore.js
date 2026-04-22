class AdminStore {
    constructor() {
        this._state = {
            user: null,
            userData: null,
            isLoading: false,
            notifications: []
        };

        this._listeners = new Map();
    }

    // Souscrit à une clé spécifique et retourne une fonction de désabonnement
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }

        this._listeners.get(key).push(callback);

        return () => {
            const callbacks = this._listeners.get(key) || [];
            const nextCallbacks = callbacks.filter((entry) => entry !== callback);
            this._listeners.set(key, nextCallbacks);
        };
    }

    // Notifie les abonnés d'une clé spécifique en leur passant la nouvelle valeur et l'ancienne valeur
    notify(key, value, previousValue) {
        const callbacks = this._listeners.get(key) || [];
        callbacks.forEach((callback) => {
            try {
                callback(value, previousValue);
            } catch (error) {
                console.error(`Admin store listener error on ${key}:`, error);
            }
        });
    }

    // Récupère la valeur d'une clé spécifique
    get(key) {
        return this._state[key];
    }

    // Met à jour la valeur d'une clé spécifique et notifie les abonnés de ce changement
    set(key, value) {
        const previousValue = this._state[key];
        this._state[key] = value;
        this.notify(key, value, previousValue);
        return value;
    }

    // Met à jour plusieurs clés à la fois et notifie les abonnés de chaque changement
    setMultiple(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    // Réinitialise le store à son état initial et notifie les abonnés de chaque changement
    reset() {
        this.setMultiple({
            user: null,
            userData: null,
            isLoading: false,
            notifications: []
        });
    }
}

export const adminStore = new AdminStore();
