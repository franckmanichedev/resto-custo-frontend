// admin.js - Fonctions globales (sidebar, toasts, dark mode, localStorage)

const STORAGE_KEYS = {
    restaurant: 'restoqr_restaurant',
    plats: 'restoqr_plats',
    commandes: 'restoqr_commandes',
    tables: 'restoqr_tables',
    clients: 'restoqr_clients',
    settings: 'restoqr_settings'
};

// Initialisation des données par défaut
function initDefaultData() {
    if (!localStorage.getItem(STORAGE_KEYS.plats)) {
        const defaultPlats = [
            { id: 'p1', name: 'Burger Signature', description: 'Double steak, cheddar, salade', price: 7500, prepTime: 15, promo: false, decomposable: true, available: true, image: 'https://placehold.co/100x100', category: 'Plats' },
            { id: 'p2', name: 'Salade César', description: 'Poulet, parmesan, croûtons', price: 5500, prepTime: 10, promo: false, decomposable: true, available: true, image: 'https://placehold.co/100x100', category: 'Entrées' },
            { id: 'p3', name: 'Tiramisu', description: 'Café, mascarpone', price: 3500, prepTime: 5, promo: true, decomposable: false, available: true, image: 'https://placehold.co/100x100', category: 'Desserts' }
        ];
        localStorage.setItem(STORAGE_KEYS.plats, JSON.stringify(defaultPlats));
    }
    if (!localStorage.getItem(STORAGE_KEYS.commandes)) {
        const defaultCommandes = [
            { id: 'cmd1', tableId: 't1', tableNumber: '5', status: 'pending', items: [{ name: 'Burger Signature', quantity: 2, price: 7500 }], createdAt: new Date().toISOString() },
            { id: 'cmd2', tableId: 't2', tableNumber: '8', status: 'preparing', items: [{ name: 'Salade César', quantity: 1, price: 5500 }], createdAt: new Date().toISOString() },
            { id: 'cmd3', tableId: 't3', tableNumber: '12', status: 'ready', items: [{ name: 'Tiramisu', quantity: 1, price: 3500 }], createdAt: new Date().toISOString() }
        ];
        localStorage.setItem(STORAGE_KEYS.commandes, JSON.stringify(defaultCommandes));
    }
    if (!localStorage.getItem(STORAGE_KEYS.tables)) {
        const defaultTables = [
            { id: 't1', number: '5', name: 'Table 5', status: 'occupied', qrCode: 'qr-5' },
            { id: 't2', number: '8', name: 'Table 8', status: 'free', qrCode: 'qr-8' },
            { id: 't3', number: '12', name: 'Table 12', status: 'free', qrCode: 'qr-12' }
        ];
        localStorage.setItem(STORAGE_KEYS.tables, JSON.stringify(defaultTables));
    }
    if (!localStorage.getItem(STORAGE_KEYS.clients)) {
        const defaultClients = [
            { id: 'c1', name: 'Jean Dupont', phone: '691234567', email: 'jean@mail.com', ordersCount: 3, lastOrder: '2025-04-01' },
            { id: 'c2', name: 'Marie Diallo', phone: '698765432', email: 'marie@mail.com', ordersCount: 1, lastOrder: '2025-04-02' }
        ];
        localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(defaultClients));
    }
    if (!localStorage.getItem(STORAGE_KEYS.settings)) {
        const defaultSettings = {
            restaurantName: 'Resto QRCode',
            phone: '+237 6XX XXX XXX',
            openingHours: { monday: '12:00-22:00', tuesday: '12:00-22:00', wednesday: '12:00-22:00', thursday: '12:00-22:00', friday: '12:00-23:00', saturday: '12:00-23:00', sunday: '12:00-22:00' },
            isOpen: true
        };
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(defaultSettings));
    }
}

// Notifications toast
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Helpers
function getData(key) {
    return JSON.parse(localStorage.getItem(key)) || [];
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Sidebar toggle mobile
function initSidebar() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

// Dark mode
function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', document.body.classList.contains('dark'));
        });
        if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
    }
}

// Search bar (global)
function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // Chaque page peut implémenter sa propre recherche
            const event = new CustomEvent('globalSearch', { detail: { query: e.target.value } });
            window.dispatchEvent(event);
        });
    }
}

// Restaurant status toggle
function initStatusToggle() {
    const toggle = document.getElementById('restaurantStatusToggle');
    const statusDot = document.getElementById('statusDot');
    if (toggle && statusDot) {
        toggle.addEventListener('click', () => {
            const isOpen = statusDot.classList.contains('closed');
            if (isOpen) {
                statusDot.classList.remove('closed');
                statusDot.classList.add('open');
                statusDot.style.background = '#10b981';
                toggle.textContent = 'Ouvert';
            } else {
                statusDot.classList.remove('open');
                statusDot.classList.add('closed');
                statusDot.style.background = '#ef4444';
                toggle.textContent = 'Fermé';
            }
            const settings = getData(STORAGE_KEYS.settings);
            settings.isOpen = !isOpen;
            saveData(STORAGE_KEYS.settings, settings);
            showToast(`Restaurant ${settings.isOpen ? 'ouvert' : 'fermé'}`, 'success');
        });
        const settings = getData(STORAGE_KEYS.settings);
        if (settings.isOpen) {
            statusDot.classList.remove('closed');
            statusDot.classList.add('open');
            statusDot.style.background = '#10b981';
            toggle.textContent = 'Ouvert';
        } else {
            statusDot.classList.remove('open');
            statusDot.classList.add('closed');
            statusDot.style.background = '#ef4444';
            toggle.textContent = 'Fermé';
        }
    }
}

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    initDefaultData();
    initSidebar();
    initDarkMode();
    initGlobalSearch();
    initStatusToggle();
    // Créer le container toast s'il n'existe pas
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
});

window.showToast = showToast;
window.getData = getData;
window.saveData = saveData;
window.STORAGE_KEYS = STORAGE_KEYS;