class ClientStore {
    constructor() {
        this._state = {
            session: null,
            table: null,
            currentDay: null,
            selectedDay: null,
            consultableDays: [],
            plats: [],
            rawPlats: [],
            cart: null,
            orders: [],
            customerInfo: null,
            currentView: 'menu',
            isLoading: false,
            notifications: []
        };

        this._listeners = new Map();
        this._batchMode = false;
        this._pendingUpdates = [];
    }

    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }

        this._listeners.get(key).push(callback);

        return () => {
            const callbacks = this._listeners.get(key) || [];
            this._listeners.set(key, callbacks.filter((entry) => entry !== callback));
        };
    }

    notify(key, value, previousValue) {
        const callbacks = this._listeners.get(key) || [];
        callbacks.forEach((callback) => {
            try {
                callback(value, previousValue);
            } catch (error) {
                console.error(`Client store listener error on ${key}:`, error);
            }
        });
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        const previousValue = this._state[key];

        if (this._batchMode) {
            this._state[key] = value;
            this._pendingUpdates.push({ key, value, previousValue });
            return value;
        }

        this._state[key] = value;
        this.notify(key, value, previousValue);
        return value;
    }

    setMultiple(updates) {
        this._batchMode = true;

        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });

        this._batchMode = false;
        this.flushUpdates();
    }

    flushUpdates() {
        const updates = [...this._pendingUpdates];
        this._pendingUpdates = [];

        updates.forEach(({ key, value, previousValue }) => {
            this.notify(key, value, previousValue);
        });
    }

    reset() {
        this.setMultiple({
            session: null,
            table: null,
            currentDay: null,
            selectedDay: null,
            consultableDays: [],
            plats: [],
            rawPlats: [],
            cart: null,
            orders: [],
            customerInfo: null,
            currentView: 'menu',
            isLoading: false,
            notifications: []
        });
    }

    getCartTotal() {
        return this._state.cart?.total_price || 0;
    }

    getCartItemsCount() {
        return this._state.cart?.total_items || 0;
    }
}

export const store = new ClientStore();

export const STATUS_LABELS = {
    pending: { text: 'En attente', color: 'bg-yellow-100 text-yellow-800', progress: 25 },
    preparing: { text: 'En préparation', color: 'bg-blue-100 text-blue-800', progress: 60 },
    ready: { text: 'Prêt', color: 'bg-green-100 text-green-800', progress: 90 },
    served: { text: 'Servi', color: 'bg-gray-100 text-gray-800', progress: 100 },
    cancelled: { text: 'Annulé', color: 'bg-red-100 text-red-800', progress: 0 }
};

export const getStatusInfo = (status) => STATUS_LABELS[status] || STATUS_LABELS.pending;
