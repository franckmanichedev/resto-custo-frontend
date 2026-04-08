/**
 * Gestion de session client
 */

import { api, getCurrentDay, formatDuration } from '../../../shared/js/api.js';
import { store } from '../../../shared/js/store.js';
import { showToast, showLoading, hideLoading } from '../../../shared/js/utils.js';
import { hydrateLocalCart } from './local-cart.js';

class SessionManager {
    constructor() {
        this.sessionTimer = null;
        this.refreshInterval = null;
    }

    async startSession(tableId, qrCode = null) {
        showLoading('Creation de la session...');

        try {
            const payload = qrCode ? { qr_code: qrCode } : { table_id: tableId };
            const response = await api.session.start(payload);
            this.setSession(response.data);
            showToast('Session creee avec succes', 'success');
            return response.data;
        } catch (error) {
            showToast(error.message || 'Erreur creation session', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }

    async restoreSession(sessionToken) {
        try {
            const response = await api.session.getMenu(sessionToken, getCurrentDay());
            this.setSession(response.data);
            return response.data;
        } catch (error) {
            if (error?.status === 410) {
                const tableId = store.get('table')?.id;
                if (tableId) {
                    localStorage.removeItem(`session:${tableId}`);
                }
            }
            console.error('Erreur restauration session:', error);
            return null;
        }
    }

    setSession(sessionData) {
        store.setMultiple({
            session: sessionData.session,
            table: sessionData.table,
            currentDay: sessionData.current_day,
            selectedDay: sessionData.requested_day || sessionData.current_day,
            consultableDays: sessionData.consultable_days || [],
            plats: sessionData.plats || [],
            rawPlats: sessionData.plats || [],
            cart: null,
            orders: sessionData.orders || []
        });

        hydrateLocalCart(sessionData.session?.session_token);
        this.startSessionTimer();
        this.startPeriodicRefresh();

        if (sessionData.session?.session_token) {
            localStorage.setItem(`session:${sessionData.table?.id}`, sessionData.session.session_token);
        }
    }

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

    startPeriodicRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);

        this.refreshInterval = setInterval(async () => {
            try {
                await this.refreshSessionData();
            } catch (error) {
                console.error('Erreur rafraichissement session:', error);
            }
        }, 30000);
    }

    handleSessionExpired() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        if (this.refreshInterval) clearInterval(this.refreshInterval);

        showToast('La session a expire, veuillez scanner a nouveau le QR code', 'warning');

        setTimeout(() => {
            window.location.href = '/client/index.html';
        }, 3000);
    }

    clearSession() {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        if (this.refreshInterval) clearInterval(this.refreshInterval);

        store.setMultiple({
            session: null,
            table: null,
            cart: null,
            orders: [],
            consultableDays: [],
            plats: [],
            rawPlats: []
        });
    }

    async loadMenuForDay(day) {
        const session = store.get('session');
        if (!session?.session_token) return null;

        try {
            const response = await api.session.getMenu(session.session_token, day);
            store.setMultiple({
                session: response.data.session,
                table: response.data.table,
                currentDay: response.data.current_day,
                selectedDay: response.data.requested_day,
                consultableDays: response.data.consultable_days || [],
                plats: response.data.plats || [],
                rawPlats: response.data.plats || [],
                orders: response.data.orders || []
            });
            hydrateLocalCart(response.data.session?.session_token);
            return response.data;
        } catch (error) {
            showToast(error.message || 'Erreur chargement menu', 'error');
            throw error;
        }
    }

    async refreshCart() {
        return hydrateLocalCart();
    }

    async refreshSessionData() {
        const session = store.get('session');
        if (!session?.session_token) return null;

        const response = await api.session.listOrders(session.session_token);
        store.setMultiple({
            session: response.data.session,
            orders: response.data.orders || []
        });
        hydrateLocalCart(session.session_token);
        return response.data;
    }

    async initFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const tableId = params.get('table');
        const code = params.get('code');

        if (tableId) {
            const storedToken = localStorage.getItem(`session:${tableId}`);
            if (storedToken) {
                const restored = await this.restoreSession(storedToken);
                if (restored) return restored;
                localStorage.removeItem(`session:${tableId}`);
            }
            return this.startSession(tableId);
        }

        if (code) {
            return this.startSession(null, code);
        }

        return null;
    }
}

export const sessionManager = new SessionManager();
