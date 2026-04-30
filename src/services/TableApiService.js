/**
 * Service pour les actions administratives sur les tables
 */
export const tableApiService = {
    /**
     * Appelle l'API pour fermer manuellement une session
     */
    async terminateSession(sessionId) {
        const token = localStorage.getItem('idToken');
        const response = await fetch(`/api/front-office/session/${sessionId}/terminate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la libération de la table');
        }
        return await response.json();
    }
};