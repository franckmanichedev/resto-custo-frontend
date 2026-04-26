// assets/js/animations.js
// Animations au scroll (fade-up)
const faders = document.querySelectorAll('.fade-up');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

faders.forEach(el => observer.observe(el));