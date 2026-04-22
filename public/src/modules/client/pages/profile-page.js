// client/js/profile.js

import { showToast } from '../../../shared/utils/index.js';

export async function initProfile() {
    // Charger les données sauvegardées
    const savedName = localStorage.getItem('frontOfficeCustomerName') || '';
    const savedPhone = localStorage.getItem('frontOfficeCustomerPhone') || '';
    const savedGuests = localStorage.getItem('frontOfficeGuests') || '2';
    
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const guestsCount = document.getElementById('guests-count');
    
    if (nameInput) nameInput.value = savedName;
    if (phoneInput) phoneInput.value = savedPhone;
    if (guestsCount) guestsCount.textContent = savedGuests;
    
    // Événements
    const saveBtn = document.getElementById('save-profile');
    const guestsMinus = document.getElementById('guests-minus');
    const guestsPlus = document.getElementById('guests-plus');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = nameInput?.value.trim() || '';
            const phone = phoneInput?.value.trim() || '';
            const guests = parseInt(guestsCount?.textContent || '2');
            
            if (name) localStorage.setItem('frontOfficeCustomerName', name);
            if (phone) localStorage.setItem('frontOfficeCustomerPhone', phone);
            localStorage.setItem('frontOfficeGuests', guests.toString());
            
            showToast('Informations enregistrées', 'success');
        });
    }
    
    if (guestsMinus) {
        guestsMinus.addEventListener('click', () => {
            let current = parseInt(guestsCount?.textContent || '2');
            if (current > 1) {
                current--;
                if (guestsCount) guestsCount.textContent = current;
            }
        });
    }
    
    if (guestsPlus) {
        guestsPlus.addEventListener('click', () => {
            let current = parseInt(guestsCount?.textContent || '2');
            if (current < 20) {
                current++;
                if (guestsCount) guestsCount.textContent = current;
            }
        });
    }
}
