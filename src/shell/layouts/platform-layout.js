import {
    getShellDefaultPath,
    getShellEntryPath,
    getShellLoginPath,
    getShellRouteMeta,
    isShellScopePath,
    SHELL_SCOPES
} from '../router.js';

export const PLATFORM_LAYOUT = {
    scope: SHELL_SCOPES.PLATFORM,
    name: 'platform',
    label: 'Platform',
    className: 'shell-layout shell-layout--platform',
    allowedRoles: ['platform_owner', 'platform_admin', 'platform_support'],
    allowedScopes: ['platform'],
    rootPath: '/platform',
    entryPath: getShellEntryPath(SHELL_SCOPES.PLATFORM),
    defaultPath: getShellDefaultPath(SHELL_SCOPES.PLATFORM),
    loginPath: getShellLoginPath(SHELL_SCOPES.PLATFORM)
};

const hasDocument = () => typeof document !== 'undefined';

const toggleBodyClass = (className, shouldAdd) => {
    if (!hasDocument()) return;

    document.body.classList.toggle(className, Boolean(shouldAdd));
};

export const isPlatformLayoutPath = (pathname = window.location.pathname) => (
    isShellScopePath(SHELL_SCOPES.PLATFORM, pathname)
);

export const createPlatformLayout = (options = {}) => {
    const meta = getShellRouteMeta(options.pathname || window.location.pathname);

    return {
        ...PLATFORM_LAYOUT,
        ...meta,
        title: options.title || 'Espace Platform',
        description: options.description || 'Supervision de la plateforme',
        mount: options.mount || null
    };
};

export const applyPlatformLayout = (options = {}) => {
    if (!hasDocument()) {
        return createPlatformLayout(options);
    }

    const layout = createPlatformLayout(options);

    document.body.dataset.shellScope = layout.scope;
    document.body.dataset.shellLayout = layout.name;
    toggleBodyClass('shell-layout', true);
    toggleBodyClass('shell-layout--platform', true);

    if (options.title || document.title.indexOf('Platform') === -1) {
        document.title = options.title || 'Resto QRCode - Platform';
    }

    return layout;
};

export const platformLayout = createPlatformLayout();

export default platformLayout;
