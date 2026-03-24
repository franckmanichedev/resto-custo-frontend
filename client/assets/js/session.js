/**
 * Gestion de session client
 */

import { api, getCurrentDay, formatDuration } from '../../shared/js/api.js';
import { store } from '../../shared/js/store.js';
import { showToast, showLoading, hideLoading } from '../../shared/js/utils.js';

class SessionManager {
    constructor() {
        this.sessionTimer = null;
        this.refreshInterval = null;
    }
    
    /**
     * Démarrer une session
     */
    async startSession(tableId, qrCode = null) {
        showLoading('Création de la session...');
        
        try {
            const payload = qrCode 
                ? { qr_code: qrCode }
                : { table_id: tableId };
            
            const response = await api.session.start(payload);
            
            this.setSession(response.data);
            
            showToast('Session créée avec succès', 'success');
            return response.data;
            
        } catch (error) {
            showToast(error.message || 'Erreur création session', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }
    
    /**
     * Restaurer une session existante
     */
    async restoreSession(sessionToken) {
        try {
            const response = await api.session.getMenu(sessionToken, getCurrentDay());
            this.setSession(response.data);
            return response.data;
        } catch (error) {
            console.error('Erreur restauration session:', error);
            return null;
        }
    }
    
    /**
     * Définir la session dans le store
     */
    setSession(sessionData) {
        store.setMultiple({
            session: sessionData.session,
            table: sessionData.table,
            currentDay: sessionData.current_day,
            selectedDay: sessionData.requested_day || sessionData.current_day,
            plats: sessionData.plats || [],
            rawPlats: sessionData.plats || [],
            cart: sessionData.cart,
            orders: sessionData.orders || []
        });
        
        // Démarrer le timer de session
        this.startSessionTimer();
        
        // Démarrer le rafraîchissement périodique
        this.startPeriodicRefresh();
        
        // Sauvegarder le token de session
        if (sessionData.session?.session_token) {
            localStorage.setItem(`session:${sessionData.table?.id}`, sessionData.session.session_token);
        }
    }
    
    /**
     * Démarrer le timer de session
     */
    startSessionTimer() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        
        const timerElement = document.getElementById('session-timer');
        if (!timerElement) return;
        
        this.sessionTimer = setInterval(() => {
            const session = store.get('session');
            if (!session?.expires_at) {
                timerElement.textContent = '--:--';
                return;
            }
            
            const remaining = Math.max(0, Math.floor((new Date(session.expires_at) - Date.now()) / 1000));
            timerElement.textContent = formatDuration(remaining);
            
            if (remaining <= 0) {
                this.handleSessionExpired();
            }
        }, 1000);
    }
    
    /**
     * Démarrer le rafraîchissement périodique
     */
    startPeriodicRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        this.refreshInterval = setInterval(async () => {
            const session = store.get('session');
            if (!session?.session_token) return;
            
            try {
                const response = await api.session.getCart(session.session_token);
                store.setMultiple({
                    session: response.data.session,
                    cart: response.data.cart,
                    orders: response.data.orders || []
                });
            } catch (error) {
                console.error('Erreur rafraîchissement session:', error);
            }
        }, 30000); // Rafraîchir toutes les 30 secondes
    }
    
    /**
     * Gérer l'expiration de session
     */
    handleSessionExpired() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        showToast('La session a expiré, veuillez scanner à nouveau le QR code', 'warning');
        
        // Rediriger vers la page d'accueil
        setTimeout(() => {
            window.location.href = '/client/index.html';
        }, 3000);
    }
    
    /**
     * Nettoyer la session
     */
    clearSession() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        
        store.setMultiple({
            session: null,
            table: null,
            cart: null,
            orders: [],
            plats: [],
            rawPlats: []
        });
    }
    
    /**
     * Rafraîchir le menu pour un jour donné
     */
    async loadMenuForDay(day) {
        const session = store.get('session');
        if (!session?.session_token) return;
        
        try {
            const response = await api.session.getMenu(session.session_token, day);
            
            store.setMultiple({
                session: response.data.session,
                table: response.data.table,
                currentDay: response.data.current_day,
                selectedDay: response.data.requested_day,
                plats: response.data.plats || [],
                rawPlats: response.data.plats || [],
                cart: response.data.cart,
                orders: response.data.orders || []
            });
            
            return response.data;
        } catch (error) {
            showToast(error.message || 'Erreur chargement menu', 'error');
            throw error;
        }
    }
    
    /**
     * Rafraîchir le panier
     */
    async refreshCart() {
        const session = store.get('session');
        if (!session?.session_token) return;
        
        try {
            const response = await api.session.getCart(session.session_token);
            store.setMultiple({
                session: response.data.session,
                cart: response.data.cart,
                orders: response.data.orders || []
            });
            return response.data;
        } catch (error) {
            console.error('Erreur rafraîchissement panier:', error);
            throw error;
        }
    }
    
    /**
     * Initialiser la session depuis l'URL
     */
    async initFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const tableId = params.get('table');
        const code = params.get('code');
        
        if (tableId) {
            // Vérifier si une session existe
            const storedToken = localStorage.getItem(`session:${tableId}`);
            if (storedToken) {
                const restored = await this.restoreSession(storedToken);
                if (restored) return restored;
            }
            return this.startSession(tableId);
        } else if (code) {
            return this.startSession(null, code);
        }
        
        return null;
    }
}

export const sessionManager = new SessionManager();