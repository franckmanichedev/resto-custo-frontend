import { bindChrome, buildUrl, showToast, startSession } from './client-core.js';

const resolveReturnTarget = () => {
    const raw = new URLSearchParams(window.location.search).get('return_to');
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) {
        return buildUrl('index');
    }
    return raw;
};

const statusNode = document.getElementById('loadingStatus');
const hintNode = document.getElementById('loadingHint');
const loaderContainer = document.getElementById('loaderContainer');
const menuButton = document.getElementById('seeMenuBtn');
const buttonContainer = document.getElementById('buttonContainer');
const retryButton = document.getElementById('retryBtn');
const retryContainer = document.getElementById('retryContainer');
const target = resolveReturnTarget();

bindChrome();

menuButton?.addEventListener('click', () => {
    window.location.href = target;
});

retryButton?.addEventListener('click', () => {
    window.location.reload();
});

const runStartSessionWithRetry = async (attempts = 3, delayMs = 700) => {
    statusNode.textContent = 'Creation de votre session en cours...';
    hintNode.textContent = 'Nous verifions la table scannee avant de charger le menu.';

    for (let i = 1; i <= attempts; i++) {
        try {
            statusNode.textContent = `Tentative ${i} / ${attempts} — creation de la session...`;
            await startSession();
            statusNode.textContent = 'Votre table est prete.';
            hintNode.textContent = 'Redirection vers les menus dans un instant.';
            loaderContainer?.classList.add('opacity-70');
            buttonContainer?.classList.remove('hidden');
            retryContainer?.classList.add('hidden');
            setTimeout(() => { window.location.href = target; }, 700);
            return;
        } catch (error) {
            console.error('startSession error (attempt ' + i + '):', error);
            if (i < attempts) {
                hintNode.textContent = `Erreur temporaire — nouvelle tentative dans ${Math.round(delayMs)}ms...`;
                await new Promise((res) => setTimeout(res, delayMs));
                delayMs *= 1.5;
                continue;
            }

            statusNode.textContent = 'Impossible de demarrer cette table.';
            hintNode.textContent = error.message || 'Verifiez le QR code ou la connexion avec le serveur.';
            buttonContainer?.classList.add('hidden');
            retryContainer?.classList.remove('hidden');
            const message = (error.payload && error.payload.message) || error.message || 'Erreur de creation de session';
            showToast(message, 'error');
            return;
        }
    }
};

runStartSessionWithRetry().catch((err) => {
    console.error('Unexpected error in loading flow:', err);
    showToast('Erreur interne lors du chargement', 'error');
});
