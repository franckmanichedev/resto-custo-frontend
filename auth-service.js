/**
 * Frontend Authentication Service
 * Gère l'authentification avec Firebase et le backend
 */

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_API_BASE_URLS = {
    development: 'http://localhost:5000/api',
    production: 'https://resto-custo.onrender.com/api'
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const resolveApiBaseUrl = () => {
    const configuredValue = import.meta.env.VITE_API_URL
        || (import.meta.env.PROD
            ? import.meta.env.VITE_API_URL_PRODUCTION
            : import.meta.env.VITE_API_URL_DEVELOPMENT);

    if (configuredValue) {
        return normalizeBaseUrl(configuredValue);
    }

    return import.meta.env.PROD
        ? DEFAULT_API_BASE_URLS.production
        : DEFAULT_API_BASE_URLS.development;
};

const API_BASE_URL = resolveApiBaseUrl();

class AuthService {
    constructor() {
        this.currentUser = null;
        this.userData = null;
    }

    /**
     * Initialise la persistance de session Firebase
     */
    async initPersistence() {
        try {
            await setPersistence(auth, browserLocalPersistence);
            console.log('Persistance Firebase activée');
        } catch (error) {
            console.error('Erreur persistance Firebase:', error);
        }
    }

    /**
     * Inscription avec email/password
     * @param {string} email
     * @param {string} password
     * @param {string} name
     * @param {string} phone
     * @returns {Promise<Object>}
     */
    async signUp(email, password, name, phone = null) {
        try {
            // 1. Créer l'utilisateur dans Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log('✅ Utilisateur créé dans Firebase Auth:', user.uid);

            // 2. Appeler le backend pour créer l'enregistrement Firestore
            const signupResponse = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.toLowerCase(),
                    password,
                    passwordConfirm: password,
                    name,
                    phoneNumber: phone
                })
            });

            if (!signupResponse.ok) {
                const errorData = await signupResponse.json();
                throw new Error(errorData.message || 'Erreur lors de la création du compte');
            }

            const backendData = await signupResponse.json();
            console.log('✅ Utilisateur créé dans Firestore');

            // 3. Récupérer le token ID
            const idToken = await user.getIdToken();

            // 4. Sauvegarder les données
            this.currentUser = user;
            this.userData = backendData.data;
            localStorage.setItem('authToken', idToken);
            localStorage.setItem('user', JSON.stringify(this.userData));

            return {
                success: true,
                user: this.currentUser,
                userData: this.userData,
                token: idToken
            };
        } catch (error) {
            console.error('❌ Erreur signup:', error.message);
            throw error;
        }
    }

    /**
     * Connexion avec email/password
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async signIn(email, password) {
        try {
            // 1. Authentifier avec Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log('✅ Authentification Firebase réussie');

            // 2. Appeler le backend pour vérifier/récupérer les données utilisateur
            const idToken = await user.getIdToken();
            
            const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ email, password })
            });

            if (!loginResponse.ok) {
                const errorData = await loginResponse.json();
                throw new Error(errorData.message || 'Erreur lors de la connexion');
            }

            const backendData = await loginResponse.json();

            // 3. Sauvegarder les données
            this.currentUser = user;
            this.userData = backendData.data;
            localStorage.setItem('authToken', idToken);
            localStorage.setItem('user', JSON.stringify(this.userData));

            return {
                success: true,
                user: this.currentUser,
                userData: this.userData,
                token: idToken
            };
        } catch (error) {
            console.error('❌ Erreur signin:', error.message);
            throw error;
        }
    }

    /**
     * Déconnexion
     */
    async signOut() {
        try {
            await firebaseSignOut(auth);
            this.currentUser = null;
            this.userData = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            console.log('✅ Déconnexion réussie');
            return { success: true };
        } catch (error) {
            console.error('❌ Erreur logout:', error.message);
            throw error;
        }
    }

    /**
     * Récupère l'utilisateur actuel
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Récupère les données utilisateur
     */
    getUserData() {
        return this.userData;
    }

    /**
     * Récupère le token actuel
     */
    async getToken() {
        if (!this.currentUser) return null;
        return await this.currentUser.getIdToken();
    }

    /**
     * Initialise un listener sur l'état d'authentification
     */
    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;

            if (user) {
                // Récupérer les données utilisateur depuis Firestore
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        this.userData = userDocSnap.data();
                        localStorage.setItem('user', JSON.stringify(this.userData));
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des données utilisateur:', error);
                }
            } else {
                this.userData = null;
                localStorage.removeItem('user');
            }

            callback(user, this.userData);
        });
    }

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    isAuthenticated() {
        return !!this.currentUser;
    }

    /**
     * Récupère les données depuis localStorage
     */
    static loadFromStorage() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('user');
        
        return {
            token: token ? token : null,
            userData: userData ? JSON.parse(userData) : null
        };
    }
}

export default new AuthService();
