export const CLIENT_ROOT_PATH = '/client';

export const CLIENT_BROWSING_ROUTES = {
    home: '/client/index.html',
    menu: '/client/menu.html',
    categories: '/client/categories.html',
    search: '/client/search.html',
    detail: '/client/article-detail.html'
};

export const CLIENT_CART_ROUTES = {
    cart: '/client/cart.html'
};

export const CLIENT_TRACKING_ROUTES = {
    tracking: '/client/tracking.html'
};

export const CLIENT_RECOVERY_ROUTES = {
    loading: '/client/loading.html',
    sessionExpired: '/client/loading.html?expired=1',
    sessionRecovered: '/client/loading.html?recovered=1'
};

export const CLIENT_SESSION_ROUTES = {
    loading: CLIENT_RECOVERY_ROUTES.loading,
    recovery: CLIENT_RECOVERY_ROUTES.sessionRecovered,
    expiration: CLIENT_RECOVERY_ROUTES.sessionExpired,
    redirect: CLIENT_BROWSING_ROUTES.home
};

export const CLIENT_SESSION_CONFIG = {
    storageKey: 'clientSessionToken',
    redirectStorageKey: 'clientRedirectPath',
    queryParamName: 'redirect',
    expirationQueryParamName: 'expired',
    recoveryQueryParamName: 'recovered',
    defaultPath: CLIENT_BROWSING_ROUTES.menu,
    loadingPath: CLIENT_RECOVERY_ROUTES.loading,
    expiredPath: CLIENT_RECOVERY_ROUTES.sessionExpired,
    recoveredPath: CLIENT_RECOVERY_ROUTES.sessionRecovered
};

export const CLIENT_FEATURES = [
    'qr-session',
    'menu-browsing',
    'cart-management',
    'search',
    'order-tracking',
    'session-loading'
];

export const CLIENT_ROUTE_MAP = {
    ...CLIENT_BROWSING_ROUTES,
    ...CLIENT_CART_ROUTES,
    ...CLIENT_TRACKING_ROUTES,
    ...CLIENT_RECOVERY_ROUTES
};

export const CLIENT_ROUTES = CLIENT_ROUTE_MAP;
