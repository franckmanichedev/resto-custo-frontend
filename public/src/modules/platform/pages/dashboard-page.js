import { platformAuthService } from '../services/platformAuthService.js';

const LOGIN_PATH = './login.html';

const bindUserData = () => {
    const user = platformAuthService.getUserData();
    const name = user?.name || user?.email || 'Equipe plateforme';
    const role = String(user?.role || 'platform_owner').replace(/_/g, ' ');

    const nameTarget = document.querySelector('[data-platform-user-name]');
    const emailTarget = document.querySelector('[data-platform-user-email]');
    const roleTarget = document.querySelector('[data-platform-user-role]');

    if (nameTarget) {
        nameTarget.textContent = name;
    }

    if (emailTarget) {
        emailTarget.textContent = user?.email || 'support@restoqrcode.app';
    }

    if (roleTarget) {
        roleTarget.textContent = role;
    }
};

if (!(await platformAuthService.validateSession())) {
    window.location.href = LOGIN_PATH;
}

if (!platformAuthService.requirePlatform('/platform/login.html')) {
    throw new Error('Unauthorized platform access');
}

bindUserData();

document.getElementById('platform-logout-btn')?.addEventListener('click', async () => {
    await platformAuthService.logout();
    window.location.href = LOGIN_PATH;
});
