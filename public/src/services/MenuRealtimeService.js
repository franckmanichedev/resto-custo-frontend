import { db } from '../infrastructure/firebase/config.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Écoute les changements sur les articles du menu (prix, disponibilité)
 */
export const subscribeToMenuUpdates = (tenantId, callback) => {
    const menuRef = collection(db, "menu_items");
    
    const q = query(
        menuRef,
        where("tenantId", "==", tenantId),
        where("is_available", "==", true) // Optionnel : écouter seulement les dispos
    );

    return onSnapshot(q, (snapshot) => {
        const menuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(menuItems);
    }, (error) => {
        console.error("Erreur temps réel menu:", error);
    });
};