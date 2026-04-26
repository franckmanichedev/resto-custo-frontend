import { api } from '../../../shared/api/apiClient.js';
import { getRoleScope } from '../../../shell/guards/authGuard.js';

class PlatformAuthService {
    constructor() {
        this.userData = null;
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
            const parsedUser = JSON.parse(rawUser);
            if (getRoleScope(parsedUser?.role) !== 'platform') {
                this.clearSession({ syncToken: false });
                return;
            }

            this.userData = parsedUser;
        } catch (error) {
            console.error('Erreur restauration session plateforme:', error);
            this.clearSession({ syncToken: false });
        }
    }

    persistUser(userData) {
        if (getRoleScope(userData?.role) !== 'platform') {
            throw new Error('Cet espace est reserve aux utilisateurs plateforme.');
        }

        this.userData = userData;
        localStorage.setItem('user', JSON.stringify(userData));
    }

    async login(email, password) {
        const response = await api.auth.login(email, password);
        const userData = response?.data || null;

        if (getRoleScope(userData?.role) !== 'platform') {
            throw new Error('Ce compte n appartient pas a l espace plateforme.');
        }

        if (response?.idToken) {
            api.setToken(response.idToken);
        }

        this.persistUser(userData);
        return userData;
    }

    async validateSession() {
        if (!api.getToken() || !this.userData) {
            return false;
        }

        try {
            const response = await api.auth.me();
            const remoteUser = response?.data || response;

            if (getRoleScope(remoteUser?.role) !== 'platform') {
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

    async logout() {
        try {
            await api.auth.logout();
        } catch (error) {
            console.error('Erreur deconnexion plateforme:', error);
        } finally {
            this.clearSession({ syncToken: false });
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
        } finally {
            this.isClearingSession = false;
        }
    }

    isPlatformUser() {
        return getRoleScope(this.userData?.role) === 'platform';
    }

    getUserData() {
        return this.userData;
    }

    requirePlatform(redirectUrl = '/platform/login.html') {
        if (!this.isPlatformUser()) {
            this.clearSession();
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }
}

export const platformAuthService = new PlatformAuthService();
