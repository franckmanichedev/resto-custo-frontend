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
const menuButton = document.getElementById('seeMenuBtn');
const retryButton = document.getElementById('retryBtn');
const target = resolveReturnTarget();

bindChrome();

menuButton?.addEventListener('click', () => {
    window.location.href = target;
});

retryButton?.addEventListener('click', () => {
    window.location.reload();
});

try {
    statusNode.textContent = 'Creation de votre session en cours...';
    hintNode.textContent = 'Nous verifions la table scannee avant de charger le menu.';
    await startSession();
    statusNode.textContent = 'Votre table est prete.';
    hintNode.textContent = 'Redirection vers les menus dans un instant.';
    menuButton?.classList.remove('hidden');
    retryButton?.classList.add('hidden');
    setTimeout(() => {
        window.location.href = target;
    }, 700);
} catch (error) {
    statusNode.textContent = 'Impossible de demarrer cette table.';
    hintNode.textContent = error.message || 'Verifiez le QR code ou la connexion avec le serveur.';
    retryButton?.classList.remove('hidden');
    showToast(error.message || 'Erreur de creation de session', 'error');
}
