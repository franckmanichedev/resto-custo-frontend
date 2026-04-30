import { db } from '../infrastructure/firebase/config.js';
import { collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Écouteur pour la Cuisine / Admin (Toutes les commandes actives du restaurant)
 */
export const subscribeToKitchenOrders = (tenantId, callback) => {
    // On cible la collection des commandes pour ce restaurant spécifique
    const ordersRef = collection(db, "commandes");
    
    // Requête : commandes du restaurant, non terminées, triées par date
    const q = query(
        ordersRef,
        where("tenantId", "==", tenantId),
        where("status", "in", ["PENDING", "PREPARING"]),
        orderBy("createdAt", "asc")
    );

    // onSnapshot renvoie une fonction de désabonnement (unsubscribe)
    return onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        // On envoie les données mises à jour au callback (souvent une fonction de rendu UI)
        callback(orders);
    }, (error) => {
        console.error("Erreur temps réel cuisine:", error);
    });
};

/**
 * Écouteur pour le Client (Ses propres commandes liées à sa session)
 */
export const subscribeToMyOrders = (sessionId, callback) => {
    const ordersRef = collection(db, "commandes");
    
    const q = query(
        ordersRef,
        where("session_id", "==", sessionId)
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Tri côté client par date (ou laisser Firestore le faire avec un index)
        callback(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (error) => {
        console.error("Erreur suivi commande client:", error);
    });
};
