import { db } from '../infrastructure/firebase/config.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Écouteur pour l'occupation des tables en temps réel.
 * Fusionne les données des tables et des sessions actives pour le dashboard Admin.
 */
export const subscribeToTableOccupancy = (restaurantId, callback) => {
    const tablesRef = collection(db, "tables");
    const sessionsRef = collection(db, "table_sessions");
    const now = new Date().toISOString();

    // 1. Requête pour les tables du restaurant
    const qTables = query(tablesRef, where("tenantId", "==", restaurantId));
    
    // 2. Requête pour les sessions non expirées
    const qSessions = query(
        sessionsRef, 
        where("tenantId", "==", restaurantId),
        where("expires_at", ">", now)
    );

    let tables = [];
    let activeSessions = [];

    const emitUpdates = () => {
        // On croise les données : une table est occupée si son ID est présent dans une session active
        const occupancyData = tables.map(table => {
            const session = activeSessions.find(s => s.table_id === table.id);
            return {
                ...table,
                isOccupied: !!session,
                currentSessionId: session ? session.id : null,
                sessionExpiresAt: session ? session.expires_at : null
            };
        });

        const summary = {
            tables: occupancyData,
            totalTables: tables.length,
            occupiedCount: occupancyData.filter(t => t.isOccupied).length,
            availableCount: tables.length - occupancyData.filter(t => t.isOccupied).length
        };

        callback(summary);
    };

    const unsubTables = onSnapshot(qTables, (snap) => {
        tables = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        emitUpdates();
    });

    const unsubSessions = onSnapshot(qSessions, (snap) => {
        activeSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        emitUpdates();
    });

    // Retourne une fonction pour couper les deux écouteurs d'un coup
    return () => {
        unsubTables();
        unsubSessions();
    };
};