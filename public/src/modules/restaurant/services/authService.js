import { api } from '../../../shared/api/apiClient.js';
import {
    buildRestaurantTenantId,
    showToast,
    showLoading,
    hideLoading
} from '../../../shared/utils/index.js';
import { adminStore } from '../store/adminStore.js';

const normalizeSignupPayload = (emailOrPayload, password, name, phone) => {
    if (typeof emailOrPayload === 'object' && emailOrPayload !== null) {
        const restaurantName = String(emailOrPayload.restaurantName || '').trim();
        const explicitTenantId = String(
            emailOrPayload.tenantId
            || emailOrPayload.tenant_id
            || emailOrPayload.restaurantId
            || emailOrPayload.restaurant_id
            || ''
        ).trim();
        const tenantId = explicitTenantId || (restaurantName ? buildRestaurantTenantId(restaurantName) : '');

        return {
            email: String(emailOrPayload.email || '').trim().toLowerCase(),
            password: String(emailOrPayload.password || ''),
            name: String(emailOrPayload.name || '').trim(),
            phoneNumber: String(emailOrPayload.phoneNumber || emailOrPayload.phone || '').trim(),
            restaurantName,
            role: String(emailOrPayload.role || 'admin').trim() || 'admin',
            tenantId,
            plan: String(emailOrPayload.plan || '').trim()
        };
    }

    return {
        email: String(emailOrPayload || '').trim().toLowerCase(),
        password: String(password || ''),
        name: String(name || '').trim(),
        phoneNumber: String(phone || '').trim(),
        restaurantName: '',
        role: 'admin',
        tenantId: '',
        plan: ''
    };
};

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

    async signup(emailOrPayload, password, name, phone = null) {
        showLoading('Creation du compte...');

        try {
            const signupPayload = normalizeSignupPayload(emailOrPayload, password, name, phone);
            const response = await api.auth.signup({
                email: signupPayload.email,
                password: signupPayload.password,
                passwordConfirm: signupPayload.password,
                name: signupPayload.name,
                phoneNumber: signupPayload.phoneNumber || undefined,
                role: signupPayload.role,
                tenant_id: signupPayload.tenantId || undefined,
                restaurant_id: signupPayload.tenantId || undefined
            });

            if (response.data?.role !== 'admin') {
                throw new Error('Acces non autorise');
            }

            const sessionToken = response.idToken || response.customToken || '';
            if (!sessionToken) {
                throw new Error('Session securisee indisponible apres l inscription');
            }

            api.setToken(sessionToken);

            this.persistUser(response.data);

            if (signupPayload.restaurantName) {
                localStorage.setItem('selectedRestaurantName', signupPayload.restaurantName);
            }

            if (signupPayload.tenantId) {
                localStorage.setItem('selectedRestaurantTenantId', signupPayload.tenantId);
            }

            if (signupPayload.plan) {
                localStorage.setItem('selectedRestaurantPlan', signupPayload.plan);
            }

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

    requireAdmin(redirectUrl = '/restaurant/login.html') {
        if (!this.isAdmin()) {
            this.clearSession();
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }
}

export const authService = new AuthService();
