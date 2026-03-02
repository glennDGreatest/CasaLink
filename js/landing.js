/* ============================================
   CasaLink Landing Page - JavaScript
   ============================================ */

(function() {
    'use strict';

    // ============================================
    // Mobile Menu Toggle
    // ============================================

    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');

            // Animate hamburger
            const spans = hamburger.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translateY(10px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translateY(-10px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }

    // Close mobile menu when a link is clicked
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (navMenu) {
                navMenu.classList.remove('active');
                const spans = hamburger.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    });

    // ============================================
    // CTA Button Navigation
    // ============================================

    const ctaButtons = document.querySelectorAll('#ctaButton, #ctaButton2');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            // Show the login form instead of navigating away
            if (window.casaLink && typeof window.casaLink.showLogin === 'function') {
                // Skip landing page and show login directly
                window.casaLink.showLogin(true);
            } else {
                // Fallback: navigate to the main app
                window.location.href = 'index.html';
            }
        });
    });

    // ============================================
    // Scroll to Top on Page Load
    // ============================================

    window.addEventListener('load', function() {
        window.scrollTo(0, 0);
        // Hide the loading spinner when landing page is loaded
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
    });

    // ============================================
    // Smooth Scroll Behavior
    // ============================================

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Don't prevent default for buttons
            if (this.tagName === 'A' && !this.id.includes('ctaButton')) {
                e.preventDefault();

                const target = document.querySelector(href);
                if (target) {
                    // Account for fixed navbar
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ============================================
    // Intersection Observer for Animations
    // ============================================

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add animation class when element is in view
                entry.target.style.animation = entry.target.dataset.animation || 'fadeInUp 0.6s ease forwards';

                // Only observe once
                if (!entry.target.classList.contains('observed')) {
                    entry.target.classList.add('observed');
                }
            }
        });
    }, observerOptions);

    // Observe all animated elements
    const animatedElements = document.querySelectorAll('.feature-card, .testimonial-card, .step-card');
    animatedElements.forEach(el => observer.observe(el));

    // ============================================
    // Navbar Shadow on Scroll
    // ============================================

    const navbar = document.querySelector('.landing-navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 10) {
                navbar.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.boxShadow = 'var(--shadow-md)';
            }
        });
    }

    // ============================================
    // Active Navigation Link on Scroll
    // ============================================

    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section');

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // ============================================
    // Button Ripple Effect
    // ============================================

    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', createRipple);
    });

    // ============================================
    // Logo Click Handler
    // ============================================

    const logoLink = document.querySelector('.navbar-logo');
    if (logoLink) {
        logoLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ============================================
    // Accessibility: Keyboard Navigation
    // ============================================

    document.addEventListener('keydown', function(e) {
        // Close mobile menu on Escape
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (hamburger) {
                const spans = hamburger.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        }
    });

    // ============================================
    // Lazy Load Images (if any)
    // ============================================

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
    }

    // ============================================
    // Performance: Debounce for Scroll Events
    // ============================================

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============================================
    // Console Message
    // ============================================

    console.log(
        '%cWelcome to CasaLink!',
        'color: #0d9488; font-size: 18px; font-weight: bold;'
    );
    console.log(
        '%cSmart Property Management Made Simple',
        'color: #1e3a5f; font-size: 14px;'
    );

})();