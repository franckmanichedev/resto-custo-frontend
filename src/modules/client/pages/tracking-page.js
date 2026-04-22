/**
 * Suivi des commandes - Affichage et suivi en temps réel
 */

import { formatPrice, formatDuration } from '../../../shared/api/apiClient.js';
import { escapeHtml, groupItemsByVariant } from '../../../shared/utils/index.js';
import { store, getStatusInfo } from '../store/clientStore.js';
import { sessionManager } from '../services/sessionService.js';

let refreshInterval = null;

export async function initTracking() {
    const orders = store.get('orders') || [];
    
    renderTracking(orders);
    
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        await sessionManager.refreshSessionData();
        const updatedOrders = store.get('orders') || [];
        renderTracking(updatedOrders);
    }, 5000);
    
    const unsubscribe = store.subscribe('orders', (newOrders) => {
        renderTracking(newOrders);
    });
    
    return () => {
        if (refreshInterval) clearInterval(refreshInterval);
        unsubscribe();
    };
}

function renderTracking(orders) {
    const container = document.getElementById('active-orders');
    const noOrders = document.getElementById('no-orders');
    
    if (!container) return;
    
    // Afficher TOUTES les commandes, pas seulement les actives
    if (orders.length === 0) {
        if (noOrders) noOrders.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }
    
    if (noOrders) noOrders.classList.add('hidden');
    
    // Trier les commandes: les commandes actives en premier, puis les servies par date décroissante
    const sortedOrders = [...orders].sort((a, b) => {
        const statusOrder = { pending: 0, preparing: 1, ready: 2, served: 3, cancelled: 4 };
        const orderA = statusOrder[a.status] ?? 5;
        const orderB = statusOrder[b.status] ?? 5;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    container.innerHTML = sortedOrders.map(order => renderOrderCard(order)).join('');
    
    startCountdowns();
}

function renderOrderCard(order) {
    const statusInfo = getStatusInfo(order.status);
    const isServed = order.status === 'served';
    const isCancelled = order.status === 'cancelled';
    
    const estimatedReadyAt = order.estimated_ready_at ? new Date(order.estimated_ready_at) : null;
    const remainingSeconds = estimatedReadyAt ? Math.max(0, Math.floor((estimatedReadyAt - Date.now()) / 1000)) : null;
    
    const groupedItems = groupOrderItems(order.items || []);
    
    // Style différent pour les commandes servies
    const cardClass = isServed 
        ? 'order-card bg-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-80'
        : 'order-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden';
    
    return `
        <div class="${cardClass}" data-order-id="${escapeHtml(order.id)}">
            <!-- En-tête -->
            <div class="${isServed ? 'bg-gray-100' : 'bg-gradient-to-r from-primary/10 to-transparent'} p-4 border-b border-gray-100">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p class="text-xs text-gray-500">Commande</p>
                        <h3 class="font-semibold text-gray-800">#${escapeHtml(order.id?.slice(-8) || order.id)}</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-gray-500">Table</p>
                        <p class="font-medium">${escapeHtml(order.table?.name || order.table_id || '-')}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-gray-500">Total</p>
                        <p class="font-bold text-primary">${formatPrice(order.total_price || 0)}</p>
                    </div>
                </div>
            </div>
            
            <!-- Statut et progression (caché pour les commandes servies) -->
            ${!isServed && !isCancelled ? `
                <div class="p-4 border-b border-gray-100">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-700">Statut</span>
                        <span class="status-badge ${statusInfo.color}">${statusInfo.text}</span>
                    </div>
                    
                    <div class="relative">
                        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div class="progress-bar h-full rounded-full transition-all duration-500" 
                                 style="width: ${statusInfo.progress}%; background-color: ${getProgressColor(order.status)}">
                            </div>
                        </div>
                        <div class="flex justify-between mt-2 text-xs text-gray-500">
                            <span>Commandé</span>
                            <span>En préparation</span>
                            <span>Prêt</span>
                            <span>Servi</span>
                        </div>
                    </div>
                    
                    ${remainingSeconds !== null ? `
                        <div class="mt-3 flex items-center gap-2 text-sm">
                            <i class="fas fa-hourglass-half text-primary"></i>
                            <span>Temps estimé restant : </span>
                            <span class="countdown font-mono font-bold text-primary" data-target="${escapeHtml(order.estimated_ready_at)}">
                                ${formatDuration(remainingSeconds)}
                            </span>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="p-4 border-b border-gray-100">
                    <div class="flex items-center gap-2">
                        ${isServed ? `
                            <i class="fas fa-check-circle text-green-500 text-xl"></i>
                            <span class="text-green-600 font-medium">Commande servie</span>
                            <span class="text-sm text-gray-500 ml-auto">${new Date(order.served_at || order.updatedAt).toLocaleString('fr-FR')}</span>
                        ` : ''}
                        ${isCancelled ? `
                            <i class="fas fa-times-circle text-red-500 text-xl"></i>
                            <span class="text-red-600 font-medium">Commande annulée</span>
                        ` : ''}
                    </div>
                </div>
            `}
            
            <!-- Liste des plats -->
            <div class="p-4 space-y-3">
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Votre commande</p>
                ${groupedItems.map(group => `
                    <div class="border-l-2 border-primary/30 pl-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-medium text-gray-800">${escapeHtml(group.plat_name)}</p>
                                ${renderItemTaxonomy(group)}
                                <p class="text-sm text-gray-500">Quantité: ${group.total_quantity}</p>
                            </div>
                            <span class="text-sm font-medium">${formatPrice(group.total_price)}</span>
                        </div>
                        
                        ${group.variants.length > 1 || (group.variants[0]?.label !== 'Standard') ? `
                            <div class="mt-2 space-y-2">
                                ${group.variants.map(variant => `
                                    <div class="text-sm bg-gray-50 rounded-lg p-2">
                                        <div class="flex justify-between">
                                            <span class="font-medium text-gray-700">${escapeHtml(variant.label)}</span>
                                            <span class="text-gray-500">x${variant.quantity}</span>
                                        </div>
                                        ${variant.compositions.length ? `
                                            <div class="flex flex-wrap gap-1 mt-1">
                                                ${variant.compositions.map(comp => `
                                                    <span class="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                                        ${escapeHtml(comp.action)} ${escapeHtml(comp.composition_name || comp.composition_id)}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${isServed ? `
                <div class="p-4 bg-gray-50 border-t border-gray-100">
                    <p class="text-xs text-gray-400 text-center">
                        <i class="fas fa-clock mr-1"></i>
                        Commandé le ${new Date(order.createdAt).toLocaleString('fr-FR')}
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

function renderItemTaxonomy(item) {
    const labels = [];

    if (item.kind) {
        labels.push({
            text: item.kind === 'boisson' ? 'Boisson' : 'Plat',
            classes: 'bg-gray-100 text-gray-700'
        });
    }

    if (item.categorie_name) {
        labels.push({
            text: item.categorie_name,
            classes: 'bg-yellow-50 text-yellow-700'
        });
    }

    if (item.type_categorie_name) {
        labels.push({
            text: item.type_categorie_name,
            classes: 'bg-blue-50 text-blue-700'
        });
    }

    if (!labels.length) return '';

    return `
        <div class="mt-1 flex flex-wrap gap-2">
            ${labels.map((label) => `
                <span class="rounded-full px-2 py-0.5 text-xs font-medium ${label.classes}">
                    ${escapeHtml(label.text)}
                </span>
            `).join('')}
        </div>
    `;
}

function groupOrderItems(items) {
    const groups = {};
    
    items.forEach(item => {
        const key = item.plat_id || item.plat_name;
        if (!groups[key]) {
            groups[key] = {
                plat_name: item.plat_name,
                plat_id: item.plat_id,
                kind: item.kind || null,
                categorie_name: item.categorie_name || null,
                type_categorie_name: item.type_categorie_name || null,
                total_quantity: 0,
                total_price: 0,
                variants: []
            };
        }
        
        groups[key].total_quantity += item.quantity;
        groups[key].total_price += item.total_price;
        
        const variantGroups = groupItemsByVariant([item]);
        variantGroups.forEach(variant => {
            groups[key].variants.push({
                ...variant,
                quantity: variant.quantity,
                compositions: variant.compositions
            });
        });
    });
    
    return Object.values(groups);
}

function getProgressColor(status) {
    const colors = {
        pending: '#F59E0B',
        preparing: '#3B82F6',
        ready: '#10B981',
        served: '#6B7280',
        cancelled: '#EF4444'
    };
    return colors[status] || '#C17B4A';
}

function startCountdowns() {
    const countdownElements = document.querySelectorAll('.countdown');
    
    const updateCountdowns = () => {
        countdownElements.forEach(el => {
            const target = el.dataset.target;
            if (!target) return;
            
            const remaining = Math.max(0, Math.floor((new Date(target) - Date.now()) / 1000));
            el.textContent = formatDuration(remaining);
            
            if (remaining === 0) {
                el.classList.add('text-green-600');
                el.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Prêt !';
            }
        });
    };
    
    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    
    return () => clearInterval(interval);
}
