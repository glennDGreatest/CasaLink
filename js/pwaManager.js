// js/pwaManager.js - COMPLETE FIXED VERSION
class PWAManager {
    static deferredPrompt = null;
    static isInstalled = false;
    static isAdminPage = false;

    static init() {
        console.log('🚀 PWA Manager initializing...');
        
        // Check if we're on an admin page FIRST
        this.detectAdminPage();
        
        // Skip PWA features on admin pages
        if (this.isAdminPage) {
            console.log('🔒 PWA features disabled on admin pages');
            return;
        }
        
        this.setupInstallPrompt();
        this.setupOfflineDetection();
        this.setupUserEngagement(); 
        this.registerServiceWorker();
        this.setupServiceWorkerListeners();
        this.checkPWAStatus();
        
        // Show install prompt after a short delay if conditions are met
        setTimeout(() => {
            this.showInstallPromptIfEligible();
        }, 3000);
    }

    static isIOS() {
        const userAgent = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    static isIOSChrome() {
        const userAgent = navigator.userAgent;
        return this.isIOS() && /CriOS/.test(userAgent);
    }

    static isAndroid() {
        const userAgent = navigator.userAgent;
        return /Android/i.test(userAgent);
    }

    static isAndroidChrome() {
        const userAgent = navigator.userAgent;
        return this.isAndroid() && /Chrome/i.test(userAgent) && !/Edg/i.test(userAgent);
    }

    static detectAdminPage() {
        // Check if we're on an admin page
        const path = window.location.pathname || '';
        this.isAdminPage = path.includes('/admin/') || 
                          path.includes('/admin/') ||
                          path.endsWith('/admin') ||
                          path.includes('admin_');
        
        if (this.isAdminPage) {
            console.log('🔐 Admin page detected - PWA features disabled');
            
            // Also unregister any existing service workers that might control admin pages
            this.unregisterServiceWorkersForAdminPages();
        }
    }

    static async unregisterServiceWorkersForAdminPages() {
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    // If service worker is controlling admin pages, unregister it
                    if (registration.active && 
                        (registration.scope.includes('/admin/') || 
                         registration.active.scriptURL.includes('/admin/'))) {
                        console.log('🗑️ Unregistering service worker for admin page:', registration.scope);
                        await registration.unregister();
                    }
                }
            } catch (error) {
                console.warn('Error unregistering service workers:', error);
            }
        }
    }

    static setupInstallPrompt() {
        console.log('🔧 Setting up install prompt listeners...');
        
        window.addEventListener('beforeinstallprompt', (e) => {
            // Skip on admin pages
            if (this.isAdminPage) {
                console.log('🔒 Skipping install prompt on admin page');
                return;
            }
            
            console.log('🎯 beforeinstallprompt EVENT FIRED!', {
                platforms: e.platforms,
                canInstall: true
            });

            // Prevent the mini-infobar from appearing
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            window.deferredPrompt = e;
            
            console.log('✅ PWA install prompt is now available');
            
            // Update UI to show install button
            this.updateInstallUI(true);
            
            // Store in session storage for page refreshes
            sessionStorage.setItem('pwa_install_available', 'true');
            
            // Show prompt after user engagement
            this.showInstallPromptIfEligible();
        });

        window.addEventListener('appinstalled', (e) => {
            console.log('🎉 PWA was installed successfully');
            this.handleSuccessfulInstallation();
            sessionStorage.removeItem('pwa_install_available');
        });
        
        // Check if we already have install capability from previous page load
        if (sessionStorage.getItem('pwa_install_available') === 'true' && !this.isAdminPage) {
            console.log('🔄 Install capability persisted from previous page load');
            this.updateInstallUI(true);
        }
    }

    static async showInstallPromptIfEligible() {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        // Wait a bit for the service worker to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // On iOS and Android, always show the install prompt since PWA installation is important
        if (this.isIOS() || this.isAndroid()) {
            const deviceType = this.isIOS() ? 'iOS' : 'Android';
            console.log(`📱 ${deviceType} detected - showing install prompt for PWA installation`);
            this.showPersistentInstallPromotion();
            return;
        }
        
        // For desktop/other browsers, check for deferred prompt
        if (this.deferredPrompt && !this.isInstalled && !this.userDismissedPrompt()) {
            console.log('🎯 Showing install prompt automatically');
            this.showPersistentInstallPromotion();
        }
    }

    static async installPWA() {
        // Skip on admin pages
        if (this.isAdminPage) {
            console.log('🔒 PWA installation disabled on admin pages');
            return;
        }
        
        console.log('🔄 Install PWA method called');
        console.log('📱 Device type:', this.isIOS() ? 'iOS' : this.isAndroid() ? 'Android' : 'Other');
        
        // Handle iOS differently - iOS doesn't support beforeinstallprompt
        if (this.isIOS()) {
            console.log('🍎 iOS detected - showing manual installation instructions');
            this.showIOSInstallInstructions();
            return;
        }
        
        // Handle Android - try native install prompt first
        if (this.isAndroid()) {
            console.log('🤖 Android detected');
            if (this.deferredPrompt) {
                try {
                    console.log('🎯 Showing Android browser install prompt...');
                    await this.deferredPrompt.prompt();
                    
                    const choiceResult = await this.deferredPrompt.userChoice;
                    console.log(`✅ Android user response: ${choiceResult.outcome}`);
                    
                    if (choiceResult.outcome === 'accepted') {
                        console.log('🎉 Android user accepted PWA installation');
                        this.handleSuccessfulInstallation();
                    } else {
                        console.log('❌ Android user dismissed PWA installation');
                        this.markPromptDismissed();
                        // Show Android-specific instructions as fallback
                        this.showAndroidInstallInstructions();
                    }
                } catch (error) {
                    console.error('❌ Error during Android PWA installation:', error);
                    this.showAndroidInstallInstructions();
                }
            } else {
                console.log('⚠️ No deferred prompt available for Android - showing instructions');
                this.showAndroidInstallInstructions();
            }
            return;
        }
        
        // Other browsers (desktop, etc.) - use standard install prompt
        if (this.deferredPrompt) {
            try {
                console.log('🎯 Showing browser install prompt...');
                
                // This is the critical line that was missing
                await this.deferredPrompt.prompt();
                
                const choiceResult = await this.deferredPrompt.userChoice;
                console.log(`✅ User response: ${choiceResult.outcome}`);
                
                if (choiceResult.outcome === 'accepted') {
                    console.log('🎉 User accepted PWA installation');
                    this.handleSuccessfulInstallation();
                } else {
                    console.log('❌ User dismissed PWA installation');
                    this.markPromptDismissed();
                }
            } catch (error) {
                console.error('❌ Error during PWA installation:', error);
                // Fallback to manual instructions
                this.showManualInstallInstructions();
            }
        } else {
            console.log('⚠️ No deferred prompt available - showing manual instructions');
            this.showManualInstallInstructions();
        }
    }

    static handleSuccessfulInstallation() {
        this.deferredPrompt = null;
        this.isInstalled = true;
        this.hideInstallPromotion();
        this.setInstallationStatus(true);
        
        if (window.casaLink) {
            window.casaLink.showNotification('CasaLink installed successfully!', 'success');
        }
    }

    static showPersistentInstallPromotion() {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        if (this.isInstalled || this.userDismissedPrompt() || !this.deferredPrompt) {
            return;
        }

        console.log('🎪 Showing install promotion');
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'block';
        }
    }

    static hideInstallPromotion() {
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    static handleNotNowClick() {
        console.log('🙅 User clicked "Not Now"');
        this.setPromptDismissed();
        this.hideInstallPromotion();
    }

    static userDismissedPrompt() {
        return localStorage.getItem('casalink_prompt_dismissed') === 'true';
    }

    static setPromptDismissed() {
        localStorage.setItem('casalink_prompt_dismissed', 'true');
    }

    static setInstallationStatus(installed) {
        if (installed) {
            localStorage.setItem('casalink_pwa_installed', 'true');
        } else {
            localStorage.removeItem('casalink_pwa_installed');
        }
    }

    static getInstallationStatus() {
        return localStorage.getItem('casalink_pwa_installed') === 'true';
    }

    static checkPWAStatus() {
        // Skip on admin pages
        if (this.isAdminPage) return false;
        
        const isInstalled = 
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://') ||
            this.getInstallationStatus();
        
        this.isInstalled = isInstalled;
        console.log('📱 PWA installation status:', this.isInstalled ? 'Installed' : 'Not installed', {
            displayMode: this.getDisplayMode(),
            standalone: window.navigator.standalone,
            referrer: document.referrer
        });
        
        if (this.isInstalled) {
            this.hideInstallPromotion();
        }
        
        return this.isInstalled;
    }

    static setupUserEngagement() {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        let userEngaged = false;
        
        const engagementEvents = ['click', 'keydown', 'scroll', 'mousemove'];
        
        engagementEvents.forEach(eventType => {
            document.addEventListener(eventType, () => {
                if (!userEngaged) {
                    userEngaged = true;
                    console.log('✅ User engagement detected');
                    // Now we can show install prompt
                    setTimeout(() => {
                        this.showInstallPromptIfEligible();
                    }, 1000);
                }
            }, { once: false, passive: true });
        });
    }

    static setupServiceWorkerListeners() {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Service Worker controller changed');
            });
            
            navigator.serviceWorker.ready.then((registration) => {
                if (registration && registration.active) {
                    console.log('✅ Service Worker ready and active');
                } else {
                    console.warn('⚠️ Service Worker not active after ready');
                }
            }).catch(error => {
                console.error('❌ Service Worker ready promise rejected:', error);
            });
        }
    }

    static async registerServiceWorker() {
        // CRITICAL: Skip service worker on admin pages to avoid scope/control / reload loops
        try {
            const path = window.location.pathname || '';
            if (path.includes('/admin') || 
                path.endsWith('/admin/') || 
                path.endsWith('/admin/index.html') || 
                path.includes('/admin/')) {
                console.log('🔒 Skipping Service Worker registration on admin pages for stability');
                return null;
            }
        } catch (e) {
            // if any error reading location, continue to register (safe fallback)
            console.warn('Could not determine pathname for SW guard, proceeding', e);
        }

        if ('serviceWorker' in navigator) {
            try {
                console.log('🔄 Registering Service Worker...');

                // Only unregister if there are issues (keep existing logic)
                const registrations = await navigator.serviceWorker.getRegistrations();
                let shouldUnregister = false;

                for (let registration of registrations) {
                    // Only unregister if it's clearly not our intended scope
                    if (!registration.active || registration.scope !== window.location.origin + '/') {
                        try {
                            await registration.unregister();
                            console.log('🗑️ Unregistered old service worker:', registration.scope);
                            shouldUnregister = true;
                        } catch (err) {
                            console.warn('Could not unregister service worker:', registration.scope, err);
                        }
                    }
                }

                if (shouldUnregister) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none'
                });

                console.log('✅ ServiceWorker registered:', registration.scope);

                // Track installation state safely
                if (registration.installing) {
                    await new Promise((resolve) => {
                        const worker = registration.installing;
                        if (!worker) return resolve();

                        // If the worker already reached a terminal state before listener attachment,
                        // resolve immediately to avoid false timeout warnings.
                        if (['activated', 'installed', 'redundant'].includes(worker.state)) {
                            console.log('🔧 Service Worker already in terminal state:', worker.state);
                            return resolve();
                        }

                        const onStateChange = () => {
                            console.log('🔧 Service Worker state:', worker.state);
                            // Consider activated/installed as success; treat redundant as non-fatal
                            if (worker.state === 'activated' || worker.state === 'installed') {
                                cleanup();
                                return resolve();
                            }
                            if (worker.state === 'redundant') {
                                console.warn('⚠️ Service Worker became redundant during install — continuing without error');
                                cleanup();
                                return resolve();
                            }
                        };

                        const cleanup = () => {
                            try { worker.removeEventListener('statechange', onStateChange); } catch (e) {}
                        };

                        worker.addEventListener('statechange', onStateChange);

                        // Fallback timeout to avoid hanging indefinitely
                        setTimeout(() => {
                            if (worker.state !== 'installed' && worker.state !== 'activated' && worker.state !== 'redundant') {
                                console.warn('⚠️ SW install wait timed out — continuing');
                            } else {
                                console.log('🔧 SW install fallback timeout fired after terminal state:', worker.state);
                            }
                            cleanup();
                            resolve();
                        }, 10000);
                    }).catch(err => console.warn('SW installing promise warning (non-fatal):', err));
                } else if (registration.active) {
                    console.log('✅ Service Worker already active');
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            console.log('🔄 New Service Worker state:', newWorker.state);
                        });
                    }
                });

                return registration;
            } catch (error) {
                console.error('❌ ServiceWorker registration failed:', error);
                return null;
            }
        }
        console.warn('⚠️ Service workers not supported');
        return null;
    }

    static setupOfflineDetection() {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        window.addEventListener('online', () => {
            this.updateOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.updateOnlineStatus(false);
        });

        this.updateOnlineStatus(navigator.onLine);
    }

    static updateOnlineStatus(online) {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = online ? 'none' : 'block';
        }
    }

    static updateInstallUI(show) {
        // Skip on admin pages
        if (this.isAdminPage) return;
        
        const prompt = document.getElementById('pwaPrompt');
        if (prompt) {
            prompt.style.display = show ? 'block' : 'none';
        }
    }

    static showManualInstallInstructions() {
        // Skip on admin pages
        if (this.isAdminPage) {
            console.log('🔒 Manual install instructions disabled on admin pages');
            return;
        }
        
        const modalContent = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-download" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 15px;">Install CasaLink</h3>
                <p style="margin-bottom: 20px;">To install CasaLink as an app:</p>
                
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>Android Chrome:</strong><br>
                    • Look for the <strong>install icon (📱)</strong> in the address bar<br>
                    • Or tap the <strong>menu (⋮) → "Install CasaLink"</strong><br><br>
                    
                    <strong>Android Other Browsers:</strong><br>
                    • Look for <strong>"Add to Home Screen"</strong> in the browser menu<br><br>
                    
                    <strong>Desktop Chrome/Edge:</strong><br>
                    • Look for the <strong>install icon (⎙)</strong> in the address bar<br>
                    • Or click <strong>⋮ menu → "Install CasaLink"</strong><br><br>
                    
                    <strong>Firefox:</strong><br>
                    • Look for the <strong>install icon</strong> in the address bar<br>
                    • Or check the <strong>menu → "Install"</strong>
                </div>
                
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Refresh & Retry
                </button>
            </div>
        `;
        
        if (window.ModalManager) {
            ModalManager.openModal(modalContent, {
                title: 'Install CasaLink App',
                submitText: 'Close',
                showFooter: true
            });
        } else {
            alert('Install CasaLink: Look for the install icon in your browser\'s address bar or menu.');
        }
    }

    static showAndroidInstallInstructions() {
        // Skip on admin pages
        if (this.isAdminPage) {
            console.log('🔒 Android install instructions disabled on admin pages');
            return;
        }
        
        const modalContent = `
            <div style="text-align: center; padding: 20px;">
                <i class="fab fa-android" style="font-size: 3rem; color: #3ddc84; margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 15px;">Install CasaLink on Android</h3>
                <p style="margin-bottom: 20px;">Follow these steps to add CasaLink to your home screen:</p>
                
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>Option 1 - Chrome (Recommended):</strong><br>
                    • Look for the <strong>install icon (📱)</strong> in the address bar<br>
                    • Tap it and select <strong>"Install"</strong><br><br>
                    
                    <strong>Option 2 - Chrome Menu:</strong><br>
                    • Tap the <strong>menu button (⋮)</strong> in the top right<br>
                    • Select <strong>"Install CasaLink"</strong> or <strong>"Add to Home Screen"</strong><br><br>
                    
                    <strong>Option 3 - Other Browsers:</strong><br>
                    • Look for <strong>"Add to Home Screen"</strong> in your browser menu<br>
                    • Or look for an <strong>install/share icon</strong>
                </div>
                
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <strong>💡 Pro Tips:</strong><br>
                    • Make sure you're using Chrome for the best experience<br>
                    • The app will work offline and receive notifications<br>
                    • You can organize it with your other apps on the home screen
                </div>
                
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Refresh & Try Again
                </button>
            </div>
        `;
        
        if (window.ModalManager) {
            ModalManager.openModal(modalContent, {
                title: 'Install CasaLink on Android',
                submitText: 'Close',
                showFooter: true
            });
        } else {
            alert('To install CasaLink on Android: Look for the install icon in Chrome\'s address bar or tap the menu and select "Install CasaLink".');
        }
    }

    static showIOSInstallInstructions() {
        // Skip on admin pages
        if (this.isAdminPage) {
            console.log('🔒 iOS install instructions disabled on admin pages');
            return;
        }
        
        const modalContent = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-mobile-alt" style="font-size: 3rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 15px;">Install CasaLink on iOS</h3>
                <p style="margin-bottom: 20px;">Follow these steps to add CasaLink to your home screen:</p>
                
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>Step 1:</strong> Tap the <strong>Share button</strong> <i class="fas fa-share-square" style="color: #007aff;"></i> at the bottom of the screen<br><br>
                    <strong>Step 2:</strong> Scroll down and tap <strong>"Add to Home Screen"</strong> <i class="fas fa-plus-square" style="color: #007aff;"></i><br><br>
                    <strong>Step 3:</strong> Tap <strong>"Add"</strong> in the top right corner<br><br>
                    <strong>Step 4:</strong> CasaLink will now appear on your home screen as an app!
                </div>
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <strong>💡 Pro Tips:</strong><br>
                    • Make sure you're using Safari or Chrome on iOS<br>
                    • The app will work offline and receive notifications<br>
                    • You can remove it like any other app from your home screen
                </div>
                
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Refresh & Try Again
                </button>
            </div>
        `;
        
        if (window.ModalManager) {
            ModalManager.openModal(modalContent, {
                title: 'Install CasaLink on iOS',
                submitText: 'Close',
                showFooter: true
            });
        } else {
            alert('To install CasaLink on iOS: Tap the Share button, then "Add to Home Screen".');
        }
    }

    // Debug methods
    static debugInstallPrompt() {
        console.log('🐛 PWA Debug Info:', {
            isAdminPage: this.isAdminPage,
            deferredPrompt: !!this.deferredPrompt,
            isInstalled: this.isInstalled,
            userDismissed: this.userDismissedPrompt(),
            serviceWorker: !!navigator.serviceWorker?.controller,
            manifest: !!document.querySelector('link[rel="manifest"]'),
            displayMode: this.getDisplayMode()
        });
    }

    static getDisplayMode() {
        if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
        if (window.navigator.standalone) return 'standalone';
        return 'browser';
    }
}

window.PWAManager = PWAManager;