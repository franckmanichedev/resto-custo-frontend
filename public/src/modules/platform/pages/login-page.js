import { platformAuthService } from '../services/platformAuthService.js';

const DASHBOARD_PATH = './dashboard.html';

const loginForm = document.getElementById('platform-login-form');
const submitButton = document.getElementById('platform-login-submit');
const messageBox = document.getElementById('platform-login-message');

const setMessage = (message, type = 'error') => {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `rounded-2xl border px-4 py-3 text-sm ${
        type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700'
    }`;
    messageBox.classList.remove('hidden');
};

const clearMessage = () => {
    if (!messageBox) return;
    messageBox.classList.add('hidden');
    messageBox.textContent = '';
};

if (await platformAuthService.validateSession()) {
    window.location.href = DASHBOARD_PATH;
}

loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const email = document.getElementById('platform-email')?.value.trim();
    const password = document.getElementById('platform-password')?.value || '';

    if (!email || !password) {
        setMessage('Renseignez votre email et votre mot de passe.');
        return;
    }

    submitButton?.setAttribute('disabled', 'disabled');

    try {
        await platformAuthService.login(email, password);
        window.location.href = DASHBOARD_PATH;
    } catch (error) {
        setMessage(error.message || 'Connexion impossible pour le moment.');
    } finally {
        submitButton?.removeAttribute('disabled');
    }
});
