const DEFAULT_API_BASE_URLS = {
    development: 'http://localhost:5000/api',
    production: 'https://resto-custo-backend.onrender.com/api'
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');
const LOCALHOST_HOSTNAMES = new Set(['', 'localhost', '127.0.0.1', '0.0.0.0']);

const isLocalHostname = (hostname) => (
    LOCALHOST_HOSTNAMES.has(hostname)
    || hostname.startsWith('192.168.')
    || hostname.endsWith('.local')
);

const readImportMetaApiBaseUrl = () => {
    try {
        return import.meta?.env?.API_BASE_URL || '';
    } catch (error) {
        return '';
    }
};

const buildLocalApiBaseUrl = (location = window.location) => {
    const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = location.hostname;

    if (LOCALHOST_HOSTNAMES.has(hostname)) {
        return DEFAULT_API_BASE_URLS.development;
    }

    return `${protocol}//${hostname}:5000/api`;
};

const resolveApiBaseUrl = () => {
    const hostname = window.location.hostname;
    const configuredValue = document.querySelector('meta[name="api-base-url"]')?.content
        || readImportMetaApiBaseUrl();

    if (window.API_BASE_URL) {
        return normalizeBaseUrl(window.API_BASE_URL);
    }

    if (isLocalHostname(hostname)) {
        return buildLocalApiBaseUrl(window.location);
    }

    if (configuredValue) {
        return normalizeBaseUrl(configuredValue);
    }

    return DEFAULT_API_BASE_URLS.production;
};

const API_BASE_URL = resolveApiBaseUrl();

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('authToken') || '';
        this.tokenListeners = [];
    }

    setToken(token) {
        const nextToken = String(token || '');

        if (this.token === nextToken) {
            return;
        }

        this.token = nextToken;

        if (nextToken) {
            localStorage.setItem('authToken', nextToken);
        } else {
            localStorage.removeItem('authToken');
        }

        [...this.tokenListeners].forEach((callback) => callback(this.token));
    }

    getToken() {
        return this.token;
    }

    onTokenChange(callback) {
        this.tokenListeners.push(callback);
        return () => {
            this.tokenListeners = this.tokenListeners.filter((entry) => entry !== callback);
        };
    }

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

        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (error) {
                data = null;
            }
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                if (this.token) {
                    this.setToken('');
                } else {
                    localStorage.removeItem('authToken');
                }
                localStorage.removeItem('user');

                if (window.location.pathname.includes('/admin/') && !window.location.pathname.endsWith('/admin/index.html')) {
                    window.location.href = '/admin/index.html';
                }
            }

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

    getWithQuery(endpoint, params = {}, options = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.append(key, value);
            }
        });

        const queryString = query.toString();
        return this.get(`${endpoint}${queryString ? `?${queryString}` : ''}`, options);
    }

    auth = {
        login: (email, password) => this.post('/auth/login', { email, password }),
        signup: (data) => this.post('/auth/signup', data),
        me: () => this.get('/auth/me'),
        logout: () => {
            this.setToken('');
            localStorage.removeItem('user');
        }
    };

    plats = {
        getAll: (params = {}) => this.getWithQuery('/plats', params),
        getById: (id) => this.get(`/plats/${id}`),
        create: (data) => this.post('/plats', data),
        update: (id, data) => this.put(`/plats/${id}`, data),
        delete: (id) => this.delete(`/plats/${id}`),
        toggleAvailability: (id) => this.patch(`/plats/${id}/toggle`, {})
    };

    compositions = {
        getAll: (params = {}) => this.getWithQuery('/compositions', params),
        create: (data) => this.post('/compositions', data),
        delete: (id) => this.delete(`/compositions/${id}`)
    };

    categories = {
        getAll: (params = {}) => this.getWithQuery('/categories', params),
        getById: (id) => this.get(`/categories/${id}`),
        create: (data) => this.post('/categories', data),
        update: (id, data) => this.put(`/categories/${id}`, data),
        delete: (id) => this.delete(`/categories/${id}`),
        getTypes: (categoryId) => this.get(`/categories/${categoryId}/types`),
        getAllTypes: (params = {}) => this.getWithQuery('/categories/types/all', params),
        createType: (data) => this.post('/categories/types/all', data),
        updateType: (id, data) => this.put(`/categories/types/all/${id}`, data),
        deleteType: (id) => this.delete(`/categories/types/all/${id}`)
    };

    tables = {
        getAll: (params = {}) => this.getWithQuery('/tables', params),
        getById: (id) => this.get(`/tables/${id}`),
        create: (data) => this.post('/tables', data),
        update: (id, data) => this.put(`/tables/${id}`, data),
        delete: (id) => this.delete(`/tables/${id}`)
    };

    orders = {
        getAll: (params = {}) => this.getWithQuery('/orders', params),
        getById: (id) => this.get(`/orders/${id}`),
        updateStatus: (id, status) => this.put(`/orders/${id}/status`, { status })
    };

    session = {
        start: (payload) => this.post('/front-office/session/start', payload, { auth: false }),
        getMenu: (token, day) => this.get(`/front-office/menu/${token}?day=${encodeURIComponent(day)}`, { auth: false }),
        getCart: (token) => this.get(`/front-office/cart/${token}`, { auth: false }),
        addToCart: (token, platId, quantity, lineItems) => this.post('/front-office/cart/items', {
            session_token: token,
            plat_id: platId,
            quantity,
            line_items: lineItems
        }, { auth: false }),
        removeFromCart: (token, itemId) => this.delete(`/front-office/cart/items/${itemId}?session_token=${encodeURIComponent(token)}`, { auth: false }),
        updateCartItem: (token, itemId, quantity) => this.put(`/front-office/cart/items/${itemId}`, {
            session_token: token,
            quantity
        }, { auth: false }),
        checkout: (token, customer, note) => this.post('/front-office/cart/checkout', {
            session_token: token,
            customer,
            note
        }, { auth: false }),
        createOrder: (payload) => this.post('/front-office/orders', payload, { auth: false }),
        listOrders: (token) => this.get(`/front-office/orders?session_token=${encodeURIComponent(token)}`, { auth: false }),
        getOrderStatus: (token, orderId) => this.get(`/front-office/orders/${orderId}?session_token=${encodeURIComponent(token)}`, { auth: false })
    };
}

export const api = new ApiClient();

export const formatPrice = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XAF`;

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
    const found = WEEK_DAYS.find((entry) => entry.value === day);
    return found ? found.label : day;
};

export const getCurrentDay = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
};

export const formatDuration = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
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
