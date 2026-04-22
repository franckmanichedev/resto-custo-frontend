import { api } from '../../../shared/api/apiClient.js';
import { showToast, showLoading, hideLoading } from '../../../shared/utils/index.js';
import { adminStore } from '../store/adminStore.js';

class AuthService {
    constructor() {
        this.userData = null;
        this.listeners = [];
        this.isClearingSession = false;

        this.restoreSession();

        api.onTokenChange((token) => {
            if (!token && (this.userData || localStorage.getItem('user'))) {
                this.clearSession({ syncToken: false });
            }
        });
    }

    restoreSession() {
        const token = api.getToken();
        const rawUser = localStorage.getItem('user');

        if (!token || !rawUser) {
            return;
        }

        try {
            this.userData = JSON.parse(rawUser);
            adminStore.setMultiple({
                userData: this.userData,
                user: { uid: this.userData.id, email: this.userData.email }
            });
            this.notifyListeners(true, this.userData);
        } catch (error) {
            console.error('Erreur restauration session admin:', error);
            this.clearSession({ syncToken: false });
        }
    }

    persistUser(userData) {
        this.userData = userData;
        localStorage.setItem('user', JSON.stringify(this.userData));
        adminStore.setMultiple({
            userData: this.userData,
            user: { uid: this.userData.id, email: this.userData.email }
        });
        this.notifyListeners(true, this.userData);
    }

    async login(email, password) {
        showLoading('Connexion en cours...');

        try {
            const response = await api.auth.login(email, password);

            if (response.data?.role !== 'admin') {
                throw new Error('Acces non autorise');
            }

            if (response.idToken) {
                api.setToken(response.idToken);
            }

            this.persistUser(response.data);
            showToast(`Bienvenue ${this.userData.name || this.userData.email}`, 'success');

            return { success: true, userData: this.userData };
        } catch (error) {
            showToast(error.message || 'Erreur de connexion', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }

    async signup(email, password, name, phone = null) {
        showLoading('Creation du compte...');

        try {
            const response = await api.auth.signup({
                email: email.toLowerCase(),
                password,
                passwordConfirm: password,
                name,
                phoneNumber: phone
            });

            if (response.data?.role !== 'admin') {
                throw new Error('Acces non autorise');
            }

            if (response.customToken) {
                api.setToken(response.customToken);
            } else if (response.idToken) {
                api.setToken(response.idToken);
            }

            this.persistUser(response.data);
            showToast('Compte cree avec succes', 'success');

            return { success: true, userData: this.userData };
        } catch (error) {
            showToast(error.message || 'Erreur lors de l inscription', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }

    async logout() {
        try {
            await api.auth.logout();
        } catch (error) {
            console.error('Erreur deconnexion admin:', error);
        } finally {
            this.clearSession({ syncToken: false });
            showToast('Deconnexion reussie', 'info');
        }
    }

    async validateSession() {
        if (!api.getToken() || !this.userData) {
            return false;
        }

        try {
            const response = await api.auth.me();
            const remoteUser = response?.data || response;

            if (!remoteUser || remoteUser.role !== 'admin') {
                this.clearSession();
                return false;
            }

            this.persistUser({
                ...this.userData,
                ...remoteUser
            });

            return true;
        } catch (error) {
            this.clearSession({ syncToken: false });
            return false;
        }
    }

    clearSession(options = {}) {
        const { syncToken = true } = options;

        if (this.isClearingSession) {
            return;
        }

        this.isClearingSession = true;

        try {
            if (syncToken && api.getToken()) {
                api.setToken('');
            } else {
                localStorage.removeItem('authToken');
            }

            localStorage.removeItem('user');
            this.userData = null;
            adminStore.reset();
            this.notifyListeners(false, null);
        } finally {
            this.isClearingSession = false;
        }
    }

    isAdmin() {
        return this.userData?.role === 'admin';
    }

    isAuthenticated() {
        return Boolean(this.userData);
    }

    getUserData() {
        return this.userData;
    }

    onAuthStateChanged(callback) {
        this.listeners.push(callback);
        callback(this.isAuthenticated(), this.userData);

        return () => {
            this.listeners = this.listeners.filter((entry) => entry !== callback);
        };
    }

    notifyListeners(isAuthenticated, userData) {
        this.listeners.forEach((callback) => {
            try {
                callback(isAuthenticated, userData);
            } catch (error) {
                console.error('Erreur listener auth admin:', error);
            }
        });
    }

    requireAdmin(redirectUrl = '/admin/index.html') {
        if (!this.isAdmin()) {
            this.clearSession();
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }
}

export const authService = new AuthService();
