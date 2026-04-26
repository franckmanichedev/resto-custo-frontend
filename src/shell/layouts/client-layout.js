import {
    getShellDefaultPath,
    getShellEntryPath,
    getShellLoginPath,
    getShellRouteMeta,
    isShellScopePath,
    SHELL_SCOPES
} from '../router.js';

export const CLIENT_LAYOUT = {
    scope: SHELL_SCOPES.CLIENT,
    name: 'client',
    label: 'Client',
    className: 'shell-layout shell-layout--client',
    allowedRoles: ['customer'],
    allowedScopes: ['client'],
    rootPath: '/client',
    entryPath: getShellEntryPath(SHELL_SCOPES.CLIENT),
    defaultPath: getShellDefaultPath(SHELL_SCOPES.CLIENT),
    loginPath: getShellLoginPath(SHELL_SCOPES.CLIENT)
};

const hasDocument = () => typeof document !== 'undefined';

const toggleBodyClass = (className, shouldAdd) => {
    if (!hasDocument()) return;

    document.body.classList.toggle(className, Boolean(shouldAdd));
};

export const isClientLayoutPath = (pathname = window.location.pathname) => (
    isShellScopePath(SHELL_SCOPES.CLIENT, pathname)
);

export const createClientLayout = (options = {}) => {
    const meta = getShellRouteMeta(options.pathname || window.location.pathname);

    return {
        ...CLIENT_LAYOUT,
        ...meta,
        title: options.title || 'Espace Client',
        description: options.description || 'Expérience QR code du restaurant',
        mount: options.mount || null
    };
};

export const applyClientLayout = (options = {}) => {
    if (!hasDocument()) {
        return createClientLayout(options);
    }

    const layout = createClientLayout(options);

    document.body.dataset.shellScope = layout.scope;
    document.body.dataset.shellLayout = layout.name;
    toggleBodyClass('shell-layout', true);
    toggleBodyClass('shell-layout--client', true);

    if (options.title || document.title.indexOf('Client') === -1) {
        document.title = options.title || 'Resto QRCode - Client';
    }

    return layout;
};

export const clientLayout = createClientLayout();

export default clientLayout;
