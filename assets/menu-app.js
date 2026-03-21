(function attachMenuApp() {
    const { request, escapeHtml, formatPrice, getWeekDayLabel, pushLog } = window.TestApi;

    const state = {
        session: null,
        table: null,
        currentDay: null,
        selectedDay: null,
        consultableDays: [],
        plats: [],
        selectedPlat: null,
        removedCompositionIds: new Set(),
        cart: null,
        orders: [],
        refreshInterval: null
    };

    const $ = (id) => document.getElementById(id);

    const formatDuration = (seconds) => {
        const safe = Math.max(0, Number(seconds || 0));
        const minutes = Math.floor(safe / 60);
        const remaining = safe % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
    };

    const getCountdownMarkup = (entity, className = 'text-lg font-black') => {
        if (entity?.countdown_active && entity?.estimated_ready_at) {
            return `<p class="${className} countdown" data-target="${escapeHtml(entity.estimated_ready_at)}">${formatDuration(entity.remaining_seconds)}</p>`;
        }

        if (entity?.status === 'served') {
            return `<p class="${className} text-emerald-700">Servi</p>`;
        }

        if (entity?.status === 'cancelled') {
            return `<p class="${className} text-rose-700">Annule</p>`;
        }

        return `<p class="${className} text-slate-500">En attente</p>`;
    };

    const setSessionUI = () => {
        $('session-table').textContent = state.table ? `${state.table.name} - ${state.table.number}` : '-';
        $('session-current-day').textContent = state.currentDay ? getWeekDayLabel(state.currentDay) : '-';
        $('menu-title').textContent = state.table ? `Menu de ${state.table.name}` : 'Menu de la table';
        $('menu-subtitle').textContent = state.table
            ? `Session active pour ${state.table.number}. Les plats du jour peuvent etre commandes, les autres jours restent consultables.${state.session?.was_extended ? ' La session a ete prolongee automatiquement car une commande est toujours en cours.' : ''}`
            : 'Scannez le QR code de votre table pour consulter les plats disponibles aujourd hui et passer commande.';
    };

    const renderDayTabs = () => {
        const container = $('day-tabs');
        if (!state.consultableDays.length) {
            container.innerHTML = '<span class="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">Aucun jour disponible</span>';
            return;
        }

        container.innerHTML = state.consultableDays.map((day) => `
            <button type="button" data-day="${day}" class="day-tab rounded-2xl px-4 py-2 text-sm font-bold ${day === state.selectedDay ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}">
                ${escapeHtml(getWeekDayLabel(day))}
            </button>
        `).join('');
    };

    const renderMenu = () => {
        const list = $('menu-list');
        if (!state.plats.length) {
            list.innerHTML = '<div class="col-span-full rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Aucun plat consultable pour ce jour.</div>';
            return;
        }

        list.innerHTML = state.plats.map((plat) => `
            <article class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <div class="h-3 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"></div>
                <div class="p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="text-xl font-black">${escapeHtml(plat.name)}</h2>
                                ${plat.is_promo ? '<span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">Promo</span>' : ''}
                                ${plat.is_orderable_today && state.selectedDay === state.currentDay ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Commandable</span>' : '<span class="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Consultation</span>'}
                            </div>
                            <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(plat.description || 'Aucune description')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-black">${formatPrice(plat.price)}</p>
                            <p class="text-xs text-slate-500">${escapeHtml(plat.prep_time || 0)} min</p>
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${(plat.compositions || []).length
                            ? plat.compositions.map((composition) => `
                                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    ${escapeHtml(composition.name)}${composition.is_allergen ? ' - allergene' : ''}
                                </span>
                            `).join('')
                            : '<span class="text-sm text-slate-500">Aucune decomposition specifique</span>'}
                    </div>
                    <button type="button" data-id="${escapeHtml(plat.id)}" class="open-plat mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
                        Voir le plat
                    </button>
                </div>
            </article>
        `).join('');
    };

    const renderCartSummary = () => {
        const container = $('cart-summary');
        const cart = state.cart;

        if (!cart || !(cart.items || []).length) {
            container.innerHTML = 'Votre panier est vide.';
            return;
        }

        container.innerHTML = `
            <div class="rounded-[1.5rem] bg-amber-50 p-4">
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Resume</p>
                <p class="mt-2 text-sm text-amber-900">${cart.total_items} article(s)</p>
                <p class="text-2xl font-black text-amber-950">${formatPrice(cart.total_price)}</p>
            </div>
            ${(cart.items || []).map((item) => `
                <div class="rounded-[1.5rem] border border-slate-200 p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm font-bold text-slate-900">${escapeHtml(item.plat_name)}</p>
                            <p class="text-xs text-slate-500">Quantite: ${escapeHtml(item.quantity)}</p>
                            <p class="text-xs text-slate-500">Sous-total: ${formatPrice(item.total_price)}</p>
                        </div>
                        <div class="flex flex-col gap-2">
                            <button type="button" data-id="${escapeHtml(item.id)}" class="remove-cart-item rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                                Retirer
                            </button>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        ${(item.compositions || []).length
                            ? item.compositions.map((composition) => `
                                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    ${escapeHtml(composition.action)} - ${escapeHtml(composition.composition_name || composition.composition_id)}
                                </span>
                            `).join('')
                            : '<span class="text-xs text-slate-500">Aucune modification</span>'}
                    </div>
                </div>
            `).join('')}
        `;
    };

    const renderOrderSummary = () => {
        const container = $('order-summary');
        if (!state.orders.length) {
            container.innerHTML = 'Aucune commande envoyee pour le moment.';
            return;
        }

        container.innerHTML = state.orders.map((order) => `
            <div class="rounded-[1.5rem] border border-slate-200 p-4">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="text-sm font-bold text-slate-900">Commande ${escapeHtml(order.id)}</p>
                        <p class="text-xs text-slate-500">Statut: ${escapeHtml(order.status)}</p>
                        <p class="text-xs text-slate-500">Temps max estime: ${escapeHtml(order.preparation_total_minutes || 0)} min</p>
                    </div>
                    ${getCountdownMarkup(order)}
                </div>
                <div class="mt-3 space-y-2">
                    ${(order.items || []).map((item) => `
                        <div class="rounded-2xl bg-slate-50 px-3 py-2">
                            <div class="flex items-center justify-between gap-3">
                                <p class="text-sm font-semibold text-slate-800">${escapeHtml(item.plat_name || item.plat_id)}</p>
                                ${getCountdownMarkup({ ...item, status: order.status }, 'text-sm font-black')}
                            </div>
                            <p class="text-xs text-slate-500">Quantite: ${escapeHtml(item.quantity)} - Preparation: ${escapeHtml(item.preparation_total_minutes || 0)} min</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                ${(item.compositions || []).length
                                    ? item.compositions.map((composition) => `
                                        <span class="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                            ${escapeHtml(composition.action)} - ${escapeHtml(composition.composition_name || composition.composition_id)}
                                        </span>
                                    `).join('')
                                    : '<span class="text-xs text-slate-500">Aucune modification</span>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    };

    const updateRemovedCompositionsUI = () => {
        const container = $('modal-compositions');
        const compositions = state.selectedPlat?.compositions || [];
        if (!compositions.length) {
            container.innerHTML = '<span class="text-sm text-slate-500">Aucune composition configurable.</span>';
            return;
        }

        container.innerHTML = compositions.map((composition) => {
            const removed = state.removedCompositionIds.has(composition.id);
            return `
                <button type="button" data-id="${escapeHtml(composition.id)}" class="toggle-composition rounded-full border px-3 py-2 text-xs font-bold ${removed ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700'}">
                    ${removed ? 'x ' : ''}${escapeHtml(composition.name)}
                </button>
            `;
        }).join('');
    };

    const updateOrderTotal = () => {
        const quantity = Number($('order-quantity').value || 1);
        $('modal-total-price').textContent = formatPrice((state.selectedPlat?.price || 0) * quantity);
    };

    const openPlatModal = (plat) => {
        state.selectedPlat = plat;
        state.removedCompositionIds = new Set();
        $('modal-plat-name').textContent = plat.name;
        $('modal-plat-description').textContent = plat.description || 'Aucune description';
        $('modal-plat-price').textContent = formatPrice(plat.price);
        $('modal-plat-prep').textContent = `${plat.prep_time || 0} min`;
        $('modal-plat-orderable').textContent = state.selectedDay === state.currentDay && plat.is_orderable_today ? 'Oui' : 'Non';
        $('modal-plat-days').innerHTML = (plat.consultable_days || []).map((day) => `
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">${escapeHtml(getWeekDayLabel(day))}</span>
        `).join('');
        $('submit-order').textContent = 'Ajouter au panier';
        $('submit-order').disabled = !(state.selectedDay === state.currentDay && plat.is_orderable_today);
        $('order-quantity').value = 1;
        updateRemovedCompositionsUI();
        updateOrderTotal();
        $('plat-modal').classList.remove('hidden');
        $('plat-modal').classList.add('flex');
    };

    const closePlatModal = () => {
        $('plat-modal').classList.add('hidden');
        $('plat-modal').classList.remove('flex');
        state.selectedPlat = null;
        state.removedCompositionIds = new Set();
    };

    const refreshCountdowns = () => {
        document.querySelectorAll('.countdown').forEach((node) => {
            const target = node.dataset.target;
            if (!target) return;
            const remaining = Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000));
            node.textContent = formatDuration(remaining);
        });

        $('session-countdown').textContent = state.session?.expires_at
            ? formatDuration(Math.max(0, Math.ceil((new Date(state.session.expires_at).getTime() - Date.now()) / 1000)))
            : '-';
    };

    const applyMenuPayload = (payload) => {
        state.table = payload.table;
        state.session = payload.session;
        state.currentDay = payload.current_day;
        state.selectedDay = payload.requested_day;
        state.consultableDays = payload.consultable_days || [];
        state.plats = payload.plats || [];
        state.cart = payload.cart || null;
        state.orders = payload.orders || [];
        setSessionUI();
        renderDayTabs();
        renderMenu();
        renderCartSummary();
        renderOrderSummary();
        refreshCountdowns();
    };

    const loadMenuForDay = async (day) => {
        if (!state.session) return;
        const response = await request(`/front-office/menu/${state.session.session_token}?day=${encodeURIComponent(day)}`, { auth: false });
        applyMenuPayload(response.data);
        pushLog('menu-log', 'Menu charge', 'success', { day: state.selectedDay, count: state.plats.length });
    };

    const refreshCartAndOrders = async () => {
        if (!state.session) return;
        const response = await request(`/front-office/cart/${state.session.session_token}`, { auth: false });
        state.session = response.data.session;
        state.cart = response.data.cart;
        state.orders = response.data.orders || [];
        setSessionUI();
        renderCartSummary();
        renderOrderSummary();
        refreshCountdowns();
    };

    const startSession = async (payload) => {
        const response = await request('/front-office/session/start', {
            method: 'POST',
            auth: false,
            body: payload
        });
        applyMenuPayload(response.data);
        if (state.table?.id && state.session?.session_token) {
            localStorage.setItem(`frontOfficeSession:${state.table.id}`, state.session.session_token);
        }
        pushLog('menu-log', 'Session table active', 'success', { table: state.table.id, session: state.session.id });
    };

    const restoreExistingSession = async (sessionToken) => {
        const response = await request(`/front-office/menu/${sessionToken}`, { auth: false });
        applyMenuPayload(response.data);
        pushLog('menu-log', 'Session existante restauree', 'success', { session: response.data.session.id });
    };

    const bindEvents = () => {
        $('start-session-btn').addEventListener('click', async () => {
            const tableId = $('table-id-input').value.trim();
            const qrCode = $('table-code-input').value.trim();
            if (!tableId && !qrCode) {
                alert('Veuillez renseigner un ID de table ou un qr_code.');
                return;
            }
            try {
                await startSession({ table_id: tableId || undefined, qr_code: qrCode || undefined });
            } catch (error) {
                pushLog('menu-log', 'Erreur creation session', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });

        $('day-tabs').addEventListener('click', async (event) => {
            const button = event.target.closest('.day-tab');
            if (!button) return;
            try {
                await loadMenuForDay(button.dataset.day);
            } catch (error) {
                pushLog('menu-log', 'Erreur changement jour', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });

        $('menu-list').addEventListener('click', async (event) => {
            const button = event.target.closest('.open-plat');
            if (!button || !state.session) return;
            try {
                const response = await request(`/front-office/plats/${button.dataset.id}?session_token=${encodeURIComponent(state.session.session_token)}&day=${encodeURIComponent(state.selectedDay)}`, { auth: false });
                openPlatModal(response.data.plat);
            } catch (error) {
                pushLog('menu-log', 'Erreur detail plat', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });

        $('close-modal').addEventListener('click', closePlatModal);
        $('plat-modal').addEventListener('click', (event) => {
            if (event.target.id === 'plat-modal') closePlatModal();
        });

        $('modal-compositions').addEventListener('click', (event) => {
            const button = event.target.closest('.toggle-composition');
            if (!button) return;
            const compositionId = button.dataset.id;
            if (state.removedCompositionIds.has(compositionId)) {
                state.removedCompositionIds.delete(compositionId);
            } else {
                state.removedCompositionIds.add(compositionId);
            }
            updateRemovedCompositionsUI();
        });

        $('order-quantity').addEventListener('input', updateOrderTotal);

        $('order-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.session || !state.selectedPlat) return;
            if (state.selectedDay !== state.currentDay || !state.selectedPlat.is_orderable_today) {
                alert('Ce plat est consultable mais non commandable pour ce jour.');
                return;
            }

            try {
                localStorage.setItem('frontOfficeCustomerName', $('customer-name').value.trim());
                localStorage.setItem('frontOfficeCustomerPhone', $('customer-phone').value.trim());

                const response = await request('/front-office/cart/items', {
                    method: 'POST',
                    auth: false,
                    body: {
                        session_token: state.session.session_token,
                        plat_id: state.selectedPlat.id,
                        quantity: Number($('order-quantity').value || 1),
                        composition_actions: Array.from(state.removedCompositionIds).map((compositionId) => ({
                            composition_id: compositionId,
                            action: 'removed'
                        }))
                    }
                });

                state.cart = response.data.cart;
                renderCartSummary();
                closePlatModal();
                pushLog('menu-log', 'Plat ajoute au panier', 'success', { plat: state.selectedPlat?.id });
            } catch (error) {
                pushLog('menu-log', 'Erreur ajout panier', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });

        $('cart-summary').addEventListener('click', async (event) => {
            const button = event.target.closest('.remove-cart-item');
            if (!button || !state.session) return;
            try {
                const response = await request(`/front-office/cart/items/${button.dataset.id}?session_token=${encodeURIComponent(state.session.session_token)}`, {
                    method: 'DELETE',
                    auth: false
                });
                state.cart = response.data.cart;
                renderCartSummary();
                pushLog('menu-log', 'Element retire du panier', 'success', { item: button.dataset.id });
            } catch (error) {
                pushLog('menu-log', 'Erreur suppression panier', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });

        $('checkout-cart-btn').addEventListener('click', async () => {
            if (!state.session) {
                alert('Aucune session active.');
                return;
            }
            if (!state.cart || !(state.cart.items || []).length) {
                alert('Le panier est vide.');
                return;
            }

            const customerName = localStorage.getItem('frontOfficeCustomerName') || $('customer-name').value.trim();
            const customerPhone = localStorage.getItem('frontOfficeCustomerPhone') || $('customer-phone').value.trim();

            if (!customerName || !customerPhone) {
                alert('Ouvrez un plat et renseignez au moins une fois votre nom et votre telephone.');
                return;
            }

            try {
                const response = await request('/front-office/cart/checkout', {
                    method: 'POST',
                    auth: false,
                    body: {
                        session_token: state.session.session_token,
                        customer: {
                            name: customerName,
                            phone: customerPhone
                        },
                        note: ''
                    }
                });

                state.session = response.data.session;
                state.cart = response.data.cart;
                state.orders = response.data.orders || [];
                renderCartSummary();
                renderOrderSummary();
                refreshCountdowns();
                pushLog('menu-log', 'Commande envoyee depuis le panier', 'success', { orders: state.orders.length });

                if (state.refreshInterval) clearInterval(state.refreshInterval);
                state.refreshInterval = setInterval(async () => {
                    try {
                        await refreshCartAndOrders();
                    } catch (error) {
                        pushLog('menu-log', 'Erreur refresh session', 'error', error.payload || { message: error.message });
                    }
                }, 30000);
            } catch (error) {
                pushLog('menu-log', 'Erreur validation panier', 'error', error.payload || { message: error.message });
                alert(error.message);
            }
        });
    };

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        const rememberedName = localStorage.getItem('frontOfficeCustomerName');
        const rememberedPhone = localStorage.getItem('frontOfficeCustomerPhone');
        if (rememberedName) $('customer-name').value = rememberedName;
        if (rememberedPhone) $('customer-phone').value = rememberedPhone;

        setInterval(refreshCountdowns, 1000);

        const params = new URLSearchParams(window.location.search);
        const tableId = params.get('table');
        const code = params.get('code');

        try {
            if (tableId) {
                $('table-id-input').value = tableId;
                const storedSession = localStorage.getItem(`frontOfficeSession:${tableId}`);
                if (storedSession) {
                    // await restoreExistingSession(storedSession);
                    try {
                        await restoreExistingSession(storedSession);
                    } catch (error) {
                        await startSession({ table_id: tableId });
                    }
                } else {
                    await startSession({ table_id: tableId });
                }
            } else if (code) {
                $('table-code-input').value = code;
                await startSession({ qr_code: code });
            } else {
                renderDayTabs();
                renderMenu();
                renderCartSummary();
                renderOrderSummary();
            }
        } catch (error) {
            pushLog('menu-log', 'Erreur initialisation menu', 'error', error.payload || { message: error.message });
        }
    });
})();
