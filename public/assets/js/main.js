// assets/js/main.js
// Premium SaaS homepage interactions for RestoQR
(function () {
    const STORAGE_KEYS = {
        plan: 'restoqr.selectedPlan',
        restaurant: 'restoqr.restaurantProfile',
        darkMode: 'restoqr.darkMode'
    };

    const PLAN_DATA = {
        starter: {
            name: 'Starter',
            price: '5 000 FCFA',
            billing: '/mois',
            badge: 'Idéal pour démarrer',
            description: 'Une base solide pour digitaliser un restaurant avec une expérience fluide et crédible.',
            highlights: ['Menu QR interactif', 'Commande mobile', 'Jusqu’à 10 tables', 'Support email']
        },
        pro: {
            name: 'Pro',
            price: '10 000 FCFA',
            billing: '/mois',
            badge: 'Le plus choisi',
            description: 'Le bon équilibre entre conversion, productivité et image de marque premium.',
            highlights: ['QR illimités', 'Suivi en temps réel', 'Analytics avancées', 'Support prioritaire']
        },
        premium: {
            name: 'Premium',
            price: '15 000 FCFA',
            billing: '/mois',
            badge: 'Expérience complète',
            description: 'Pensé pour les restaurants exigeants qui veulent une présence digitale irréprochable.',
            highlights: ['Multi-espaces', 'SLA renforcé', 'Tableau de bord avancé', 'Accompagnement dédié']
        }
    };

    function $(selector, scope = document) {
        return scope.querySelector(selector);
    }

    function $all(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector));
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&')
            .replaceAll('<', '<')
            .replaceAll('>', '>')
            .replaceAll('"', '"')
            .replaceAll("'", '&#039;');
    }

    function getStoredJSON(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function setStoredJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function createElement(tagName, className, innerHTML) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    function ensureUiRoots() {
        const body = document.body;
        if (!$('.scroll-progress')) {
            const progress = createElement('div', 'scroll-progress', '<span></span>');
            body.prepend(progress);
        }

        if (!$('.toast-host')) {
            body.appendChild(createElement('div', 'toast-host'));
        }

        if (!$('.loader-overlay')) {
            const loader = createElement(
                'div',
                'loader-overlay',
                `
                    <div class="loader-card">
                        <div class="loader-ring"></div>
                        <div>
                            <div class="loader-brand">RestoQR</div>
                            <p class="muted" style="margin:0.4rem 0 0;">Digital Menu & Smart Ordering System</p>
                        </div>
                    </div>
                `
            );
            body.prepend(loader);
        }
    }

    function hideLoader() {
        const loader = $('.loader-overlay');
        if (!loader) return;
        window.setTimeout(() => loader.classList.add('is-hidden'), 600);
        window.setTimeout(() => loader.remove(), 950);
    }

    function createToast({ title, message, type = 'success' }) {
        const host = $('.toast-host');
        if (!host) return;

        const toast = createElement(
            'div',
            `toast ${type}`,
            `
                <div>
                    <strong>${escapeHtml(title)}</strong>
                    <p>${escapeHtml(message)}</p>
                </div>
                <button class="toast-close" aria-label="Fermer le toast">✕</button>
            `
        );

        host.appendChild(toast);

        const close = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            window.setTimeout(() => toast.remove(), 220);
        };

        $('.toast-close', toast).addEventListener('click', close);
        window.setTimeout(close, 3200);
    }

    function updateScrollProgress() {
        const bar = $('.scroll-progress > span');
        if (!bar) return;

        const total = document.documentElement.scrollHeight - window.innerHeight;
        const current = window.scrollY;
        const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
        bar.style.width = `${ratio * 100}%`;
    }

    function initMobileMenu() {
        const toggle = $('[data-mobile-menu-toggle]');
        const menu = $('[data-mobile-menu]');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', () => {
            const isOpen = menu.dataset.open === 'true';
            menu.dataset.open = String(!isOpen);
            menu.classList.toggle('hidden', isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
        });

        $all('[data-mobile-menu] a').forEach((link) => {
            link.addEventListener('click', () => {
                menu.dataset.open = 'false';
                menu.classList.add('hidden');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    function initDarkMode() {
        const toggle = $('[data-dark-mode-toggle]');
        const stored = localStorage.getItem(STORAGE_KEYS.darkMode);

        if (stored === 'true') {
            document.body.classList.add('dark-mode');
            document.documentElement.dataset.theme = 'dark';
        }

        if (!toggle) return;

        toggle.addEventListener('click', () => {
            const enabled = !document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode', enabled);
            document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
            localStorage.setItem(STORAGE_KEYS.darkMode, String(enabled));
            createToast({
                title: enabled ? 'Mode sombre activé' : 'Mode clair activé',
                message: enabled ? 'L’interface passe en mode nuit premium.' : 'L’interface est revenue au thème lumineux.',
                type: 'success'
            });
        });
    }

    function initPricingCards() {
        const cards = $all('[data-plan-card]');
        const selectButtons = $all('[data-select-plan]');
        const priceSummary = $('[data-selected-plan-summary]');
        const planDrawer = $('[data-onboarding-modal]');

        const renderSummary = (planId) => {
            const plan = PLAN_DATA[planId];
            if (!plan) return;

            if (priceSummary) {
                priceSummary.innerHTML = `
                    <div class="plan-badge">${escapeHtml(plan.badge)}</div>
                    <h3 style="font-size:1.6rem;margin:0.9rem 0 0.35rem;">${escapeHtml(plan.name)}</h3>
                    <div class="price-tag">
                        <strong>${escapeHtml(plan.price)}</strong>
                        <span class="muted">${escapeHtml(plan.billing)}</span>
                    </div>
                    <p class="muted" style="margin:0.95rem 0 0;line-height:1.8;">${escapeHtml(plan.description)}</p>
                    <ul class="summary-list">
                        ${plan.highlights.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}
                    </ul>
                `;
            }
        };

        const setActivePlan = (planId) => {
            if (!PLAN_DATA[planId]) return;

            localStorage.setItem(STORAGE_KEYS.plan, planId);
            cards.forEach((card) => card.classList.toggle('featured', card.dataset.planCard === planId));
            $all('[data-plan-name]').forEach((node) => {
                node.textContent = PLAN_DATA[planId].name;
            });
            renderSummary(planId);
        };

        cards.forEach((card) => {
            card.addEventListener('click', () => {
                setActivePlan(card.dataset.planCard);
            });
        });

        selectButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const planId = button.dataset.selectPlan;
                setActivePlan(planId);
                if (planDrawer) {
                    openModal(planDrawer);
                }
                createToast({
                    title: 'Plan activé avec succès',
                    message: `Le plan ${PLAN_DATA[planId].name} a été enregistré dans votre espace.`,
                    type: 'success'
                });
            });
        });

        const storedPlan = localStorage.getItem(STORAGE_KEYS.plan);
        setActivePlan(PLAN_DATA[storedPlan] ? storedPlan : 'pro');
    }

    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        const firstInput = $('input, select, textarea', modal);
        if (firstInput) {
            window.setTimeout(() => firstInput.focus(), 120);
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function initOnboardingModal() {
        const modal = $('[data-onboarding-modal]');
        if (!modal) return;

        const openTriggers = $all('[data-open-onboarding]');
        const closeTriggers = $all('[data-close-onboarding]');
        const form = $('[data-onboarding-form]', modal);
        const restaurantNameInput = $('[name="restaurantName"]', modal);
        const tablesInput = $('[name="tableCount"]', modal);
        const planInput = $('[name="planId"]', modal);

        openTriggers.forEach((trigger) => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                const currentPlan = localStorage.getItem(STORAGE_KEYS.plan) || 'pro';
                if (planInput) planInput.value = currentPlan;
                openModal(modal);
            });
        });

        closeTriggers.forEach((trigger) => {
            trigger.addEventListener('click', () => closeModal(modal));
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal(modal);
        });

        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeModal(modal);
        });

        if (!form) return;

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const restaurantName = restaurantNameInput?.value.trim() || '';
            const tableCount = Number(tablesInput?.value || 0);
            const planId = planInput?.value || localStorage.getItem(STORAGE_KEYS.plan) || 'pro';
            const selectedPlan = PLAN_DATA[planId] ? planId : 'pro';

            if (!restaurantName || tableCount < 1) {
                createToast({
                    title: 'Formulaire incomplet',
                    message: 'Veuillez renseigner le nom du restaurant et le nombre de tables.',
                    type: 'error'
                });
                return;
            }

            const restaurantSlug = restaurantName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            const profile = {
                restaurantName,
                tableCount,
                planId: selectedPlan,
                slug: restaurantSlug,
                createdAt: new Date().toISOString()
            };

            setStoredJSON(STORAGE_KEYS.restaurant, profile);
            localStorage.setItem(STORAGE_KEYS.plan, selectedPlan);

            createToast({
                title: 'Espace créé avec succès',
                message: 'Votre restaurant digital a été préparé dans la simulation SaaS.',
                type: 'success'
            });

            closeModal(modal);
            window.setTimeout(() => {
                window.location.href = './dashboard.html';
            }, 650);
        });
    }

    function initDemoButtons() {
        const scannerButton = $('[data-open-client-demo]');
        if (scannerButton) {
            scannerButton.addEventListener('click', () => {
                window.open('/client/index.html', '_blank', 'noopener,noreferrer');
            });
        }

        const quickButtons = $all('[data-quick-link]');
        quickButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const url = button.dataset.quickLink;
                if (!url) return;
                window.location.href = url;
            });
        });
    }

    function initCopyActions() {
        const buttons = $all('[data-copy]');
        buttons.forEach((button) => {
            button.addEventListener('click', async () => {
                const value = button.dataset.copy || '';
                if (!value) return;

                try {
                    await navigator.clipboard.writeText(value);
                    createToast({
                        title: 'Copié',
                        message: `Le texte "${value}" a été copié.`,
                        type: 'success'
                    });
                } catch {
                    createToast({
                        title: 'Copie impossible',
                        message: 'Votre navigateur a bloqué l’accès au presse-papiers.',
                        type: 'error'
                    });
                }
            });
        });
    }

    function initIntersectionAnimations() {
        const elements = $all('[data-animate]');
        if (!elements.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.15,
                rootMargin: '0px 0px -80px 0px'
            }
        );

        elements.forEach((element) => observer.observe(element));
    }

    function bindNavActiveState() {
        const links = $all('[data-nav-link]');
        if (!links.length) return;

        const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');

        links.forEach((link) => {
            const href = link.getAttribute('href') || '';
            if (href === '#' || href.startsWith('#')) return;
            if (currentPath.endsWith('/')) {
                if (href === './' || href === '/' || href === '/index.html') {
                    link.classList.add('active');
                }
            }
        });
    }

    function init() {
        ensureUiRoots();
        initMobileMenu();
        initDarkMode();
        initPricingCards();
        initOnboardingModal();
        initDemoButtons();
        initCopyActions();
        initIntersectionAnimations();
        bindNavActiveState();

        window.addEventListener('scroll', updateScrollProgress, { passive: true });
        updateScrollProgress();
        hideLoader();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.RestoQRSaaS = {
        openModal,
        closeModal,
        createToast
    };
})();
