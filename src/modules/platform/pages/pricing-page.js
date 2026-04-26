import { api } from '../../../shared/api/apiClient.js';
import {
    buildRestaurantTenantId,
    escapeHtml,
    showToast
} from '../../../shared/utils/index.js';

const DASHBOARD_PATH = '/restaurant/dashboard.html';
const LOGIN_PATH = '/restaurant/login.html';

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: '49 000 XAF',
        period: '/mois',
        badge: 'Lancer rapidement',
        description: 'Pour un restaurant qui veut aller en ligne vite avec un site propre et un menu QR deja pret.',
        features: [
            'Site restaurant vitrine',
            'Menu digital avec QR code',
            'Back-office de base',
            'Support de demarrage'
        ],
        highlight: false
    },
    {
        id: 'growth',
        name: 'Growth',
        price: '89 000 XAF',
        period: '/mois',
        badge: 'Le plus choisi',
        description: 'Pour les restaurants qui veulent piloter le menu, les tables et les commandes dans un meme espace.',
        features: [
            'Tout le plan Starter',
            'Gestion des tables et commandes',
            'Personnalisation de l identite',
            'Priorite support'
        ],
        highlight: true
    },
    {
        id: 'signature',
        name: 'Signature',
        price: '149 000 XAF',
        period: '/mois',
        badge: 'Experience premium',
        description: 'Pour les etablissements qui veulent une image haut de gamme et un accompagnement renforce.',
        features: [
            'Tout le plan Growth',
            'Onboarding accompagne',
            'Parametrage avance',
            'Suivi premium'
        ],
        highlight: false
    }
];

const elements = {
    planGrid: document.getElementById('pricing-plan-grid'),
    selectedPlanInput: document.getElementById('selected-plan'),
    selectedPlanName: document.getElementById('selected-plan-name'),
    selectedPlanPrice: document.getElementById('selected-plan-price'),
    selectedPlanBadge: document.getElementById('selected-plan-badge'),
    selectedPlanDescription: document.getElementById('selected-plan-description'),
    selectedPlanFeatures: document.getElementById('selected-plan-features'),
    planSummaryPanel: document.getElementById('plan-summary'),
    onboardingFormPanel: document.getElementById('onboarding-form-panel'),
    onboardingForm: document.getElementById('restaurant-onboarding-form'),
    submitButton: document.getElementById('restaurant-onboarding-submit'),
    messageBox: document.getElementById('pricing-message'),
    restaurantNameInput: document.getElementById('restaurant-name'),
    restaurantTypeInput: document.getElementById('restaurant-type'),
    restaurantCityInput: document.getElementById('restaurant-city'),
    restaurantCapacityInput: document.getElementById('restaurant-capacity'),
    tenantPreview: document.getElementById('restaurant-tenant-preview'),
    ownerNameInput: document.getElementById('owner-name'),
    emailInput: document.getElementById('owner-email'),
    phoneInput: document.getElementById('owner-phone'),
    passwordInput: document.getElementById('owner-password'),
    confirmInput: document.getElementById('owner-password-confirm'),
    loginLink: document.getElementById('restaurant-login-link')
};

const isPricingPageReady = () => Boolean(
    elements.planGrid
    && elements.selectedPlanInput
    && elements.onboardingForm
    && elements.submitButton
);

const getPlanById = (planId) => PLANS.find((plan) => plan.id === planId) || PLANS[1];

const buildTenantPreview = (restaurantName) => {
    const normalizedName = String(restaurantName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36);

    return normalizedName
        ? `tenant-${normalizedName}-xxxx`
        : 'tenant-votre-restaurant-xxxx';
};

const setMessage = (message, type = 'error') => {
    if (!elements.messageBox) return;

    elements.messageBox.innerHTML = `
        <div class="rounded-2xl border px-4 py-3 text-sm ${
            type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
        }">
            ${escapeHtml(message)}
        </div>
    `;
    elements.messageBox.classList.remove('hidden');
};

const clearMessage = () => {
    if (!elements.messageBox) return;

    elements.messageBox.classList.add('hidden');
    elements.messageBox.innerHTML = '';
};

const renderSelectedPlan = (plan) => {
    if (!plan) return;

    elements.selectedPlanInput.value = plan.id;
    elements.selectedPlanName.textContent = plan.name;
    elements.selectedPlanPrice.textContent = `${plan.price}${plan.period}`;
    elements.selectedPlanBadge.textContent = plan.badge;
    elements.selectedPlanDescription.textContent = plan.description;
    elements.selectedPlanFeatures.innerHTML = plan.features
        .map((feature) => `
            <li class="flex items-start gap-3">
                <span class="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-700">&#10003;</span>
                <span>${escapeHtml(feature)}</span>
            </li>
        `)
        .join('');

    elements.planSummaryPanel?.classList.remove('hidden');
    elements.onboardingFormPanel?.classList.remove('hidden');
};

const setActiveCard = (planId) => {
    document.querySelectorAll('[data-plan-card]').forEach((card) => {
        const isActive = card.dataset.planId === planId;
        card.className = isActive
            ? 'group relative flex h-full flex-col justify-between rounded-[2rem] border border-slate-950 bg-slate-950 p-7 text-white shadow-2xl shadow-slate-300/40 transition'
            : 'group relative flex h-full flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-7 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl';

        const button = card.querySelector('[data-plan-select]');
        button?.classList.toggle('bg-white', isActive);
        button?.classList.toggle('text-slate-950', isActive);
        button?.classList.toggle('border-white/20', isActive);
        button?.classList.toggle('bg-slate-950', !isActive);
        button?.classList.toggle('text-white', !isActive);
    });
};

const persistRestaurantDraft = (draft) => {
    window.localStorage.setItem('restaurantOnboardingDraft', JSON.stringify(draft));
};

const syncTenantPreview = () => {
    if (!elements.tenantPreview) return;

    const restaurantName = String(elements.restaurantNameInput?.value || '').trim();
    const nextTenantId = buildTenantPreview(restaurantName);

    elements.tenantPreview.textContent = nextTenantId;
};

const updateLoginHref = () => {
    if (!elements.loginLink) return;

    const currentPlan = elements.selectedPlanInput?.value || 'growth';
    elements.loginLink.href = `${LOGIN_PATH}?plan=${encodeURIComponent(currentPlan)}`;
};

const selectPlan = (planId) => {
    const plan = getPlanById(planId);

    setActiveCard(plan.id);
    renderSelectedPlan(plan);
    clearMessage();
    updateLoginHref();

    window.localStorage.setItem('selectedRestaurantPlan', plan.id);
    window.localStorage.setItem('selectedRestaurantPlanLabel', plan.name);
    window.localStorage.setItem('selectedRestaurantPlanPrice', plan.price);

    elements.onboardingFormPanel?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
};

const renderPlans = () => {
    if (!elements.planGrid) return;

    elements.planGrid.innerHTML = PLANS.map((plan) => `
        <article
            class="${plan.highlight ? 'group relative flex h-full flex-col justify-between rounded-[2rem] border border-slate-950 bg-slate-950 p-7 text-white shadow-2xl shadow-slate-300/40 transition' : 'group relative flex h-full flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-7 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl'}"
            data-plan-card
            data-plan-id="${plan.id}"
        >
            <div>
                <div class="flex items-center justify-between gap-4">
                    <p class="text-xs font-bold uppercase tracking-[0.3em] ${plan.highlight ? 'text-orange-300' : 'text-teal-700'}">${escapeHtml(plan.badge)}</p>
                    <span class="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${plan.highlight ? 'border-white/20 text-white/80' : 'border-slate-200 text-slate-500'}">Plan</span>
                </div>

                <h3 class="mt-5 text-2xl font-extrabold">${escapeHtml(plan.name)}</h3>
                <p class="mt-4 text-sm leading-7 ${plan.highlight ? 'text-white/75' : 'text-slate-600'}">${escapeHtml(plan.description)}</p>

                <div class="mt-6 flex items-end gap-2">
                    <p class="text-4xl font-black">${escapeHtml(plan.price)}</p>
                    <p class="pb-1 text-sm font-semibold ${plan.highlight ? 'text-white/70' : 'text-slate-500'}">${escapeHtml(plan.period)}</p>
                </div>

                <ul class="mt-6 space-y-3 text-sm leading-6 ${plan.highlight ? 'text-white/80' : 'text-slate-600'}">
                    ${plan.features.map((feature) => `
                        <li class="flex items-start gap-3">
                            <span class="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full ${plan.highlight ? 'bg-white/10 text-white' : 'bg-emerald-100 text-emerald-700'} text-[11px] font-black">&#10003;</span>
                            <span>${escapeHtml(feature)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <button
                type="button"
                data-plan-select
                class="mt-8 inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-bold transition ${plan.highlight ? 'border-white/20 bg-white text-slate-950 hover:bg-slate-100' : 'border-slate-200 bg-slate-950 text-white hover:bg-slate-800'}"
            >
                Choisir ${escapeHtml(plan.name)}
            </button>
        </article>
    `).join('');

    elements.planGrid.querySelectorAll('[data-plan-card]').forEach((card) => {
        const planId = card.dataset.planId;

        card.addEventListener('click', () => selectPlan(planId));
        card.querySelector('[data-plan-select]')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectPlan(planId);
        });
    });
};

const fillPlanFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = params.get('plan')
        || window.localStorage.getItem('selectedRestaurantPlan')
        || 'growth';

    selectPlan(getPlanById(requestedPlan).id);
};

const submitOnboardingForm = async (event) => {
    event.preventDefault();
    clearMessage();

    const selectedPlanId = String(elements.selectedPlanInput?.value || '').trim();
    const selectedPlan = getPlanById(selectedPlanId);
    const restaurantName = String(elements.restaurantNameInput?.value || '').trim();
    const restaurantType = String(elements.restaurantTypeInput?.value || '').trim();
    const restaurantCity = String(elements.restaurantCityInput?.value || '').trim();
    const restaurantCapacity = String(elements.restaurantCapacityInput?.value || '').trim();
    const ownerName = String(elements.ownerNameInput?.value || '').trim();
    const email = String(elements.emailInput?.value || '').trim().toLowerCase();
    const phoneNumber = String(elements.phoneInput?.value || '').trim();
    const password = String(elements.passwordInput?.value || '');
    const passwordConfirm = String(elements.confirmInput?.value || '');

    if (!selectedPlan?.id) {
        setMessage('Choisissez un plan pour continuer.');
        return;
    }

    if (!restaurantName || !ownerName || !email || !password || !passwordConfirm) {
        setMessage('Renseignez tous les champs obligatoires.');
        return;
    }

    if (password !== passwordConfirm) {
        setMessage('Les mots de passe ne correspondent pas.');
        return;
    }

    if (password.length < 6) {
        setMessage('Le mot de passe doit contenir au moins 6 caracteres.');
        return;
    }

    const tenantId = buildRestaurantTenantId(restaurantName);

    elements.submitButton?.setAttribute('disabled', 'disabled');
    elements.submitButton.textContent = 'Creation en cours...';

    try {
        persistRestaurantDraft({
            planId: selectedPlan.id,
            planLabel: selectedPlan.name,
            restaurantName,
            restaurantType,
            restaurantCity,
            restaurantCapacity,
            tenantId,
            ownerName,
            email
        });

        const response = await api.auth.signup({
            email,
            password,
            passwordConfirm,
            name: ownerName,
            phoneNumber: phoneNumber || undefined,
            role: 'admin',
            tenant_id: tenantId,
            restaurant_id: tenantId
        });

        const authToken = response?.idToken || response?.customToken || '';
        if (!authToken) {
            throw new Error('Aucune session securisee n a ete retournee apres la creation.');
        }

        api.setToken(authToken);

        const userData = response?.data || null;
        if (userData) {
            window.localStorage.setItem('user', JSON.stringify(userData));
        }

        window.localStorage.setItem('selectedRestaurantPlan', selectedPlan.id);
        window.localStorage.setItem('selectedRestaurantPlanLabel', selectedPlan.name);
        window.localStorage.setItem('selectedRestaurantName', restaurantName);
        window.localStorage.setItem('selectedRestaurantTenantId', tenantId);
        window.localStorage.setItem('selectedRestaurantType', restaurantType);
        window.localStorage.setItem('selectedRestaurantCity', restaurantCity);
        window.localStorage.setItem('selectedRestaurantCapacity', restaurantCapacity);

        setMessage(
            `Votre restaurant "${restaurantName}" est pret. Vous allez etre redirige vers votre espace.`,
            'success'
        );
        showToast('Restaurant cree avec succes', 'success');

        window.setTimeout(() => {
            window.location.href = DASHBOARD_PATH;
        }, 1200);
    } catch (error) {
        setMessage(error.message || 'La creation du restaurant a echoue.');
        showToast(error.message || 'Impossible de creer le restaurant', 'error');
    } finally {
        elements.submitButton?.removeAttribute('disabled');
        elements.submitButton.textContent = 'Creer mon restaurant digital';
    }
};

if (isPricingPageReady()) {
    renderPlans();
    fillPlanFromUrl();
    updateLoginHref();
    syncTenantPreview();

    elements.planGrid?.addEventListener('click', updateLoginHref);
    elements.restaurantNameInput?.addEventListener('input', syncTenantPreview);
    elements.onboardingForm?.addEventListener('submit', submitOnboardingForm);
}
