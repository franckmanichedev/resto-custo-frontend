import {
    clearAuthSession,
    getCurrentUserScope,
    getRouteScope,
    isRouteScopeMatch,
    normalizeRole,
    requireScope as requireScopeGuard
} from './authGuard.js';

export const requireScope = (allowedScopes, options = {}) => requireScopeGuard(allowedScopes, options);

export const getActiveScope = () => getCurrentUserScope();

export const getCurrentRouteScope = (pathname = window.location.pathname) => getRouteScope(pathname);

export const isScopeAllowed = (allowedScopes = [], scope = getCurrentUserScope()) => {
    const normalizedScope = String(scope || '').trim().toLowerCase();

    if (!Array.isArray(allowedScopes) || allowedScopes.length === 0) {
        return Boolean(normalizedScope);
    }

    return allowedScopes
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
        .includes(normalizedScope);
};

export const isCurrentRouteAllowedForScope = (allowedScopes = [], pathname = window.location.pathname) => {
    const routeScope = getRouteScope(pathname);
    return isScopeAllowed(allowedScopes, routeScope);
};

export const ensureScopeMatch = ({
    allowedScopes = [],
    pathname = window.location.pathname,
    clearSession = false,
    redirectTo = '/platform/403.html'
} = {}) => {
    const routeScope = getRouteScope(pathname);
    const userScope = getCurrentUserScope();

    const allowed = isScopeAllowed(allowedScopes, userScope) && (
        !routeScope || routeScope === userScope || allowedScopes.map((entry) => String(entry || '').trim().toLowerCase()).includes(routeScope)
    );

    if (allowed) {
        return {
            allowed: true,
            scope: userScope,
            routeScope
        };
    }

    if (clearSession) {
        clearAuthSession();
    }

    if (typeof window !== 'undefined' && redirectTo) {
        window.location.href = redirectTo;
    }

    return {
        allowed: false,
        scope: null,
        routeScope
    };
};

export const isRouteScopeMatchAllowed = (scope, pathname = window.location.pathname) => isRouteScopeMatch(scope, pathname);

export { normalizeRole };

export default requireScope;
