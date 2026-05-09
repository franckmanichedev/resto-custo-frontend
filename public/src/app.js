import {
    SHELL_APP_ROUTES,
    SHELL_ENTRY_PATHS,
    SHELL_LOGIN_PATHS,
    SHELL_SCOPES,
    buildShellUrl
} from './shell/index.js';

export const APP_SCOPES = SHELL_SCOPES;

export const APP_PATHS = {
    platform: SHELL_ENTRY_PATHS[SHELL_SCOPES.PLATFORM],
    restaurant: SHELL_ENTRY_PATHS[SHELL_SCOPES.RESTAURANT],
    client: SHELL_ENTRY_PATHS[SHELL_SCOPES.CLIENT],
    platformLogin: SHELL_LOGIN_PATHS[SHELL_SCOPES.PLATFORM],
    restaurantLogin: SHELL_LOGIN_PATHS[SHELL_SCOPES.RESTAURANT],
    clientLogin: SHELL_LOGIN_PATHS[SHELL_SCOPES.CLIENT]
};

export const APP_ROUTES = SHELL_APP_ROUTES;

export const APP_CONFIG = {
    brandName: 'Resto QRCode',
    restaurantName: 'Le Bistrot Parisien',
    adminLoginPath: APP_PATHS.restaurantLogin,
    platformLoginPath: APP_PATHS.platformLogin,
    restaurantLoginPath: APP_PATHS.restaurantLogin,
    clientAppPath: APP_PATHS.client
};

export const CLIENT_VIEW_ALIASES = {
    track: 'tracking'
};

export const CLIENT_VIEWS = ['menu', 'cart', 'tracking', 'profile'];

const normalizeClientView = (view) => {
    const value = String(view || '').trim().toLowerCase();
    return CLIENT_VIEW_ALIASES[value] || value;
};

export const getAppPathForScope = (scope, target = 'entry') => buildShellUrl(scope, target);

export function getClientViewFromSearch(search = window.location.search) {
    const params = new URLSearchParams(search);
    const requestedView = normalizeClientView(params.get('view'));

    return CLIENT_VIEWS.includes(requestedView) ? requestedView : 'menu';
}

export function updateClientViewInUrl(view, search = window.location.search) {
    const params = new URLSearchParams(search);
    const normalizedView = normalizeClientView(view);

    if (normalizedView && normalizedView !== 'menu') {
        params.set('view', normalizedView);
    } else {
        params.delete('view');
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
}

export function buildClientIndexUrl(view = 'menu', search = window.location.search) {
    const params = new URLSearchParams(search);
    const normalizedView = normalizeClientView(view);

    if (normalizedView && normalizedView !== 'menu') {
        params.set('view', normalizedView);
    } else {
        params.delete('view');
    }

    const query = params.toString();
    return `${APP_PATHS.client}${query ? `?${query}` : ''}`;
}
