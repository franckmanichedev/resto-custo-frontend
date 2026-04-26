import { authService } from '../services/authService.js';

const DASHBOARD_PATH = './dashboard.html';
const PLAN_LABELS = {
    starter: 'Starter',
    growth: 'Growth',
    signature: 'Signature'
};

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');
const authMessage = document.getElementById('auth-message');
const registerPlanInput = document.getElementById('register-plan');
const registerPlanBanner = document.getElementById('register-plan-banner');
const registerPlanName = document.getElementById('register-selected-plan');

const hydrateSignupPlan = () => {
    const params = new URLSearchParams(window.location.search);
    const selectedPlan = String(
        params.get('plan')
        || window.localStorage.getItem('selectedRestaurantPlan')
        || ''
    ).trim().toLowerCase();

    if (!selectedPlan || !registerPlanInput) {
        return;
    }

    registerPlanInput.value = selectedPlan;

    if (registerPlanBanner && registerPlanName) {
        registerPlanName.textContent = PLAN_LABELS[selectedPlan] || selectedPlan;
        registerPlanBanner.classList.remove('hidden');
    }
};

if (await authService.validateSession()) {
    window.location.href = DASHBOARD_PATH;
}

hydrateSignupPlan();

showLoginBtn?.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    showLoginBtn.className = 'flex-1 py-2 text-center font-medium rounded-xl bg-yellow-500 text-white';
    showRegisterBtn.className = 'flex-1 py-2 text-center font-medium rounded-xl text-gray-500 hover:bg-gray-50';
});

showRegisterBtn?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    showRegisterBtn.className = 'flex-1 py-2 text-center font-medium rounded-xl bg-yellow-500 text-white';
    showLoginBtn.className = 'flex-1 py-2 text-center font-medium rounded-xl text-gray-500 hover:bg-gray-50';
});

loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('Veuillez remplir tous les champs', 'error');
        return;
    }

    try {
        await authService.login(email, password);
        window.location.href = DASHBOARD_PATH;
    } catch (error) {
        showMessage(error.message || 'Erreur de connexion', 'error');
    }
});

registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const restaurantName = document.getElementById('register-restaurant-name')?.value.trim() || '';
    const email = document.getElementById('register-email')?.value.trim() || '';
    const phone = document.getElementById('register-phone')?.value.trim() || '';
    const password = document.getElementById('register-password')?.value || '';
    const confirm = document.getElementById('register-password-confirm')?.value || '';
    const plan = document.getElementById('register-plan')?.value || '';

    if (!restaurantName || !name || !email || !password) {
        showMessage('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    if (password !== confirm) {
        showMessage('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    try {
        await authService.signup({
            email,
            password,
            name,
            phoneNumber: phone,
            restaurantName,
            role: 'admin',
            plan
        });
        window.location.href = DASHBOARD_PATH;
    } catch (error) {
        showMessage(error.message || 'Erreur lors de l\'inscription', 'error');
    }
});

function showMessage(message, type) {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.className = `mt-4 p-3 rounded-xl text-sm ${
        type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
    }`;
    authMessage.classList.remove('hidden');

    window.setTimeout(() => {
        authMessage.classList.add('hidden');
    }, 3000);
}
