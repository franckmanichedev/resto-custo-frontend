export const RESTAURANT_PUBLIC_ROUTES = {
    home: '/restaurant/index.html',
    menu: '/restaurant/menu.html',
    identity: '/restaurant/identity.html',
    about: '/restaurant/about.html',
    contact: '/restaurant/contact.html'
};

export const RESTAURANT_BACKOFFICE_ROUTES = {
    home: '/restaurant/dashboard.html',
    login: '/restaurant/login.html',
    plats: '/restaurant/plats.html',
    categories: '/restaurant/categories.html',
    tables: '/restaurant/tables.html',
    orders: '/restaurant/commandes.html',
    compositions: '/restaurant/compositions.html',
    users: '/restaurant/users.html'
};

export const RESTAURANT_CONFIGURATION_ROUTES = {
    branding: '/restaurant/configuration/branding.html',
    identity: '/restaurant/configuration/identity.html',
    menu: '/restaurant/configuration/menu.html',
    redirection: '/restaurant/configuration/redirection.html'
};

export const RESTAURANT_REDIRECT_CONFIG = {
    storageKey: 'restaurantClientRedirectPath',
    queryParamName: 'redirect',
    defaultPath: '/client/loading.html',
    loginPath: '/restaurant/login.html'
};

export const RESTAURANT_FEATURES = [
    'menu-management',
    'category-management',
    'table-management',
    'order-management',
    'restaurant-identity',
    'client-redirection'
];
