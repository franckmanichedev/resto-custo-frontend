// assets/js/dashboard.js
// Premium dashboard interactions for RestoQR
(function () {
    const STORAGE_KEYS = {
        restaurant: 'restoqr.restaurantProfile',
        plan: 'restoqr.selectedPlan'
    };

    const PLAN_LABELS = {
        starter: 'Starter',
        pro: 'Pro',
        premium: 'Premium'
    };

    const DEFAULT_PROFILE = {
        restaurantName: 'Mon restaurant',
        tableCount: 12,
        planId: 'pro'
    };

    function $(selector, scope = document) {
        return scope.querySelector(selector);
    }

    function $all(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector));
    }

    function getStoredJSON(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function setText(selector, value) {
        const node = $(selector);
        if (node) {
            node.textContent = value;
        }
    }

    function createToast(message, type = 'success') {
        const host = document.querySelector('.toast-host') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast-host' }));

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div>
                <strong>${type === 'success' ? 'Dashboard' : 'Alerte'}</strong>
                <p>${message}</p>
            </div>
            <button class="toast-close" type="button" aria-label="Fermer">✕</button>
        `;

        host.appendChild(toast);

        const closeToast = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            window.setTimeout(() => toast.remove(), 200);
        };

        $('.toast-close', toast)?.addEventListener('click', closeToast);
        window.setTimeout(closeToast, 2800);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('fr-FR');
    }

    function normalizeProfile(profile) {
        if (!profile || typeof profile !== 'object') {
            return { ...DEFAULT_PROFILE };
        }

        return {
            restaurantName: profile.restaurantName || profile.name || DEFAULT_PROFILE.restaurantName,
            tableCount: Number(profile.tableCount || profile.tables || DEFAULT_PROFILE.tableCount),
            planId: profile.planId || profile.plan || DEFAULT_PROFILE.planId
        };
    }

    function renderProfile() {
        const profile = normalizeProfile(getStoredJSON(STORAGE_KEYS.restaurant));
        const storedPlan = localStorage.getItem(STORAGE_KEYS.plan) || profile.planId || DEFAULT_PROFILE.planId;
        const planId = PLAN_LABELS[storedPlan] ? storedPlan : DEFAULT_PROFILE.planId;

        setText('[data-dashboard-restaurant-name]', profile.restaurantName);
        setText('[data-dashboard-plan]', PLAN_LABELS[planId]);
        setText('[data-dashboard-tables]', `${profile.tableCount} tables`);
    }

    function getRandomStats() {
        const orders = Math.floor(Math.random() * 30) + 28;
        const revenue = orders * (Math.floor(Math.random() * 1400) + 4200);
        const minutes = Math.floor(Math.random() * 6) + 6;

        return {
            orders,
            revenue,
            minutes
        };
    }

    function renderStats(stats) {
        setText('[data-stat-orders]', String(stats.orders));
        setText('[data-stat-revenue]', formatNumber(stats.revenue));
        setText('[data-stat-time]', `${stats.minutes} min`);
    }

    function renderOrdersList() {
        const rows = $all('.order-row');
        if (!rows.length) return;

        const statuses = [
            { label: 'En cuisine', className: 'warning' },
            { label: 'Prête', className: 'success' },
            { label: 'Payée', className: 'info' }
        ];

        rows.forEach((row, index) => {
            const status = statuses[index % statuses.length];
            const badge = $('.status-pill', row);
            if (!badge) return;
            badge.className = `status-pill ${status.className}`;
            badge.textContent = status.label;
        });
    }

    function bindButtons() {
        const refreshButton = $('#dashboardRefresh');
        const toastButton = $('#dashboardToast');
        const randomizeButton = $('#dashboardRandomize');

        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                const stats = getRandomStats();
                renderStats(stats);
                renderOrdersList();
                refreshButton.classList.add('animate-pulse');
                window.setTimeout(() => refreshButton.classList.remove('animate-pulse'), 450);
                createToast('Les statistiques du dashboard ont été rafraîchies.');
            });
        }

        if (toastButton) {
            toastButton.addEventListener('click', () => {
                createToast('L’équipe a été notifiée avec succès.');
            });
        }

        if (randomizeButton) {
            randomizeButton.addEventListener('click', () => {
                const stats = getRandomStats();
                renderStats(stats);
                createToast('Nouvelle activité simulée sur le restaurant.');
            });
        }
    }

    function init() {
        renderProfile();
        renderStats({
            orders: 42,
            revenue: 184000,
            minutes: 8
        });
        renderOrdersList();
        bindButtons();

        const storedProfile = normalizeProfile(getStoredJSON(STORAGE_KEYS.restaurant));
        if (!getStoredJSON(STORAGE_KEYS.restaurant)) {
            localStorage.setItem(STORAGE_KEYS.restaurant, JSON.stringify(storedProfile));
            localStorage.setItem(STORAGE_KEYS.plan, storedProfile.planId || DEFAULT_PROFILE.planId);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
