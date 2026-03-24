/**
 * API Client - Service de communication avec le backend
 * Inspiré et amélioré à partir de test-api.js
 */

const DEFAULT_API_BASE_URLS = {
    development: 'http://localhost:5000/api',
    production: 'https://resto-custo-backend.onrender.com/api'
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const resolveApiBaseUrl = () => {
    // 1. Vérifier si une variable d'environnement est définie
    const configuredValue = window.API_BASE_URL
        || document.querySelector('meta[name="api-base-url"]')?.content
        || import.meta.env.API_BASE_URL;

    if (configuredValue) {
        console.log('API URL from config:', configuredValue);
        return normalizeBaseUrl(configuredValue);
    }

    // 2. Détecter l'environnement
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' 
        || hostname === '127.0.0.1' 
        || hostname === '192.168.0.106'
        || hostname.startsWith('192.168.')
        || hostname.endsWith('.local');

    const env = isLocal ? 'development' : 'production';
    const url = DEFAULT_API_BASE_URLS[env];
    console.log(`API URL resolved (${env}):`, url);
    
    return url;
};

const API_BASE_URL = resolveApiBaseUrl();
console.log('Final API_BASE_URL:', API_BASE_URL);

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('authToken') || '';
        this.refreshCallbacks = [];
    }

    /**
     * Gestion du token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
        this.notifyTokenChange();
    }

    getToken() {
        return this.token;
    }

    onTokenChange(callback) {
        this.refreshCallbacks.push(callback);
        return () => {
            const index = this.refreshCallbacks.indexOf(callback);
            if (index !== -1) this.refreshCallbacks.splice(index, 1);
        };
    }

    notifyTokenChange() {
        this.refreshCallbacks.forEach(cb => cb(this.token));
    }

    /**
     * Requête HTTP générique
     */
    async request(endpoint, options = {}) {
        const isFormData = options.body instanceof FormData;
        const headers = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        };

        if (options.auth !== false && this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

        const response = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body
                ? (isFormData ? options.body : JSON.stringify(options.body))
                : undefined
        });

        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (e) {
                // Ignorer les erreurs de parsing
            }
        }

        if (!response.ok) {
            const error = new Error(data?.message || `Erreur ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    }

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }

    put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    patch(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // ========== AUTHENTIFICATION ==========
    auth = {
        login: (email, password) => this.post('/auth/login', { email, password }),
        signup: (data) => this.post('/auth/signup', data),
        me: () => this.get('/auth/me'),
        logout: () => {
            this.setToken('');
            localStorage.removeItem('user');
        }
    };

    // ========== PLATS ==========
    plats = {
        getAll: (params = {}) => {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.append(key, value);
                }
            });
            const queryString = query.toString();
            return this.get(`/plats${queryString ? `?${queryString}` : ''}`);
        },
        getById: (id) => this.get(`/plats/${id}`),
        create: (data) => {
            if (data instanceof FormData) {
                return this.post('/plats', data);
            }
            return this.post('/plats', data);
        },
        update: (id, data) => {
            if (data instanceof FormData) {
                return this.request(`/plats/${id}`, { method: 'PUT', body: data });
            }
            return this.put(`/plats/${id}`, data);
        },
        delete: (id) => this.delete(`/plats/${id}`),
        toggleAvailability: (id) => this.patch(`/plats/${id}/toggle`, {})
    };

    // ========== COMPOSITIONS ==========
    compositions = {
        getAll: (params = {}) => {
            const query = new URLSearchParams();
            if (params.search) query.append('search', params.search);
            const queryString = query.toString();
            return this.get(`/compositions${queryString ? `?${queryString}` : ''}`);
        },
        create: (data) => this.post('/compositions', data),
        delete: (id) => this.delete(`/compositions/${id}`)
    };

    // ========== TABLES ==========
    tables = {
        getAll: () => this.get('/tables'),
        getById: (id) => this.get(`/tables/${id}`),
        create: (data) => this.post('/tables', data),
        update: (id, data) => this.put(`/tables/${id}`, data),
        delete: (id) => this.delete(`/tables/${id}`)
    };

    // ========== COMMANDES ==========
    orders = {
        getAll: (params = {}) => {
            const query = new URLSearchParams();
            if (params.status) query.append('status', params.status);
            const queryString = query.toString();
            return this.get(`/orders${queryString ? `?${queryString}` : ''}`);
        },
        getById: (id) => this.get(`/orders/${id}`),
        updateStatus: (id, status) => this.put(`/orders/${id}/status`, { status })
    };

    // ========== FRONT-OFFICE (Client) ==========
    session = {
        start: (payload) => this.post('/front-office/session/start', payload, { auth: false }),
        getMenu: (token, day) => this.get(`/front-office/menu/${token}?day=${encodeURIComponent(day)}`, { auth: false }),
        getCart: (token) => this.get(`/front-office/cart/${token}`, { auth: false }),
        addToCart: (token, platId, quantity, lineItems) => 
            this.post('/front-office/cart/items', {
                session_token: token,
                plat_id: platId,
                quantity,
                line_items: lineItems
            }, { auth: false }),
        removeFromCart: (token, itemId) => 
            this.delete(`/front-office/cart/items/${itemId}?session_token=${encodeURIComponent(token)}`, { auth: false }),
        updateCartItem: (token, itemId, quantity) => 
            this.put(`/front-office/cart/items/${itemId}`, {
                session_token: token,
                quantity
            }, { auth: false }),
        checkout: (token, customer, note) => 
            this.post('/front-office/cart/checkout', {
                session_token: token,
                customer,
                note
            }, { auth: false })
    };
}

// Export d'une instance unique
export const api = new ApiClient();

// Export des helpers
export const formatPrice = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

export const WEEK_DAYS = [
    { value: 'monday', label: 'Lundi' },
    { value: 'tuesday', label: 'Mardi' },
    { value: 'wednesday', label: 'Mercredi' },
    { value: 'thursday', label: 'Jeudi' },
    { value: 'friday', label: 'Vendredi' },
    { value: 'saturday', label: 'Samedi' },
    { value: 'sunday', label: 'Dimanche' }
];

export const getWeekDayLabel = (day) => {
    const found = WEEK_DAYS.find(d => d.value === day);
    return found ? found.label : day;
};

export const getCurrentDay = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
};

export const formatDuration = (seconds) => {
    const safe = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const remaining = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
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