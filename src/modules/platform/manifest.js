export const PLATFORM_PUBLIC_ROUTES = {
    home: '/platform/index.html',
    solution: '/platform/solution.html',
    features: '/platform/features.html',
    pricing: '/platform/pricing.html',
    contact: '/platform/contact.html'
};

export const PLATFORM_OPERATOR_ROUTES = {
    login: '/platform/login.html',
    dashboard: '/platform/dashboard.html',
    tenants: '/platform/tenants.html',
    users: '/platform/users.html',
    billing: '/platform/billing.html',
    analytics: '/platform/analytics.html'
};

export const PLATFORM_CONFIGURATION_ROUTES = {
    products: '/platform/configuration/products.html',
    branding: '/platform/configuration/branding.html',
    integrations: '/platform/configuration/integrations.html',
    deployment: '/platform/configuration/deployment.html'
};

export const PLATFORM_BACKOFFICE_ROUTES = {
    home: PLATFORM_OPERATOR_ROUTES.dashboard,
    login: PLATFORM_OPERATOR_ROUTES.login,
    tenants: PLATFORM_OPERATOR_ROUTES.tenants,
    users: PLATFORM_OPERATOR_ROUTES.users,
    billing: PLATFORM_OPERATOR_ROUTES.billing,
    analytics: PLATFORM_OPERATOR_ROUTES.analytics
};

export const PLATFORM_FEATURES = [
    'ecosystem-vitrine',
    'product-configuration',
    'operator-dashboard',
    'tenant-management',
    'billing-overview',
    'support-operations'
];

export const PLATFORM_REDIRECT_CONFIG = {
    storageKey: 'platformRedirectPath',
    queryParamName: 'redirect',
    defaultPath: PLATFORM_PUBLIC_ROUTES.home,
    loginPath: PLATFORM_OPERATOR_ROUTES.login
};
