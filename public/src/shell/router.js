import {
    DEFAULT_GUARD_REDIRECTS,
    getRouteScope,
    isRouteScopeMatch
} from './guards/authGuard.js';

export const SHELL_SCOPES = {
    PLATFORM: 'platform',
    RESTAURANT: 'restaurant',
    CLIENT: 'client'
};

export const SHELL_LAYOUTS = {
    [SHELL_SCOPES.PLATFORM]: 'platform-layout',
    [SHELL_SCOPES.RESTAURANT]: 'restaurant-layout',
    [SHELL_SCOPES.CLIENT]: 'client-layout'
};

export const SHELL_ROOT_PATHS = {
    [SHELL_SCOPES.PLATFORM]: '/platform',
    [SHELL_SCOPES.RESTAURANT]: '/restaurant',
    [SHELL_SCOPES.CLIENT]: '/client'
};

export const SHELL_ENTRY_PATHS = {
    [SHELL_SCOPES.PLATFORM]: '/platform/index.html',
    [SHELL_SCOPES.RESTAURANT]: '/restaurant/index.html',
    [SHELL_SCOPES.CLIENT]: '/client/index.html'
};

export const SHELL_LOGIN_PATHS = {
    [SHELL_SCOPES.PLATFORM]: '/platform/login.html',
    [SHELL_SCOPES.RESTAURANT]: '/restaurant/login.html',
    [SHELL_SCOPES.CLIENT]: '/client/index.html'
};

export const SHELL_DEFAULT_PATHS = {
    [SHELL_SCOPES.PLATFORM]: '/platform/dashboard.html',
    [SHELL_SCOPES.RESTAURANT]: '/restaurant/dashboard.html',
    [SHELL_SCOPES.CLIENT]: '/client/index.html'
};

export const SHELL_REDIRECTS = {
    ...DEFAULT_GUARD_REDIRECTS,
    [SHELL_SCOPES.PLATFORM]: SHELL_ENTRY_PATHS[SHELL_SCOPES.PLATFORM],
    [SHELL_SCOPES.RESTAURANT]: SHELL_ENTRY_PATHS[SHELL_SCOPES.RESTAURANT],
    [SHELL_SCOPES.CLIENT]: SHELL_ENTRY_PATHS[SHELL_SCOPES.CLIENT]
};

const normalizePathname = (pathname = '') => {
    const value = String(pathname || '').trim().toLowerCase();

    if (!value) {
        return '/';
    }

    return value.startsWith('/') ? value : `/${value}`;
};

const stripTrailingSlash = (value = '') => {
    const normalized = String(value || '').trim();
    return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized;
};

export const getShellScopeFromPath = (pathname = window.location.pathname) => getRouteScope(pathname);

export const isShellScopePath = (scope, pathname = window.location.pathname) => isRouteScopeMatch(scope, pathname);

export const getShellLayoutForScope = (scope) => SHELL_LAYOUTS[scope] || null;

export const getShellEntryPath = (scope) => SHELL_ENTRY_PATHS[scope] || null;

export const getShellLoginPath = (scope) => SHELL_LOGIN_PATHS[scope] || null;

export const getShellDefaultPath = (scope) => SHELL_DEFAULT_PATHS[scope] || null;

export const getShellRedirectForScope = (scope) => SHELL_REDIRECTS[scope] || DEFAULT_GUARD_REDIRECTS.unauthorized;

export const buildShellUrl = (scope, target = 'default') => {
    const normalizedScope = String(scope || '').trim().toLowerCase();
    if (!normalizedScope || !SHELL_ROOT_PATHS[normalizedScope]) {
        return null;
    }

    if (target === 'login') {
        return SHELL_LOGIN_PATHS[normalizedScope];
    }

    if (target === 'entry') {
        return SHELL_ENTRY_PATHS[normalizedScope];
    }

    if (target === 'default') {
        return SHELL_DEFAULT_PATHS[normalizedScope];
    }

    const normalizedTarget = stripTrailingSlash(normalizePathname(target));
    const root = SHELL_ROOT_PATHS[normalizedScope];
    const safeTarget = normalizedTarget.startsWith(root) ? normalizedTarget : `${root}/${normalizedTarget.replace(/^\//, '')}`;

    return safeTarget;
};

export const getShellRouteMeta = (pathname = window.location.pathname) => {
    const scope = getShellScopeFromPath(pathname);
    if (!scope) {
        return {
            scope: null,
            layout: null,
            rootPath: null,
            entryPath: null,
            defaultPath: null,
            loginPath: null,
            isShellPath: false
        };
    }

    return {
        scope,
        layout: getShellLayoutForScope(scope),
        rootPath: SHELL_ROOT_PATHS[scope],
        entryPath: getShellEntryPath(scope),
        defaultPath: getShellDefaultPath(scope),
        loginPath: getShellLoginPath(scope),
        isShellPath: true
    };
};

export const isInsideShell = (pathname = window.location.pathname) => Boolean(getShellScopeFromPath(pathname));

export const getShellScopeFromPathname = getShellScopeFromPath;
export const getShellRootPath = (scope) => SHELL_ROOT_PATHS[scope] || null;
export const SHELL_APP_ROUTES = {
    scopes: SHELL_SCOPES,
    layouts: SHELL_LAYOUTS,
    roots: SHELL_ROOT_PATHS,
    entries: SHELL_ENTRY_PATHS,
    defaults: SHELL_DEFAULT_PATHS,
    logins: SHELL_LOGIN_PATHS
};
