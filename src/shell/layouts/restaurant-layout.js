import {
    getShellDefaultPath,
    getShellEntryPath,
    getShellLoginPath,
    getShellRouteMeta,
    isShellScopePath,
    SHELL_SCOPES
} from '../router.js';

export const RESTAURANT_LAYOUT = {
    scope: SHELL_SCOPES.RESTAURANT,
    name: 'restaurant',
    label: 'Restaurant',
    className: 'shell-layout shell-layout--restaurant',
    allowedRoles: ['admin', 'menu_manager', 'kitchen_staff'],
    allowedScopes: ['restaurant'],
    rootPath: '/restaurant',
    entryPath: getShellEntryPath(SHELL_SCOPES.RESTAURANT),
    defaultPath: getShellDefaultPath(SHELL_SCOPES.RESTAURANT),
    loginPath: getShellLoginPath(SHELL_SCOPES.RESTAURANT)
};

const hasDocument = () => typeof document !== 'undefined';

const toggleBodyClass = (className, shouldAdd) => {
    if (!hasDocument()) return;

    document.body.classList.toggle(className, Boolean(shouldAdd));
};

export const isRestaurantLayoutPath = (pathname = window.location.pathname) => (
    isShellScopePath(SHELL_SCOPES.RESTAURANT, pathname)
);

export const createRestaurantLayout = (options = {}) => {
    const meta = getShellRouteMeta(options.pathname || window.location.pathname);

    return {
        ...RESTAURANT_LAYOUT,
        ...meta,
        title: options.title || 'Espace Restaurant',
        description: options.description || 'Gestion du restaurant',
        mount: options.mount || null
    };
};

export const applyRestaurantLayout = (options = {}) => {
    if (!hasDocument()) {
        return createRestaurantLayout(options);
    }

    const layout = createRestaurantLayout(options);

    document.body.dataset.shellScope = layout.scope;
    document.body.dataset.shellLayout = layout.name;
    toggleBodyClass('shell-layout', true);
    toggleBodyClass('shell-layout--restaurant', true);

    if (options.title || document.title.indexOf('Restaurant') === -1) {
        document.title = options.title || 'Resto QRCode - Restaurant';
    }

    return layout;
};

export const restaurantLayout = createRestaurantLayout();

export default restaurantLayout;
