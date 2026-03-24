/**
 * Service d'authentification Firebase
 */

import { api } from './api.js';
import { store } from './store.js';
import { showToast, showLoading, hideLoading } from './utils.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this._listeners = [];
        
        // Restaurer la session depuis localStorage
        this.restoreSession();
        
        // Écouter les changements de token
        api.onTokenChange((token) => {
            if (!token) {
                this.clearSession();
            }
        });
    }
    
    /**
     * Restaurer la session
     */
    restoreSession() {
        const token = api.getToken();
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
            try {
                this.userData = JSON.parse(savedUser);
                store.set('userData', this.userData);
                store.set('user', { uid: this.userData.id, email: this.userData.email });
                this.notifyListeners(true, this.userData);
            } catch (e) {
                console.error('Erreur restauration session:', e);
                this.clearSession();
            }
        }
    }
    
    /**
     * Connexion
     */
    async login(email, password) {
        showLoading('Connexion en cours...');
        
        try {
            const response = await api.auth.login(email, password);
            
            if (response.data.role !== 'admin') {
                showToast('Accès réservé aux administrateurs', 'error');
                throw new Error('Accès non autorisé');
            }
            
            // Sauvegarder le token et les données
            if (response.idToken) {
                api.setToken(response.idToken);
            }
            
            this.userData = response.data;
            localStorage.setItem('user', JSON.stringify(this.userData));
            store.set('userData', this.userData);
            store.set('user', { uid: this.userData.id, email: this.userData.email });
            
            this.notifyListeners(true, this.userData);
            showToast(`Bienvenue ${this.userData.name || this.userData.email}`, 'success');
            
            return { success: true, userData: this.userData };
        } catch (error) {
            showToast(error.message || 'Erreur de connexion', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }
    
    /**
     * Inscription
     */
    async signup(email, password, name, phone = null) {
        showLoading('Création du compte...');
        
        try {
            const response = await api.auth.signup({
                email: email.toLowerCase(),
                password,
                passwordConfirm: password,
                name,
                phoneNumber: phone
            });
            
            if (response.data.role !== 'admin') {
                showToast('Compte créé mais accès réservé aux administrateurs', 'warning');
                throw new Error('Accès non autorisé');
            }
            
            // Sauvegarder le token
            if (response.customToken) {
                api.setToken(response.customToken);
            }
            
            this.userData = response.data;
            localStorage.setItem('user', JSON.stringify(this.userData));
            store.set('userData', this.userData);
            store.set('user', { uid: this.userData.id, email: this.userData.email });
            
            this.notifyListeners(true, this.userData);
            showToast('Compte créé avec succès', 'success');
            
            return { success: true, userData: this.userData };
        } catch (error) {
            showToast(error.message || 'Erreur lors de l\'inscription', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }
    
    /**
     * Déconnexion
     */
    async logout() {
        try {
            await api.auth.logout();
            this.clearSession();
            showToast('Déconnexion réussie', 'info');
            return { success: true };
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            this.clearSession();
            return { success: true };
        }
    }
    
    /**
     * Effacer la session
     */
    clearSession() {
        api.setToken('');
        localStorage.removeItem('user');
        this.currentUser = null;
        this.userData = null;
        store.set('userData', null);
        store.set('user', null);
        this.notifyListeners(false, null);
    }
    
    /**
     * Vérifier si l'utilisateur est admin
     */
    isAdmin() {
        return this.userData && this.userData.role === 'admin';
    }
    
    /**
     * Vérifier si l'utilisateur est authentifié
     */
    isAuthenticated() {
        return !!this.userData;
    }
    
    /**
     * Obtenir les données utilisateur
     */
    getUserData() {
        return this.userData;
    }
    
    /**
     * Ajouter un listener sur l'état d'authentification
     */
    onAuthStateChanged(callback) {
        this._listeners.push(callback);
        // Appeler immédiatement avec l'état actuel
        callback(this.isAuthenticated(), this.userData);
        
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index !== -1) this._listeners.splice(index, 1);
        };
    }
    
    /**
     * Notifier les listeners
     */
    notifyListeners(isAuthenticated, userData) {
        this._listeners.forEach(cb => {
            try {
                cb(isAuthenticated, userData);
            } catch (e) {
                console.error('Erreur dans auth listener:', e);
            }
        });
    }
    
    /**
     * Vérifier l'accès admin et rediriger si nécessaire
     */
    requireAdmin(redirectUrl = '/admin/index.html') {
        if (!this.isAdmin()) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }
}

// Instance unique
export const auth = new AuthService();