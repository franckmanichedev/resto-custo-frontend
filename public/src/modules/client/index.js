import { CLIENT_LAYOUT } from '../../shell/layouts/client-layout.js';
import {
    SHELL_ENTRY_PATHS,
    SHELL_LOGIN_PATHS,
    SHELL_SCOPES
} from '../../shell/router.js';
import {
    CLIENT_BROWSING_ROUTES,
    CLIENT_CART_ROUTES,
    CLIENT_FEATURES,
    CLIENT_RECOVERY_ROUTES,
    CLIENT_ROUTE_MAP,
    CLIENT_SESSION_CONFIG,
    CLIENT_SESSION_ROUTES,
    CLIENT_TRACKING_ROUTES
} from './manifest.js';

export const CLIENT_MODULE = {
    scope: SHELL_SCOPES.CLIENT,
    label: 'Client',
    layout: CLIENT_LAYOUT.name,
    rootPath: '/client',
    entryPath: SHELL_ENTRY_PATHS[SHELL_SCOPES.CLIENT],
    loginPath: SHELL_LOGIN_PATHS[SHELL_SCOPES.CLIENT],
    roles: [...CLIENT_LAYOUT.allowedRoles],
    scopes: [...CLIENT_LAYOUT.allowedScopes],
    routes: {
        home: CLIENT_BROWSING_ROUTES.home,
        menu: CLIENT_BROWSING_ROUTES.menu,
        cart: CLIENT_CART_ROUTES.cart,
        categories: CLIENT_BROWSING_ROUTES.categories,
        search: CLIENT_BROWSING_ROUTES.search,
        tracking: CLIENT_TRACKING_ROUTES.tracking,
        detail: CLIENT_BROWSING_ROUTES.detail,
        loading: CLIENT_RECOVERY_ROUTES.loading,
        browsing: { ...CLIENT_BROWSING_ROUTES },
        cartSection: { ...CLIENT_CART_ROUTES },
        searchSection: {
            search: CLIENT_BROWSING_ROUTES.search,
            detail: CLIENT_BROWSING_ROUTES.detail
        },
        trackingSection: { ...CLIENT_TRACKING_ROUTES },
        session: { ...CLIENT_SESSION_ROUTES }
    },
    sections: {
        browsing: { ...CLIENT_BROWSING_ROUTES },
        cart: { ...CLIENT_CART_ROUTES },
        search: {
            search: CLIENT_BROWSING_ROUTES.search,
            detail: CLIENT_BROWSING_ROUTES.detail
        },
        tracking: { ...CLIENT_TRACKING_ROUTES },
        session: { ...CLIENT_SESSION_ROUTES }
    },
    session: {
        ...CLIENT_SESSION_CONFIG
    },
    routeMap: { ...CLIENT_ROUTE_MAP },
    features: [...CLIENT_FEATURES]
};

export const clientModule = CLIENT_MODULE;

export default CLIENT_MODULE;
