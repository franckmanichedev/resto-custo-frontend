export function initAdminShell() {
    try {
        const body = document.body;

        // Locate sidebar and header (pages may already include them)
        const sidebar = document.querySelector('aside') || document.querySelector('.rq-sidebar');
        const main = document.querySelector('main') || document.querySelector('main[role="main"]');
        const header = main ? main.querySelector('header') : document.querySelector('header');

        if (sidebar) sidebar.classList.add('rq-sidebar');
        if (main) main.classList.add('rq-main');
        if (body) body.classList.add('rq-admin-body');

        // Mobile toggle button
        if (header && !document.getElementById('rq-mobile-toggle')) {
            const btn = document.createElement('button');
            btn.id = 'rq-mobile-toggle';
            btn.type = 'button';
            btn.className = 'md:hidden p-2 mr-3 rounded-lg bg-white/5 text-white';
            btn.setAttribute('aria-label', 'Ouvrir le menu');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z" clip-rule="evenodd"/></svg>';
            // insert at start of header's flex container if exists
            const container = header.querySelector('.max-w-7xl') || header.firstElementChild || header;
            if (container) container.insertBefore(btn, container.firstChild);

            btn.addEventListener('click', () => {
                const open = body.classList.toggle('rq-sidebar-open');
                btn.setAttribute('aria-expanded', String(open));
            });
        }

        // Backdrop for mobile
        if (!document.querySelector('.rq-sidebar-backdrop')) {
            const backdrop = document.createElement('div');
            backdrop.className = 'rq-sidebar-backdrop md:hidden';
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', () => {
                document.body.classList.remove('rq-sidebar-open');
            });
        }

        // Active nav link detection
        const navLinks = document.querySelectorAll('nav a');
        const path = window.location.pathname.split('/').pop().toLowerCase();
        navLinks.forEach((a) => {
            const href = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
            a.classList.remove('rq-nav-active');
            if (href && path && href === path) {
                a.classList.add('rq-nav-active');
            }
        });

        // Simple keyboard shortcut: '/' to focus global search if present
        const search = document.getElementById('globalSearch') || document.querySelector('input[placeholder*="Rechercher"]');
        window.addEventListener('keydown', (ev) => {
            if (ev.key === '/' && document.activeElement.tagName !== 'INPUT' && search) {
                ev.preventDefault();
                search.focus();
            }
        });

        // Close visible dialog on Escape and collapse sidebar
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                const openDialog = document.querySelector('[role="dialog"]:not(.hidden)');
                if (openDialog) {
                    openDialog.classList.add('hidden');
                    openDialog.classList.remove('flex');
                }
                document.body.classList.remove('rq-sidebar-open');
            }
        });

        // Expose small API for dynamic badges
        const pendingBadge = document.getElementById('pendingOrdersBadge') || document.getElementById('notifBadge');
        window.adminShell = window.adminShell || {};
        window.adminShell.setPending = (n) => {
            if (!pendingBadge) return;
            pendingBadge.textContent = String(n || 0);
            pendingBadge.style.display = n > 0 ? 'inline-flex' : 'none';
        };

        // accessibility: ensure nav has aria-label
        const nav = document.querySelector('nav');
        if (nav && !nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Navigation principale');

    } catch (e) {
        // fail silently — shell is enhancement only
        console.error('adminShell init error', e);
    }
}

// Auto-init when imported (pages can call again explicitly)
try { initAdminShell(); } catch (e) {}

export default { initAdminShell };
