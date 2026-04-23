// ========== DONNÉES POUR LA SECTION AVANTAGES ==========
const siteHighlights = [
    {
        icon: "fas fa-qrcode",
        title: "Commande via QR Code",
        description: "Accédez au menu et commandez directement depuis votre smartphone, sans attente."
    },
    {
        icon: "fas fa-chart-line",
        title: "Catalogue piloté",
        description: "Gérez vos plats et prix en temps réel, mises à jour instantanées."
    },
    {
        icon: "fas fa-cloud-upload-alt",
        title: "SaaS-ready",
        description: "Solution évolutive, prête pour le multi-restaurant et l'administration à distance."
    },
    {
        icon: "fas fa-headset",
        title: "Support dédié",
        description: "Une équipe à votre écoute pour vous accompagner au quotidien."
    }
];

// Fonction pour injecter les avantages dans la grille
function renderHighlights() {
    const container = document.getElementById('advantagesGrid');
    if (!container) return;
    container.innerHTML = '';
    siteHighlights.forEach(highlight => {
        const card = document.createElement('div');
        card.className = 'advantage-card';
        card.innerHTML = `
            <i class="${highlight.icon}"></i>
            <h3>${highlight.title}</h3>
            <p>${highlight.description}</p>
        `;
        container.appendChild(card);
    });
}

// Exporter pour usage global (disponible dans main.js)
window.renderHighlights = renderHighlights;