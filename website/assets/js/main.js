// ========== NAVIGATION STICKY & BURGER ==========
const navbar = document.getElementById('navbar');
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
const navLinksItems = document.querySelectorAll('.nav-link');

burger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

navLinksItems.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        // Active class management
        navLinksItems.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

// ========== CARROUSEL HERO ==========
const slides = document.querySelectorAll('.hero-slide');
const prevBtn = document.getElementById('heroPrev');
const nextBtn = document.getElementById('heroNext');
const dots = document.querySelectorAll('.dot');
let currentSlide = 0;
let autoSlideInterval;

function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    slides[index].classList.add('active');
    dots[index].classList.add('active');
    currentSlide = index;
}

function nextSlide() { showSlide(currentSlide + 1); }
function prevSlide() { showSlide(currentSlide - 1); }

function startAutoSlide() {
    autoSlideInterval = setInterval(nextSlide, 6000);
}
function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
}

prevBtn.addEventListener('click', () => { prevSlide(); resetAutoSlide(); });
nextBtn.addEventListener('click', () => { nextSlide(); resetAutoSlide(); });
dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => { showSlide(idx); resetAutoSlide(); });
});

startAutoSlide();

// ========== SCROLL ANIMATIONS (FADE-IN) ==========
const fadeElements = document.querySelectorAll('.section, .cat-card, .promo-card, .gallery-item, .advantage-card');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('appear');
        }
    });
}, { threshold: 0.1 });

fadeElements.forEach(el => {
    el.classList.add('fade-up');
    observer.observe(el);
});

// ========== FORMULAIRE DE RÉSERVATION ==========
const form = document.getElementById('reservationForm');
form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Merci pour votre réservation. Nous vous contacterons sous 24h.');
    form.reset();
});

// ========== DYNAMIQUE DES AVANTAGES (appel siteShell.js) ==========
// Le contenu sera injecté via renderHighlights() défini dans siteShell.js
// On attend que le DOM soit chargé
document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderHighlights !== 'undefined') {
        renderHighlights();
    }
});

// ========== LIGHTBOX SIMPLE (Galerie) ==========
const galleryItems = document.querySelectorAll('.gallery-item');
galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        const imgSrc = item.querySelector('img').src;
        const lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.style.position = 'fixed';
        lightbox.style.top = 0;
        lightbox.style.left = 0;
        lightbox.style.width = '100%';
        lightbox.style.height = '100%';
        lightbox.style.backgroundColor = 'rgba(0,0,0,0.9)';
        lightbox.style.display = 'flex';
        lightbox.style.alignItems = 'center';
        lightbox.style.justifyContent = 'center';
        lightbox.style.zIndex = '2000';
        lightbox.style.cursor = 'pointer';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '90%';
        img.style.maxHeight = '90%';
        img.style.borderRadius = '12px';
        lightbox.appendChild(img);
        document.body.appendChild(lightbox);
        lightbox.addEventListener('click', () => lightbox.remove());
    });
});