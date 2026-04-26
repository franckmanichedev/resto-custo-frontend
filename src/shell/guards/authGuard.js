const STORAGE_KEYS = {
    token: 'authToken',
    user: 'user'
};

const ROLE_SCOPE_MAP = {
    platform_owner: 'platform',
    platform_admin: 'platform',
    platform_support: 'platform',

    admin: 'restaurant',
    menu_manager: 'restaurant',
    kitchen_staff: 'restaurant',

    customer: 'client'
};

const ROLE_ALIASES = {
    restaurant_admin: 'admin',
    restaurant_manager: 'menu_manager',
    restaurant_staff: 'kitchen_staff',
    restaurant_customer: 'customer',

    tenant_admin: 'admin',
    tenant_manager: 'menu_manager',
    tenant_staff: 'kitchen_staff',
    tenant_customer: 'customer'
};

const DEFAULT_REDIRECTS = {
    platform: '/platform/login.html',
    restaurant: '/restaurant/login.html',
    client: '/client/index.html',
    unauthorized: '/platform/403.html'
};

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeRead = (key) => {
    if (!hasWindow()) return null;

    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        return null;
    }
};

const safeRemove = (key) => {
    if (!hasWindow()) return;

    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        // noop
    }
};

const readJson = (key, fallback = null) => {
    const raw = safeRead(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
};

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

export const normalizeRole = (role) => {
    const normalized = normalizeValue(role);
    if (!normalized) return null;

    if (Object.prototype.hasOwnProperty.call(ROLE_SCOPE_MAP, normalized)) {
        return normalized;
    }

    return ROLE_ALIASES[normalized] || null;
};

export const getRoleScope = (role) => {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return null;

    return ROLE_SCOPE_MAP[normalizedRole] || null;
};

export const getUserFromStorage = () => readJson(STORAGE_KEYS.user, null);

export const getTokenFromStorage = () => safeRead(STORAGE_KEYS.token) || '';

export const isAuthenticated = () => Boolean(getTokenFromStorage() && getUserFromStorage());

export const getCurrentUserRole = () => {
    const user = getUserFromStorage();
    return normalizeRole(user?.role);
};

export const getCurrentUserScope = () => {
    const role = getCurrentUserRole();
    return role ? getRoleScope(role) : null;
};

export const isPlatformScope = (value) => getRoleScope(value) === 'platform';
export const isRestaurantScope = (value) => getRoleScope(value) === 'restaurant';
export const isClientScope = (value) => getRoleScope(value) === 'client';

export const clearAuthSession = () => {
    safeRemove(STORAGE_KEYS.token);
    safeRemove(STORAGE_KEYS.user);
};

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
};

const matchesAllowedRoles = (allowedRoles = [], userRole = null) => {
    if (!allowedRoles.length) return true;

    const normalizedUserRole = normalizeRole(userRole);
    if (!normalizedUserRole) return false;

    return allowedRoles
        .map((role) => normalizeRole(role))
        .filter(Boolean)
        .includes(normalizedUserRole);
};

const matchesAllowedScopes = (allowedScopes = [], userScope = null) => {
    if (!allowedScopes.length) return true;

    const normalizedScope = normalizeValue(userScope);
    if (!normalizedScope) return false;

    return allowedScopes
        .map((scope) => normalizeValue(scope))
        .filter(Boolean)
        .includes(normalizedScope);
};

const resolveRedirectUrl = (redirectTo) => {
    if (typeof redirectTo === 'function') {
        return redirectTo();
    }

    return redirectTo || DEFAULT_REDIRECTS.unauthorized;
};

const redirect = (redirectTo) => {
    if (!hasWindow()) return;

    window.location.href = resolveRedirectUrl(redirectTo);
};

const enforceGuard = ({
    allowedRoles = [],
    allowedScopes = [],
    redirectTo = DEFAULT_REDIRECTS.unauthorized,
    clearSession = false
} = {}) => {
    const user = getUserFromStorage();
    const token = getTokenFromStorage();
    const userRole = user?.role || null;
    const userScope = getRoleScope(userRole);

    const isValid = Boolean(token && user) &&
        matchesAllowedRoles(toArray(allowedRoles), userRole) &&
        matchesAllowedScopes(toArray(allowedScopes), userScope);

    if (isValid) {
        return {
            allowed: true,
            user,
            role: normalizeRole(userRole),
            scope: userScope
        };
    }

    if (clearSession) {
        clearAuthSession();
    }

    redirect(redirectTo);

    return {
        allowed: false,
        user: null,
        role: null,
        scope: null
    };
};

export const requireAuth = (options = {}) => enforceGuard(options);

export const requireRole = (allowedRoles, options = {}) => enforceGuard({
    ...options,
    allowedRoles
});

export const requireScope = (allowedScopes, options = {}) => enforceGuard({
    ...options,
    allowedScopes
});

export const getRouteScope = (pathname = hasWindow() ? window.location.pathname : '') => {
    const normalizedPath = String(pathname || '').toLowerCase();

    if (normalizedPath.startsWith('/platform/')) return 'platform';
    if (normalizedPath.startsWith('/restaurant/')) return 'restaurant';
    if (normalizedPath.startsWith('/client/')) return 'client';

    return null;
};

export const isRouteScopeMatch = (scope, pathname = hasWindow() ? window.location.pathname : '') => {
    const normalizedScope = normalizeValue(scope);
    if (!normalizedScope) return false;

    return getRouteScope(pathname) === normalizedScope;
};

export const DEFAULT_GUARD_REDIRECTS = DEFAULT_REDIRECTS;
export const AUTH_STORAGE_KEYS = STORAGE_KEYS;
export const ROLE_SCOPE_LOOKUP = ROLE_SCOPE_MAP;
