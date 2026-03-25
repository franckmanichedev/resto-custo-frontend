// App State
const App = {
    currentView: 'menu',
    cart: [],
    customer: {
        name: '',
        phone: '',
        guests: 2
    },
    activeOrders: [],
    sessionTimer: null,
    sessionSeconds: 3600, // 60 minutes
    tableId: 'table_123', // À récupérer depuis l'URL ou QR code
    tableNumber: '12'
};

// Mock Data (À remplacer par API)
const mockPlats = [
    { id: 1, name: 'Tartare de Boeuf', description: 'Boeuf charolais coupé au couteau, oignons, câpres, cornichons, sauce maison', price: 18.90, prepTime: 15, category: 'main', image: 'https://picsum.photos/id/127/400/300', isDecomposable: true },
    { id: 2, name: 'Soupe à l\'Oignon', description: 'Gratinée à l\'emmental, croûtons dorés', price: 9.50, prepTime: 10, category: 'starter', image: 'https://picsum.photos/id/128/400/300', isDecomposable: false },
    { id: 3, name: 'Magret de Canard', description: 'Sauce au miel et épices, pommes grenailles rôties', price: 24.90, prepTime: 20, category: 'main', image: 'https://picsum.photos/id/129/400/300', isDecomposable: true },
    { id: 4, name: 'Crème Brûlée', description: 'Vanille de Madagascar, caramel croquant', price: 7.90, prepTime: 5, category: 'dessert', image: 'https://picsum.photos/id/130/400/300', isDecomposable: false },
    { id: 5, name: 'Mojito', description: 'Rhum blanc, menthe fraîche, citron vert', price: 8.90, prepTime: 5, category: 'drink', image: 'https://picsum.photos/id/131/400/300', isDecomposable: false },
    { id: 6, name: 'Steak Frites', description: 'Entrecôte grillée, frites maison, sauce au poivre', price: 22.90, prepTime: 18, category: 'main', image: 'https://picsum.photos/id/132/400/300', isDecomposable: true },
];

// DOM Elements
let currentActiveNav = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadCustomerData();
    setupNavigation();
    setupEventListeners();
    startSessionTimer();
    loadView('menu');
});

// Load customer data from localStorage
function loadCustomerData() {
    const saved = localStorage.getItem('resto_customer');
    if (saved) {
        App.customer = JSON.parse(saved);
        document.getElementById('customer-name') && (document.getElementById('customer-name').value = App.customer.name);
        document.getElementById('customer-phone') && (document.getElementById('customer-phone').value = App.customer.phone);
        document.getElementById('guests-count') && (document.getElementById('guests-count').innerText = App.customer.guests);
    }
}

// Save customer data
function saveCustomerData() {
    localStorage.setItem('resto_customer', JSON.stringify(App.customer));
}

// Setup Navigation
function setupNavigation() {
    const navButtons = document.querySelectorAll('[data-nav]');
    const desktopNavButtons = document.querySelectorAll('.nav-item-desktop');
    
    const handleNav = (view) => {
        if (view === App.currentView) return;
        App.currentView = view;
        loadView(view);
        updateActiveNav(view);
    };
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            handleNav(btn.dataset.nav);
        });
    });
    
    desktopNavButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const view = btn.dataset.nav;
            if (view) handleNav(view);
        });
    });
}

function updateActiveNav(view) {
    // Update mobile nav
    document.querySelectorAll('[data-nav]').forEach(btn => {
        if (btn.dataset.nav === view) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update desktop nav
    document.querySelectorAll('.nav-item-desktop').forEach(btn => {
        if (btn.dataset.nav === view) {
            btn.classList.add('bg-gray-100', 'text-primary');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('bg-gray-100', 'text-primary');
            btn.classList.add('text-gray-500');
        }
    });
}

// Load View
async function loadView(view) {
    const mainContent = document.getElementById('main-content');
    
    switch(view) {
        case 'menu':
            await renderMenu();
            break;
        case 'cart':
            renderCart();
            break;
        case 'track':
            renderTracking();
            break;
        case 'profile':
            renderProfile();
            break;
    }
    
    updateCartBadges();
}

// Render Menu
async function renderMenu() {
    const template = document.getElementById('menu-template');
    const content = template.content.cloneNode(true);
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    mainContent.appendChild(content);
    
    // Load plats
    await renderPlats(mockPlats);
    
    // Setup category filters
    setupCategoryFilters();
}

function renderPlats(plats) {
    const grid = document.getElementById('plats-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const cardTemplate = document.getElementById('plat-card-template');
    
    plats.forEach(plat => {
        const card = cardTemplate.content.cloneNode(true);
        
        card.querySelector('img').src = plat.image;
        card.querySelector('img').alt = plat.name;
        card.querySelector('h3').textContent = plat.name;
        card.querySelector('p').textContent = plat.description;
        card.querySelector('.font-bold.text-primary').textContent = `${plat.price.toFixed(2)} €`;
        card.querySelector('.text-gray-400 span').textContent = plat.prepTime;
        
        const addBtn = card.querySelector('.add-to-cart-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(plat);
        });
        
        card.querySelector('.plat-card').addEventListener('click', () => {
            showPlatDetail(plat);
        });
        
        grid.appendChild(card);
    });
}

function setupCategoryFilters() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            
            // Update active style
            categoryBtns.forEach(b => {
                if (b.dataset.category === category) {
                    b.classList.remove('bg-white', 'border-gray-200', 'text-gray-600');
                    b.classList.add('bg-yellow-500', 'text-white');
                } else {
                    b.classList.remove('bg-yellow-500', 'text-white');
                    b.classList.add('bg-white', 'border-gray-200', 'text-gray-600');
                }
            });
            
            // Filter plats
            const filtered = category === 'all' 
                ? mockPlats 
                : mockPlats.filter(p => p.category === category);
            
            renderPlats(filtered);
        });
    });
}

function showPlatDetail(plat) {
    // Modal for plat detail with compositions if decomposable
    alert(`Détail de ${plat.name}\nPrix: ${plat.price}€\nTemps: ${plat.prepTime}min\n${plat.isDecomposable ? 'Personnalisable ✓' : ''}`);
    // Implémenter une vraie modal ici
}

// Cart Functions
function addToCart(plat, quantity = 1, customizations = null) {
    const existingItem = App.cart.find(item => item.id === plat.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        App.cart.push({
            id: plat.id,
            name: plat.name,
            price: plat.price,
            quantity: quantity,
            prepTime: plat.prepTime,
            image: plat.image,
            customizations: customizations
        });
    }
    
    updateCartBadges();
    showToast(`${plat.name} ajouté au panier`, 'success');
    
    // Auto-save cart
    localStorage.setItem('resto_cart', JSON.stringify(App.cart));
}

function removeFromCart(itemId) {
    App.cart = App.cart.filter(item => item.id !== itemId);
    updateCartBadges();
    localStorage.setItem('resto_cart', JSON.stringify(App.cart));
    
    if (App.currentView === 'cart') {
        renderCart();
    }
}

function updateCartBadges() {
    const totalItems = App.cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Mobile badge
    const mobileBadge = document.getElementById('mobile-cart-badge');
    const floatingBadge = document.getElementById('floating-cart-count');
    const desktopSidebarBadge = document.getElementById('desktop-sidebar-cart-count');
    const desktopCartCount = document.getElementById('desktop-cart-count');
    const floatingCart = document.getElementById('floating-cart');
    
    if (totalItems > 0) {
        mobileBadge && (mobileBadge.textContent = totalItems, mobileBadge.classList.remove('hidden'));
        floatingBadge && (floatingBadge.textContent = totalItems, floatingBadge.classList.remove('hidden'));
        desktopSidebarBadge && (desktopSidebarBadge.textContent = totalItems, desktopSidebarBadge.classList.remove('hidden'));
        desktopCartCount && (desktopCartCount.textContent = totalItems);
        floatingCart && floatingCart.classList.remove('hidden');
    } else {
        mobileBadge && mobileBadge.classList.add('hidden');
        floatingBadge && floatingBadge.classList.add('hidden');
        desktopSidebarBadge && desktopSidebarBadge.classList.add('hidden');
        desktopCartCount && (desktopCartCount.textContent = '0');
        floatingCart && floatingCart.classList.add('hidden');
    }
}

function renderCart() {
    const template = document.getElementById('cart-template');
    const content = template.content.cloneNode(true);
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    mainContent.appendChild(content);
    
    const cartItemsContainer = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartSummary = document.getElementById('cart-summary');
    
    if (App.cart.length === 0) {
        cartEmpty.classList.remove('hidden');
        cartSummary.classList.add('hidden');
        return;
    }
    
    cartEmpty.classList.add('hidden');
    cartSummary.classList.remove('hidden');
    
    const itemTemplate = document.getElementById('cart-item-template');
    
    App.cart.forEach(item => {
        const itemEl = itemTemplate.content.cloneNode(true);
        
        // Set image background
        const imgDiv = itemEl.querySelector('.w-20.h-20');
        imgDiv.style.backgroundImage = `url(${item.image})`;
        imgDiv.style.backgroundSize = 'cover';
        imgDiv.style.backgroundPosition = 'center';
        
        itemEl.querySelector('h4').textContent = item.name;
        itemEl.querySelector('.font-bold.text-primary').textContent = `${(item.price * item.quantity).toFixed(2)} €`;
        itemEl.querySelector('.qty').textContent = item.quantity;
        
        // Quantity buttons
        const decreaseBtn = itemEl.querySelector('.decrease-qty');
        const increaseBtn = itemEl.querySelector('.increase-qty');
        const removeBtn = itemEl.querySelector('.remove-item');
        
        decreaseBtn.addEventListener('click', () => {
            if (item.quantity > 1) {
                item.quantity--;
                updateCartBadges();
                renderCart();
            } else {
                removeFromCart(item.id);
            }
        });
        
        increaseBtn.addEventListener('click', () => {
            item.quantity++;
            updateCartBadges();
            renderCart();
        });
        
        removeBtn.addEventListener('click', () => {
            removeFromCart(item.id);
        });
        
        cartItemsContainer.appendChild(itemEl);
    });
    
    // Update totals
    const subtotal = App.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} €`;
    document.getElementById('tax').textContent = `${tax.toFixed(2)} €`;
    document.getElementById('total').textContent = `${total.toFixed(2)} €`;
    
    // Validate order button
    const validateBtn = document.getElementById('validate-order');
    validateBtn.addEventListener('click', validateOrder);
}

function validateOrder() {
    if (App.cart.length === 0) {
        showToast('Votre panier est vide', 'error');
        return;
    }
    
    if (!App.customer.name) {
        showToast('Veuillez renseigner votre nom', 'warning');
        loadView('profile');
        return;
    }
    
    // Create order
    const order = {
        id: 'ORD-' + Date.now(),
        items: [...App.cart],
        subtotal: App.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        total: App.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.10,
        customer: App.customer,
        table: App.tableNumber,
        status: 'pending',
        createdAt: new Date().toISOString(),
        estimatedReadyAt: new Date(Date.now() + 30 * 60000).toISOString()
    };
    
    // Save order
    App.activeOrders.unshift(order);
    localStorage.setItem('resto_orders', JSON.stringify(App.activeOrders));
    
    // Clear cart
    App.cart = [];
    localStorage.removeItem('resto_cart');
    updateCartBadges();
    
    showToast('Commande envoyée !', 'success');
    loadView('track');
}

// Render Tracking
function renderTracking() {
    const template = document.getElementById('track-template');
    const content = template.content.cloneNode(true);
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    mainContent.appendChild(content);
    
    const activeOrdersContainer = document.getElementById('active-orders');
    const noOrders = document.getElementById('no-orders');
    
    // Load orders from localStorage
    const savedOrders = localStorage.getItem('resto_orders');
    if (savedOrders) {
        App.activeOrders = JSON.parse(savedOrders);
    }
    
    const active = App.activeOrders.filter(order => order.status !== 'served' && order.status !== 'cancelled');
    
    if (active.length === 0) {
        noOrders.classList.remove('hidden');
        return;
    }
    
    noOrders.classList.add('hidden');
    
    const orderTemplate = document.getElementById('order-item-template');
    
    active.forEach(order => {
        const orderEl = orderTemplate.content.cloneNode(true);
        
        const statusMap = {
            pending: { text: 'En attente', color: 'bg-yellow-100 text-yellow-700', progress: 25 },
            preparing: { text: 'En préparation', color: 'bg-blue-100 text-blue-700', progress: 60 },
            ready: { text: 'Prêt à servir', color: 'bg-green-100 text-green-700', progress: 90 },
            served: { text: 'Servi', color: 'bg-gray-100 text-gray-700', progress: 100 }
        };
        
        const statusInfo = statusMap[order.status] || statusMap.pending;
        
        orderEl.querySelector('.bg-orange-100').textContent = `#${order.id}`;
        orderEl.querySelector('.bg-orange-100').classList.add(statusInfo.color);
        orderEl.querySelector('.bg-orange-100').classList.remove('bg-orange-100', 'text-orange-700');
        orderEl.querySelector('h3').textContent = `Commande ${order.id}`;
        orderEl.querySelector('.table-num').textContent = order.table;
        orderEl.querySelector('.font-bold.text-primary').textContent = `${order.total.toFixed(2)} €`;
        orderEl.querySelector('.status-badge').textContent = statusInfo.text;
        orderEl.querySelector('.status-badge').classList.add(statusInfo.color.split(' ')[0], statusInfo.color.split(' ')[1]);
        
        // Items list
        const itemsList = orderEl.querySelector('.space-y-2');
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex justify-between text-sm';
            itemDiv.innerHTML = `
                <span>${item.quantity}x ${item.name}</span>
                <span class="text-gray-600">${(item.price * item.quantity).toFixed(2)} €</span>
            `;
            itemsList.appendChild(itemDiv);
        });
        
        // Progress bar
        const progressBar = orderEl.querySelector('.progress-bar');
        progressBar.style.width = `${statusInfo.progress}%`;
        progressBar.style.backgroundColor = order.status === 'pending' ? '#F59E0B' : (order.status === 'preparing' ? '#3B82F6' : '#10B981');
        
        orderEl.querySelector('.progress-text').textContent = statusInfo.text;
        
        activeOrdersContainer.appendChild(orderEl);
    });
}

// Render Profile
function renderProfile() {
    const template = document.getElementById('profile-template');
    const content = template.content.cloneNode(true);
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    mainContent.appendChild(content);
    
    document.getElementById('customer-name').value = App.customer.name;
    document.getElementById('customer-phone').value = App.customer.phone;
    document.getElementById('guests-count').innerText = App.customer.guests;
    
    // Save button
    const saveBtn = document.getElementById('save-profile');
    const guestsMinus = document.getElementById('guests-minus');
    const guestsPlus = document.getElementById('guests-plus');
    
    saveBtn.addEventListener('click', () => {
        App.customer.name = document.getElementById('customer-name').value;
        App.customer.phone = document.getElementById('customer-phone').value;
        saveCustomerData();
        showToast('Informations enregistrées', 'success');
    });
    
    guestsMinus.addEventListener('click', () => {
        if (App.customer.guests > 1) {
            App.customer.guests--;
            document.getElementById('guests-count').innerText = App.customer.guests;
            saveCustomerData();
        }
    });
    
    guestsPlus.addEventListener('click', () => {
        if (App.customer.guests < 20) {
            App.customer.guests++;
            document.getElementById('guests-count').innerText = App.customer.guests;
            saveCustomerData();
        }
    });
}

// Session Timer
function startSessionTimer() {
    const timerElement = document.getElementById('session-timer');
    if (!timerElement) return;
    
    App.sessionTimer = setInterval(() => {
        if (App.sessionSeconds <= 0) {
            clearInterval(App.sessionTimer);
            timerElement.textContent = 'Expirée';
            showToast('Session expirée, veuillez scanner à nouveau le QR code', 'warning');
            return;
        }
        
        App.sessionSeconds--;
        const minutes = Math.floor(App.sessionSeconds / 60);
        const seconds = App.sessionSeconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    toast.className = `fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-80 ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in-up`;
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span class="flex-1 text-sm">${message}</span>
            <button class="toast-close text-white/80 hover:text-white">×</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// Setup additional event listeners
function setupEventListeners() {
    // Floating cart button
    const floatingCart = document.getElementById('floating-cart');
    if (floatingCart) {
        floatingCart.addEventListener('click', () => loadView('cart'));
    }
    
    const desktopCartBtn = document.getElementById('desktop-cart-btn');
    if (desktopCartBtn) {
        desktopCartBtn.addEventListener('click', () => loadView('cart'));
    }
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem('resto_cart');
    if (savedCart) {
        App.cart = JSON.parse(savedCart);
        updateCartBadges();
    }
    
    // Load orders from localStorage
    const savedOrders = localStorage.getItem('resto_orders');
    if (savedOrders) {
        App.activeOrders = JSON.parse(savedOrders);
    }
    
    // Set table number (from URL or localStorage)
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    if (tableParam) {
        App.tableNumber = tableParam;
        document.getElementById('table-number') && (document.getElementById('table-number').textContent = tableParam);
    }
}