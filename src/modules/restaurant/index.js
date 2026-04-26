import { RESTAURANT_LAYOUT } from '../../shell/layouts/restaurant-layout.js';
import {
    SHELL_ENTRY_PATHS,
    SHELL_LOGIN_PATHS,
    SHELL_SCOPES
} from '../../shell/router.js';
import {
    RESTAURANT_BACKOFFICE_ROUTES,
    RESTAURANT_CONFIGURATION_ROUTES,
    RESTAURANT_FEATURES,
    RESTAURANT_PUBLIC_ROUTES,
    RESTAURANT_REDIRECT_CONFIG
} from './manifest.js';

export const RESTAURANT_MODULE = {
    scope: SHELL_SCOPES.RESTAURANT,
    label: 'Restaurant',
    layout: RESTAURANT_LAYOUT.name,
    rootPath: '/restaurant',
    entryPath: SHELL_ENTRY_PATHS[SHELL_SCOPES.RESTAURANT],
    loginPath: SHELL_LOGIN_PATHS[SHELL_SCOPES.RESTAURANT],
    roles: [...RESTAURANT_LAYOUT.allowedRoles],
    scopes: [...RESTAURANT_LAYOUT.allowedScopes],
    routes: {
        home: RESTAURANT_BACKOFFICE_ROUTES.home,
        login: RESTAURANT_BACKOFFICE_ROUTES.login,
        plats: RESTAURANT_BACKOFFICE_ROUTES.plats,
        categories: RESTAURANT_BACKOFFICE_ROUTES.categories,
        tables: RESTAURANT_BACKOFFICE_ROUTES.tables,
        orders: RESTAURANT_BACKOFFICE_ROUTES.orders,
        compositions: RESTAURANT_BACKOFFICE_ROUTES.compositions,
        users: RESTAURANT_BACKOFFICE_ROUTES.users,
        public: { ...RESTAURANT_PUBLIC_ROUTES },
        backoffice: { ...RESTAURANT_BACKOFFICE_ROUTES },
        configuration: { ...RESTAURANT_CONFIGURATION_ROUTES },
        redirect: { ...RESTAURANT_REDIRECT_CONFIG }
    },
    sections: {
        public: { ...RESTAURANT_PUBLIC_ROUTES },
        backoffice: { ...RESTAURANT_BACKOFFICE_ROUTES },
        configuration: { ...RESTAURANT_CONFIGURATION_ROUTES }
    },
    redirect: { ...RESTAURANT_REDIRECT_CONFIG },
    features: [...RESTAURANT_FEATURES]
};

export const restaurantModule = RESTAURANT_MODULE;

export default RESTAURANT_MODULE;
