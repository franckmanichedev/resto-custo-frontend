export const siteHighlights = [
    {
        title: 'QR code à table',
        description: 'Les clients démarrent une session en scannant un QR code et commandent sans attendre.'
    },
    {
        title: 'Catalogue piloté',
        description: 'Le menu, les catégories, les compositions et la disponibilité sont administrables.'
    },
    {
        title: 'Base SaaS-ready',
        description: 'Le frontend et le backend sont désormais préparés pour la multi-tenance par restaurant.'
    }
];

export function renderHighlights() {
    return siteHighlights.map((item) => `
        <article class="site-card">
            <p class="site-card-title">${item.title}</p>
            <p class="site-card-copy">${item.description}</p>
        </article>
    `).join('');
}
