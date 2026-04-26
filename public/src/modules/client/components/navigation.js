/**
 * Navigation client - Gestion du routing et de l'interface
 */

import { updateClientViewInUrl } from '../../../app.js';
import { store } from '../store/clientStore.js';
import { showToast } from '../../../shared/utils/index.js';

class ClientNavigation {
    constructor() {
        this.currentView = 'menu';
        this.views = ['menu', 'cart', 'tracking', 'profile'];
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        // Écouter les changements de vue
        store.subscribe('currentView', (view) => {
            updateClientViewInUrl(view);
            this.updateActiveNav(view);
            this.loadView(view);
        });
        
        // Setup des boutons de navigation
        this.setupNavigationButtons();
        
        this.initialized = true;
    }
    
    setupNavigationButtons() {
        // Mobile nav buttons
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view;
                if (view && this.views.includes(view)) {
                    store.set('currentView', view);
                }
            });
        });
        
        // Desktop sidebar buttons
        document.querySelectorAll('.nav-item-desktop').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view;
                if (view && this.views.includes(view)) {
                    store.set('currentView', view);
                }
            });
        });
        
        // Floating cart button
        const floatingCart = document.getElementById('floating-cart');
        if (floatingCart) {
            floatingCart.addEventListener('click', () => {
                store.set('currentView', 'cart');
            });
        }
        
        // Desktop cart button
        const desktopCart = document.getElementById('desktop-cart-btn');
        if (desktopCart) {
            desktopCart.addEventListener('click', () => {
                store.set('currentView', 'cart');
            });
        }
    }
    
    updateActiveNav(view) {
        // Mobile nav
        document.querySelectorAll('[data-view]').forEach(btn => {
            if (btn.dataset.view === view) {
                btn.classList.add('active');
                btn.classList.remove('text-gray-500');
                btn.classList.add('text-primary');
            } else {
                btn.classList.remove('active');
                btn.classList.remove('text-primary');
                btn.classList.add('text-gray-500');
            }
        });
        
        // Desktop sidebar
        document.querySelectorAll('.nav-item-desktop').forEach(btn => {
            if (btn.dataset.view === view) {
                btn.classList.add('bg-gray-100', 'text-primary');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('bg-gray-100', 'text-primary');
                btn.classList.add('text-gray-500');
            }
        });
    }
    
    async loadView(view) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        // Afficher un skeleton loader
        mainContent.innerHTML = `
            <div class="space-y-4">
                <div class="skeleton h-10 w-48 rounded-lg"></div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${Array(6).fill().map(() => `
                        <div class="skeleton h-64 rounded-xl"></div>
                    `).join('')}
                </div>
            </div>
        `;
        
        try {
            // Charger le template correspondant
            const templateId = `${view}-template`;
            const template = document.getElementById(templateId);
            
            if (!template) {
                console.error(`Template ${templateId} non trouvé`);
                return;
            }
            
            const content = template.content.cloneNode(true);
            mainContent.innerHTML = '';
            mainContent.appendChild(content);
            
            // Initialiser la vue
            await this.initView(view);
            
        } catch (error) {
            console.error(`Erreur chargement vue ${view}:`, error);
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
                    <p class="text-gray-600">Erreur de chargement</p>
                    <button onclick="location.reload()" class="mt-4 text-primary font-medium">Réessayer →</button>
                </div>
            `;
        }
    }
    
    async initView(view) {
        // Importer dynamiquement le module de la vue
        try {
            switch(view) {
                case 'menu':
                    const { initMenu } = await import('./menu-page.js');
                    await initMenu();
                    break;
                case 'cart':
                    const { initCart } = await import('./cart-page.js');
                    await initCart();
                    break;
                case 'tracking':
                    const { initTracking } = await import('./tracking-page.js');
                    await initTracking();
                    break;
                case 'profile':
                    const { initProfile } = await import('./profile-page.js');
                    await initProfile();
                    break;
            }
        } catch (error) {
            console.error(`Erreur init vue ${view}:`, error);
            showToast('Erreur d\'initialisation', 'error');
        }
    }
}

export const navigation = new ClientNavigation();
