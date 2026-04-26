import { PLATFORM_LAYOUT } from '../../shell/layouts/platform-layout.js';
import {
    SHELL_ENTRY_PATHS,
    SHELL_LOGIN_PATHS,
    SHELL_SCOPES
} from '../../shell/router.js';
import {
    PLATFORM_BACKOFFICE_ROUTES,
    PLATFORM_CONFIGURATION_ROUTES,
    PLATFORM_FEATURES,
    PLATFORM_OPERATOR_ROUTES,
    PLATFORM_PUBLIC_ROUTES,
    PLATFORM_REDIRECT_CONFIG
} from './manifest.js';

export const PLATFORM_MODULE = {
    scope: SHELL_SCOPES.PLATFORM,
    label: 'Platform',
    layout: PLATFORM_LAYOUT.name,
    rootPath: '/platform',
    entryPath: SHELL_ENTRY_PATHS[SHELL_SCOPES.PLATFORM],
    loginPath: SHELL_LOGIN_PATHS[SHELL_SCOPES.PLATFORM],
    roles: [...PLATFORM_LAYOUT.allowedRoles],
    scopes: [...PLATFORM_LAYOUT.allowedScopes],
    routes: {
        home: PLATFORM_PUBLIC_ROUTES.home,
        login: PLATFORM_OPERATOR_ROUTES.login,
        tenants: PLATFORM_OPERATOR_ROUTES.tenants,
        users: PLATFORM_OPERATOR_ROUTES.users,
        billing: PLATFORM_OPERATOR_ROUTES.billing,
        analytics: PLATFORM_OPERATOR_ROUTES.analytics,
        public: { ...PLATFORM_PUBLIC_ROUTES },
        operator: { ...PLATFORM_OPERATOR_ROUTES },
        backoffice: { ...PLATFORM_BACKOFFICE_ROUTES },
        configuration: { ...PLATFORM_CONFIGURATION_ROUTES },
        redirect: { ...PLATFORM_REDIRECT_CONFIG }
    },
    sections: {
        public: { ...PLATFORM_PUBLIC_ROUTES },
        operator: { ...PLATFORM_OPERATOR_ROUTES },
        backoffice: { ...PLATFORM_BACKOFFICE_ROUTES },
        configuration: { ...PLATFORM_CONFIGURATION_ROUTES }
    },
    redirect: { ...PLATFORM_REDIRECT_CONFIG },
    features: [...PLATFORM_FEATURES]
};

export const platformModule = PLATFORM_MODULE;

export default PLATFORM_MODULE;
