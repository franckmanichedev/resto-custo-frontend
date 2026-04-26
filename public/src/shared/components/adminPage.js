const resolveDefaultRedirectUrl = () => {
    const pathname = String(window.location.pathname || '').toLowerCase();

    if (pathname.startsWith('/restaurant/')) {
        return './login.html';
    }

    return './index.html';
};

export function initializeAdminPage({
    authService,
    redirectUrl = resolveDefaultRedirectUrl(),
    userNameSelector = '#user-name',
    logoutSelector = '#logout-btn'
}) {
    if (!authService?.isAdmin()) {
        authService?.clearSession?.();
        window.location.href = redirectUrl;
        return false;
    }

    const userData = authService.getUserData();
    const userNameElement = document.querySelector(userNameSelector);
    const logoutButton = document.querySelector(logoutSelector);

    if (userNameElement) {
        userNameElement.textContent = userData?.name || userData?.email || 'Admin';
    }

    if (logoutButton && !logoutButton.dataset.boundLogout) {
        logoutButton.dataset.boundLogout = 'true';
        logoutButton.addEventListener('click', async () => {
            await authService.logout();
            window.location.href = redirectUrl;
        });
    }

    return true;
}
