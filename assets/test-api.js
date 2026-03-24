(function attachTestApi() {
    const DEFAULT_API_BASE_URLS = {
        development: 'http://localhost:5000/api',
        production: 'https://resto-custo-backend.onrender.com/api'
    };
    const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');
    const isLocalHostname = (hostname) => (
        hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.startsWith('192.168.')
        || hostname.endsWith('.local')
    );
    const resolveApiBaseUrl = () => {
        const configuredValue = window.API_BASE_URL
            || document.querySelector('meta[name="api-base-url"]')?.content;

        if (configuredValue) {
            return normalizeBaseUrl(configuredValue);
        }

        const env = isLocalHostname(window.location.hostname) ? 'development' : 'production';
        return DEFAULT_API_BASE_URLS[env];
    };
    const API_BASE_URL = resolveApiBaseUrl();
    const WEEK_DAYS = [
        { value: 'monday', label: 'Lundi' },
        { value: 'tuesday', label: 'Mardi' },
        { value: 'wednesday', label: 'Mercredi' },
        { value: 'thursday', label: 'Jeudi' },
        { value: 'friday', label: 'Vendredi' },
        { value: 'saturday', label: 'Samedi' },
        { value: 'sunday', label: 'Dimanche' }
    ];

    const parseJsonSafely = async (response) => {
        try {
            return await response.json();
        } catch (error) {
            return null;
        }
    };

    const request = async (endpoint, options = {}) => {
        const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const headers = {
            ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        };

        const token = localStorage.getItem('authToken');
        if (options.auth !== false && token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: options.method || 'GET',
            headers,
            body: options.body
                ? (isFormDataBody ? options.body : JSON.stringify(options.body))
                : undefined
        });

        const data = await parseJsonSafely(response);

        if (!response.ok) {
            const error = new Error(data?.message || 'Erreur serveur');
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    };

    const getToken = () => localStorage.getItem('authToken') || '';
    const setToken = (token) => {
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    };

    const getUser = () => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch (error) {
            return null;
        }
    };

    const setUser = (user) => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    };

    const formatPrice = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

    const escapeHtml = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const renderHeaderState = () => {
        const tokenNodes = document.querySelectorAll('[data-token-state]');
        const userNodes = document.querySelectorAll('[data-user-state]');
        const token = getToken();
        const user = getUser();

        tokenNodes.forEach((node) => {
            node.textContent = token ? `token present (${token.length} caracteres)` : 'aucun token';
        });

        userNodes.forEach((node) => {
            node.textContent = user ? `${user.name || user.email || user.id} (${user.role || 'role inconnu'})` : 'aucun utilisateur';
        });
    };

    const renderAccessDenied = () => {
        document.body.innerHTML = `
            <div class="min-h-screen bg-[linear-gradient(135deg,_#fff7ed,_#fffbeb_45%,_#ffffff)] px-4 py-10 text-slate-900">
                <div class="mx-auto max-w-2xl rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm">
                    <p class="text-xs font-bold uppercase tracking-[0.25em] text-rose-700">Acces refuse</p>
                    <h1 class="mt-3 text-3xl font-black">Interface reservee au back-office admin</h1>
                    <p class="mt-4 text-sm leading-6 text-slate-600">
                        Cette page n est accessible qu aux utilisateurs avec le role <code>admin</code>.
                    </p>
                    <div class="mt-6 flex flex-wrap gap-3">
                        <a href="./index.html" class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Retour connexion admin</a>
                        <a href="./menu.html" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">Aller au front-office</a>
                    </div>
                </div>
            </div>
        `;
    };

    const ensureAdminAccess = () => {
        const user = getUser();
        if (!user || user.role !== 'admin') {
            renderAccessDenied();
            return false;
        }

        renderHeaderState();
        return true;
    };

    const pushLog = (targetId, message, type = 'info', payload = null) => {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }

        const item = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        const colorClass = type === 'error'
            ? 'text-rose-300'
            : type === 'success'
                ? 'text-emerald-300'
                : 'text-sky-300';

        item.className = `${colorClass} border-b border-white/10 pb-2`;
        item.textContent = `[${timestamp}] ${message}${payload ? ` ${JSON.stringify(payload)}` : ''}`;
        target.prepend(item);
    };

    window.TestApi = {
        API_BASE_URL,
        WEEK_DAYS,
        request,
        getToken,
        setToken,
        getUser,
        setUser,
        renderHeaderState,
        ensureAdminAccess,
        pushLog,
        formatPrice,
        escapeHtml,
        getWeekDayLabel(day) {
            return WEEK_DAYS.find((item) => item.value === day)?.label || day;
        }
    };
})();
