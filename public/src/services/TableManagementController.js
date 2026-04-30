import { subscribeToTableOccupancy } from '../../../services/TableRealtimeService.js';
import { tableApiService } from '../../../services/TableApiService.js';
import { adminStore } from '../store/adminStore.js';

/**
 * Contrôleur gérant l'affichage de l'occupation des tables sur le dashboard
 */
export class TableManagementController {
    constructor() {
        this.unsubscribe = null;
    }

    /**
     * Initialise l'écoute temps réel
     */
    init(restaurantId) {
        if (this.unsubscribe) this.unsubscribe();

        this.unsubscribe = subscribeToTableOccupancy(restaurantId, (summary) => {
            // Mise à jour du store global
            adminStore.set('tableSummary', summary);
            
            // Mise à jour de l'UI
            this.renderTableStats(summary);
            this.renderTableGrid(summary.tables);
        });
    }

    renderTableStats(summary) {
        const availableEl = document.getElementById('stats-tables-available');
        const occupiedEl = document.getElementById('stats-tables-occupied');
        
        if (availableEl) availableEl.textContent = summary.availableCount;
        if (occupiedEl) occupiedEl.textContent = summary.occupiedCount;
    }

    renderTableGrid(tables) {
        const grid = document.getElementById('admin-tables-grid');
        if (!grid) return;

        grid.innerHTML = tables.map(table => `
            <div class="order-row fade-up">
                <div class="table-info">
                    <strong>Table ${table.number}</strong>
                    <span class="muted">${table.name || ''}</span>
                </div>
                <div class="table-status">
                    <span class="status-pill ${table.isOccupied ? 'warning' : 'success'}">
                        ${table.isOccupied ? 'Occupée' : 'Disponible'}
                    </span>
                </div>
                <div class="table-actions">
                    ${table.isOccupied ? `
                        <button class="btn btn-secondary btn-sm" 
                                onclick="window.tableController.handleRelease('${table.currentSessionId}')">
                            Libérer
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async handleRelease(sessionId) {
        if (!confirm('Voulez-vous vraiment libérer cette table ? Cela mettra fin à la session client.')) return;

        try {
            adminStore.set('isLoading', true);
            await tableApiService.terminateSession(sessionId);
            // Pas besoin de rafraîchir manuellement, onSnapshot s'en chargera !
        } catch (error) {
            alert(error.message);
        } finally {
            adminStore.set('isLoading', false);
        }
    }
}