(function () {
    const STORAGE_KEYS = {
        reservation: "eclatgourmet.reservation",
        menuFilter: "eclatgourmet.menuFilter"
    };

    const SECTION_IDS = ["story", "menu", "signature", "gallery", "reservation", "infos", "qr"];

    function $(selector, scope = document) {
        return scope.querySelector(selector);
    }

    function $all(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector));
    }

    function createElement(tagName, className, innerHTML) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    function ensureUiRoots() {
        if (!$(".toast-host")) {
            document.body.appendChild(createElement("div", "toast-host"));
        }
    }

    function showToast(title, message, type = "success") {
        const host = $(".toast-host");
        if (!host) return;

        const toast = createElement(
            "div",
            `toast ${type}`,
            `
                <div>
                    <strong>${title}</strong>
                    <p>${message}</p>
                </div>
                <button class="toast-close" type="button" aria-label="Fermer">✕</button>
            `
        );

        host.appendChild(toast);

        const closeToast = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            window.setTimeout(() => toast.remove(), 220);
        };

        $(".toast-close", toast)?.addEventListener("click", closeToast);
        window.setTimeout(closeToast, 3200);
    }

    function hideLoader() {
        const loader = $(".site-loader");
        if (!loader) return;

        window.setTimeout(() => loader.classList.add("is-hidden"), 500);
        window.setTimeout(() => loader.remove(), 900);
    }

    function ensureLoader() {
        if ($(".site-loader")) return;

        const loader = createElement(
            "div",
            "site-loader",
            `
                <div class="loader-card">
                    <div class="loader-ring"></div>
                    <div>
                        <p class="loader-name">Éclat Gourmet</p>
                        <p style="margin:0.35rem 0 0;color:#6b7280;">Restaurant gastronomique à Douala</p>
                    </div>
                </div>
            `
        );

        document.body.prepend(loader);
    }

    function updateScrollProgress() {
        const bar = $(".scroll-progress > span");
        if (!bar) return;

        const total = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0;
        bar.style.width = `${ratio * 100}%`;
    }

    function updateNavbarState() {
        const navbar = $(".navbar-restaurant");
        if (!navbar) return;

        navbar.classList.toggle("is-scrolled", window.scrollY > 12);
    }

    function initMobileMenu() {
        const toggle = $("[data-mobile-menu-toggle]");
        const menu = $("[data-mobile-menu]");
        if (!toggle || !menu) return;

        const closeMenu = () => {
            menu.classList.remove("is-open");
            menu.setAttribute("aria-hidden", "true");
            toggle.setAttribute("aria-expanded", "false");
        };

        toggle.addEventListener("click", () => {
            const isOpen = menu.classList.contains("is-open");
            menu.classList.toggle("is-open", !isOpen);
            menu.setAttribute("aria-hidden", String(isOpen));
            toggle.setAttribute("aria-expanded", String(!isOpen));
        });

        $all(".mobile-menu a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 860) closeMenu();
        });
    }

    function initRevealAnimations() {
        const elements = $all("[data-reveal]");
        if (!elements.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.14,
                rootMargin: "0px 0px -90px 0px"
            }
        );

        elements.forEach((element) => observer.observe(element));
    }

    function getActiveSectionFromScroll() {
        const midpoint = window.scrollY + window.innerHeight * 0.35;
        let currentSection = "story";

        SECTION_IDS.forEach((id) => {
            const section = document.getElementById(id);
            if (!section) return;
            if (section.offsetTop <= midpoint) {
                currentSection = id;
            }
        });

        return currentSection;
    }

    function updateActiveNavLink() {
        const currentSection = getActiveSectionFromScroll();
        $all(".nav-link").forEach((link) => {
            const target = (link.getAttribute("href") || "").replace("#", "");
            link.classList.toggle("is-active", target === currentSection);
        });
    }

    function initParallax() {
        const stage = $("[data-parallax-stage]");
        if (!stage) return;

        const onScroll = () => {
            const offset = Math.min(window.scrollY * 0.08, 28);
            stage.style.backgroundPosition = `center calc(50% + ${offset}px)`;
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    function initMenuFilters() {
        const buttons = $all("[data-menu-filter]");
        const sections = $all("[data-menu-section]");
        if (!buttons.length || !sections.length) return;

        const storedFilter = localStorage.getItem(STORAGE_KEYS.menuFilter) || "all";

        const applyFilter = (filter) => {
            buttons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.menuFilter === filter);
            });

            sections.forEach((section) => {
                const shouldShow = filter === "all" || section.dataset.menuSection === filter;
                section.classList.toggle("is-hidden", !shouldShow);
            });

            localStorage.setItem(STORAGE_KEYS.menuFilter, filter);
        };

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                const filter = button.dataset.menuFilter || "all";
                applyFilter(filter);
            });
        });

        applyFilter(buttons.some((button) => button.dataset.menuFilter === storedFilter) ? storedFilter : "all");
    }

    function formatReservationSummary(values) {
        return `${values.name} · ${values.date} · ${values.time}`;
    }

    function initReservationForm() {
        const form = $("[data-reservation-form]");
        if (!form) return;

        const nameInput = $("#reservation-name");
        const phoneInput = $("#reservation-phone");
        const dateInput = $("#reservation-date");
        const timeInput = $("#reservation-time");

        const today = new Date();
        const minimumDate = today.toISOString().split("T")[0];
        if (dateInput) {
            dateInput.min = minimumDate;
        }

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const values = {
                name: nameInput?.value.trim() || "",
                phone: phoneInput?.value.trim() || "",
                date: dateInput?.value || "",
                time: timeInput?.value || ""
            };

            if (!values.name || !values.phone || !values.date || !values.time) {
                showToast("Réservation incomplète", "Merci de remplir tous les champs du formulaire.", "error");
                return;
            }

            const reservation = {
                ...values,
                createdAt: new Date().toISOString()
            };

            localStorage.setItem(STORAGE_KEYS.reservation, JSON.stringify(reservation));

            showToast(
                "Réservation enregistrée",
                `Votre table a été préparée pour ${formatReservationSummary(values)}.`,
                "success"
            );

            form.reset();
            if (dateInput) dateInput.min = minimumDate;
        });
    }

    function initFooterYear() {
        const yearNode = $("[data-current-year]");
        if (yearNode) {
            yearNode.textContent = String(new Date().getFullYear());
        }
    }

    function bindSmoothScrollCloseMenu() {
        $all('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener("click", () => {
                const menu = $("[data-mobile-menu]");
                const toggle = $("[data-mobile-menu-toggle]");
                if (!menu || !toggle) return;

                menu.classList.remove("is-open");
                menu.setAttribute("aria-hidden", "true");
                toggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    function init() {
        ensureUiRoots();
        ensureLoader();
        initFooterYear();
        initMobileMenu();
        initRevealAnimations();
        initMenuFilters();
        initReservationForm();
        initParallax();
        bindSmoothScrollCloseMenu();

        window.addEventListener("scroll", updateScrollProgress, { passive: true });
        window.addEventListener("scroll", updateNavbarState, { passive: true });
        window.addEventListener("scroll", updateActiveNavLink, { passive: true });

        updateScrollProgress();
        updateNavbarState();
        updateActiveNavLink();
        hideLoader();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
