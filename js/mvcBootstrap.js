/**
 * CasaLink MVC Application Bootstrap
 * Loads all MVC components in proper order:
 * 1. Config & Firebase
 * 2. Models (Data layer)
 * 3. Services (Business logic layer)
 * 4. Utilities (Helper functions)
 * 5. Controllers (Orchestration layer)
 * 6. Initialize App
 */

(function() {
    const CACHE_BUSTER = 'v=1.0.4-mvc-' + new Date().getTime();
    
    // MVC Script Loading Order
    const mvcScripts = [
        // Configuration is provided by the main page loader (index.html)
        // 'config/firebase.js' intentionally not loaded here to avoid duplicate declarations
        
        // Models Layer (Data structures)
        'models/User.js',
        'models/Property.js',
        'models/Unit.js',
        'models/Lease.js',
        'models/Bill.js',
        'models/MaintenanceRequest.js',
        
        // Services Layer (Business logic & Firebase operations)
        'services/FirebaseService.js',
        'services/AuthService.js',
        'services/DataService.js',
        
        // Utilities Layer (Helper functions)
        'utilities/constants.js',
        'utilities/helpers.js',
        'utilities/formatters.js',
        
        // Controllers Layer (Orchestration)
        'controllers/AuthController.js',
        'controllers/DashboardController.js',
        'controllers/PropertiesController.js',
        // landlord-specific controller overrides the generic version when present
        'js/landlord/PropertiesController.js',
        'controllers/TenantsController.js',
        'controllers/BillingController.js',
        'controllers/MaintenanceController.js'
    ];

    // Note: legacy scripts are loaded by the main page loader to avoid duplicate declarations.
    const legacyScripts = [];

    let scriptsLoaded = 0;
    let totalScripts = mvcScripts.length;

    /**
     * Load scripts sequentially
     */
    function loadScripts(scriptList, onComplete) {
        if (scriptList.length === 0) {
            onComplete();
            return;
        }

        const scriptUrl = scriptList.shift() + '?' + CACHE_BUSTER;
        console.log(`📦 [${scriptsLoaded + 1}/${totalScripts}] Loading: ${scriptUrl}`);

        const script = document.createElement('script');
        script.src = scriptUrl;
        script.type = 'text/javascript';

        script.onload = function() {
            scriptsLoaded++;
            console.log(`✅ [${scriptsLoaded}/${totalScripts}] Loaded: ${scriptUrl}`);
            loadScripts(scriptList, onComplete);
        };

        script.onerror = function() {
            console.error(`❌ Failed to load: ${scriptUrl}`);
            scriptsLoaded++;
            loadScripts(scriptList, onComplete);
        };

        document.head.appendChild(script);
    }

    /**
     * Initialize MVC Application
     */
    function initializeMVCApp() {
        console.log('🚀 Initializing CasaLink MVC Application...');

        try {
            // Verify Firebase is loaded
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }
            console.log('✅ Firebase SDK loaded');

            // Verify all MVC layers are loaded
            const layers = {
                Models: [typeof User !== 'undefined' ? User : null,
                         typeof Property !== 'undefined' ? Property : null,
                         typeof Unit !== 'undefined' ? Unit : null,
                         typeof Lease !== 'undefined' ? Lease : null,
                         typeof Bill !== 'undefined' ? Bill : null,
                         typeof MaintenanceRequest !== 'undefined' ? MaintenanceRequest : null],
                Services: [typeof FirebaseService !== 'undefined' ? FirebaseService : null,
                           typeof AuthService !== 'undefined' ? AuthService : null,
                           typeof DataService !== 'undefined' ? DataService : null],
                Utilities: [typeof AppHelpers !== 'undefined' ? AppHelpers : null,
                            typeof Formatters !== 'undefined' ? Formatters : null,
                            typeof AppConstants !== 'undefined' ? AppConstants : null]
            };

            for (const [layer, checks] of Object.entries(layers)) {
                for (const check of checks) {
                    if (!check) {
                        throw new Error(`${layer} layer not properly loaded`);
                    }
                }
                console.log(`✅ ${layer} layer loaded`);
            }

            // Initialize Firebase services
            console.log('📡 Initializing Firebase services...');
            window.firebaseService = new FirebaseService();
            window.authService = new AuthService(window.firebaseService);
            window.dataService = new DataService(window.firebaseService);
            console.log('✅ Firebase services initialized');

            // Instantiate controllers explicitly now that services exist
            try {
                if (typeof AuthController !== 'undefined' && !window.authController) {
                    window.authController = new AuthController(window.authService, window.dataService);
                    console.log('✅ AuthController instantiated');
                }
                if (typeof DashboardController !== 'undefined' && !window.dashboardController) {
                    window.dashboardController = new DashboardController(window.dataService);
                    console.log('✅ DashboardController instantiated');
                }
                if (typeof PropertiesController !== 'undefined') {
                    // always instantiate after all scripts have loaded; the constructor
                    // may point to either the generic or landlord subclass depending on
                    // which script was loaded last.  This ensures the correct object is
                    // placed in the global namespace.
                    window.propertiesController = new PropertiesController(window.dataService);
                    console.log('✅ PropertiesController instantiated (', PropertiesController.name, ')');
                }
                // sanity check: editProperty should exist, otherwise recreate
                if (window.propertiesController && typeof window.propertiesController.editProperty !== 'function') {
                    console.warn('propertiesController exists but lacks editProperty – recreating instance');
                    window.propertiesController = new PropertiesController(window.dataService);
                }
                if (typeof TenantsController !== 'undefined' && !window.tenantsController) {
                    window.tenantsController = new TenantsController(window.dataService);
                    console.log('✅ TenantsController instantiated');
                }
                if (typeof BillingController !== 'undefined' && !window.billingController) {
                    window.billingController = new BillingController(window.dataService);
                    console.log('✅ BillingController instantiated');
                }
                if (typeof MaintenanceController !== 'undefined' && !window.maintenanceController) {
                    window.maintenanceController = new MaintenanceController(window.dataService);
                    console.log('✅ MaintenanceController instantiated');
                }
            } catch (instErr) {
                console.warn('⚠️ Controller instantiation warning:', instErr);
            }

            // Provide global utility aliases and view helper shims
            try {
                // Utilities
                if (typeof AppHelpers !== 'undefined') {
                    window.generateId = AppHelpers.generateId.bind(AppHelpers);
                    window.debounce = AppHelpers.debounce.bind(AppHelpers);
                    window.showNotification = function(message, type = 'info') {
                        if (window.notificationManager && typeof window.notificationManager.success === 'function') {
                            if (type === 'success') window.notificationManager.success(message);
                            else if (type === 'error' && typeof window.notificationManager.error === 'function') window.notificationManager.error(message);
                            else window.notificationManager.info ? window.notificationManager.info(message) : console.log(message);
                        } else if (typeof AppHelpers.showToast === 'function') {
                            AppHelpers.showToast(message, type);
                        } else {
                            console.log(`[notification:${type}]`, message);
                        }
                    };
                }

                if (typeof Formatters !== 'undefined') {
                    window.formatCurrency = Formatters.formatCurrency.bind(Formatters);
                    window.formatDate = Formatters.formatDate.bind(Formatters);
                }

                // View helper shims (lightweight - log and delegate if possible)
                window.updateDashboardStats = window.updateDashboardStats || function(stats) {
                    console.log('View helper updateDashboardStats called', stats);
                    if (window.dashboardController && typeof window.dashboardController.updateUI === 'function') {
                        window.dashboardController.updateUI(stats);
                    }
                };

                window.updateDashboardHeader = window.updateDashboardHeader || function(name) {
                    console.log('View helper updateDashboardHeader called with name:', name);
                    const headerEl = document.getElementById('dashboardHeaderName') || document.getElementById('userDisplay');
                    if (headerEl) headerEl.textContent = name;
                };

                // Dashboard loading state helper
                window.setDashboardLoading = window.setDashboardLoading || function(section, isLoading) {
                    try {
                        console.log(`View helper setDashboardLoading called for ${section}:`, isLoading);
                        // Common ID patterns used in UI
                        const idsToTry = [
                            `dashboardLoading_${section}`,
                            `${section}Loading`,
                            `${section}-loading`,
                            `${section}SectionLoading`
                        ];
                        let el = null;
                        for (const id of idsToTry) {
                            el = document.getElementById(id);
                            if (el) break;
                        }
                        if (!el) {
                            // try a selector for a loading spinner inside the section
                            const sectionEl = document.getElementById(section) || document.querySelector(`.${section}-section`);
                            if (sectionEl) el = sectionEl.querySelector('.loading-spinner');
                        }
                        if (el) el.style.display = isLoading ? 'block' : 'none';
                    } catch (e) {
                        console.warn('setDashboardLoading shim error:', e);
                    }
                };

                // Properties loading helper
                window.setPropertiesLoading = window.setPropertiesLoading || function(isLoading) {
                    try {
                        console.log(`View helper setPropertiesLoading called:`, isLoading);
                        const loadingEl = document.getElementById('propertiesLoading') ||
                                         document.getElementById('properties-section-loading');
                        if (loadingEl) {
                            loadingEl.style.display = isLoading ? 'grid' : 'none';
                        }
                    } catch (e) {
                        console.warn('setPropertiesLoading shim error:', e);
                    }
                };

                // Tenants loading helper
                window.setTenantsLoading = window.setTenantsLoading || function(isLoading) {
                    try {
                        console.log(`View helper setTenantsLoading called:`, isLoading);
                        const loadingEl = document.getElementById('tenantsLoading') || 
                                         document.getElementById('tenants-section-loading') ||
                                         document.querySelector('#tenantsSection .loading-spinner');
                        if (loadingEl) {
                            loadingEl.style.display = isLoading ? 'block' : 'none';
                        }
                    } catch (e) {
                        console.warn('setTenantsLoading shim error:', e);
                    }
                };

                // Billing loading helper
                window.setBillingLoading = window.setBillingLoading || function(isLoading) {
                    try {
                        console.log(`View helper setBillingLoading called:`, isLoading);
                        const loadingEl = document.getElementById('billingLoading') || 
                                         document.getElementById('bills-section-loading') ||
                                         document.querySelector('#billingSection .loading-spinner');
                        if (loadingEl) {
                            loadingEl.style.display = isLoading ? 'block' : 'none';
                        }
                    } catch (e) {
                        console.warn('setBillingLoading shim error:', e);
                    }
                };

                // Maintenance loading helper
                window.setMaintenanceLoading = window.setMaintenanceLoading || function(isLoading) {
                    try {
                        console.log(`View helper setMaintenanceLoading called:`, isLoading);
                        const loadingEl = document.getElementById('maintenanceLoading') || 
                                         document.getElementById('maintenance-section-loading') ||
                                         document.querySelector('#maintenanceSection .loading-spinner');
                        if (loadingEl) {
                            loadingEl.style.display = isLoading ? 'block' : 'none';
                        }
                    } catch (e) {
                        console.warn('setMaintenanceLoading shim error:', e);
                    }
                };

                // Escape HTML helper
                window.escapeHtml = window.escapeHtml || function(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                // Properties display helper (already exists but ensure it's robust)
                window.displayProperties = window.displayProperties || function(properties) {
                    console.log('View helper displayProperties called with', properties?.length || 0, 'properties');
                    const container = document.getElementById('propertiesContainer');
                    if (!container) return;

                    if (!properties || properties.length === 0) {
                        // show empty state element if present (covers generic controller case)
                        const emptyEl = document.getElementById('propertiesEmpty');
                        if (emptyEl) {
                            emptyEl.style.display = 'flex';
                        }
                        // clear container, don't render anything
                        container.innerHTML = '';
                        return;
                    } else {
                        // when rendering actual properties, hide the empty placeholder
                        const emptyEl = document.getElementById('propertiesEmpty');
                        if (emptyEl) {
                            emptyEl.style.display = 'none';
                        }
                    }

                    // Render properties as cards
                    let html = '';
                    properties.forEach((prop, idx) => {
                        if (!prop.id) {
                            console.warn(`⚠️ Property at index ${idx} has no id:`, prop);
                        }
                        const address = prop.address || prop.apartmentAddress || 'Unknown Address';
                        const name = prop.name || prop.apartmentName || 'Unnamed Property';
                        const floors = prop.numberOfFloors || 0;
                        const rooms = prop.totalUnits || prop.numberOfRooms || 0;
                        const isActive = prop.isActive !== false;
                        const statusClass = isActive ? 'status-active' : 'status-inactive';
                        const statusText = isActive ? 'Active' : 'Inactive';

                        html += `
                            <div class="property-card" data-property-id="${prop.id}">
                                <div class="property-image">
                                    <div class="property-placeholder">
                                        <i class="fas fa-building"></i>
                                    </div>
                                    <span class="property-type-badge">Apartment</span>
                                    <span class="status-badge ${statusClass}">${statusText}</span>
                                </div>
                                <div class="property-content">
                                    <h3 class="property-name">${window.escapeHtml(name)}</h3>
                                    <p class="property-address">
                                        <i class="fas fa-map-marker-alt"></i>
                                        ${window.escapeHtml(address)}
                                    </p>
                                    <div class="property-stats">
                                        <div class="stat">
                                            <span class="stat-label">Floors</span>
                                            <span class="stat-value">${floors}</span>
                                        </div>
                                        <div class="stat">
                                            <span class="stat-label">Rooms</span>
                                            <span class="stat-value">${rooms}</span>
                                        </div>
                                        <div class="stat">
                                            <span class="stat-label">Created</span>
                                            <span class="stat-value">${new Date(prop.createdAt).getFullYear()}</span>
                                        </div>
                                    </div>
                                    <div class="property-actions">
                                        <button class="btn btn-sm btn-primary" onclick="if(window.propertiesController && typeof window.propertiesController.viewProperty === 'function') window.propertiesController.viewProperty('${prop.id}')">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="if(window.propertiesController && typeof window.propertiesController.editProperty === 'function') window.propertiesController.editProperty('${prop.id}')">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });

                    container.innerHTML = html;

                    // attach interaction handlers so clicks anywhere on a card
                    // open the view/edit modal.  This ensures dashboard cards work
                    // as expected even when the PropertiesController isn't
                    // initialized for that page.
                    container.querySelectorAll('.property-card').forEach(card => {
                        const propId = card.getAttribute('data-property-id');
                        if (!propId) {
                            console.warn('⚠️ Property card found but has no data-property-id attribute:', card);
                            return;
                        }

                        // view when card itself clicked (excluding buttons)
                        card.addEventListener('click', (e) => {
                            // ignore clicks on any button inside the card
                            if (e.target.closest('button')) return;
                            console.log('dashboard/property card clicked', propId);
                            if (window.propertiesController) {
                                window.propertiesController.viewProperty(propId);
                            }
                        });

                        // view button
                        card.querySelector('.btn-primary')?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            console.log('dashboard view button clicked', propId);
                            if (window.propertiesController) {
                                window.propertiesController.viewProperty(propId);
                            }
                        });

                        // edit button
                        card.querySelector('.btn-secondary')?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            console.log('dashboard edit button clicked', propId);
                            if (window.propertiesController && typeof window.propertiesController.editProperty === 'function') {
                                window.propertiesController.editProperty(propId);
                            } else {
                                console.warn('attempted edit but editProperty not available', window.propertiesController);
                                // try recreating controller quickly then retry once
                                if (typeof PropertiesController !== 'undefined' && window.dataService) {
                                    window.propertiesController = new PropertiesController(window.dataService);
                                    console.log('Reinstantiated propertiesController after missing method');
                                    if (typeof window.propertiesController.editProperty === 'function') {
                                        window.propertiesController.editProperty(propId);
                                    }
                                }
                            }
                        });
                    });
                };

                // Tenants display helper
                window.displayTenants = window.displayTenants || function(tenants) {
                    console.log('View helper displayTenants called with', tenants?.length || 0, 'tenants');
                    // This would normally update the tenants list in the UI
                };

                // Bills display helper
                window.displayBills = window.displayBills || function(bills) {
                    console.log('View helper displayBills called with', bills?.length || 0, 'bills');
                    // This would normally update the bills list in the UI
                };

                // Maintenance requests display helper
                window.displayMaintenanceRequests = window.displayMaintenanceRequests || function(requests) {
                    console.log('View helper displayMaintenanceRequests called with', requests?.length || 0, 'requests');
                    // This would normally update the maintenance requests list in the UI
                };

                // Leases display helper
                window.displayLeases = window.displayLeases || function(leases) {
                    console.log('View helper displayLeases called with', leases?.length || 0, 'leases');
                    // This would normally update the leases list in the UI
                };

                // Backwards-compatible names used by some controllers
                window.displayPropertiesList = window.displayPropertiesList || function(list) {
                    if (typeof window.displayProperties === 'function') return window.displayProperties(list);
                    console.log('View helper displayPropertiesList called', list && list.length);
                };

                window.displayTenantsList = window.displayTenantsList || function(list) {
                    if (typeof window.displayTenants === 'function') return window.displayTenants(list);
                    console.log('View helper displayTenantsList called', list && list.length);
                };

                window.displayBillsList = window.displayBillsList || function(list) {
                    if (typeof window.displayBills === 'function') return window.displayBills(list);
                    console.log('View helper displayBillsList called', list && list.length);
                };

                window.displayMaintenanceList = window.displayMaintenanceList || function(list) {
                    if (typeof window.displayMaintenanceRequests === 'function') return window.displayMaintenanceRequests(list);
                    console.log('View helper displayMaintenanceList called', list && list.length);
                };

                window.displayLeasesList = window.displayLeasesList || function(list) {
                    if (typeof window.displayLeases === 'function') return window.displayLeases(list);
                    console.log('View helper displayLeasesList called', list && list.length);
                };

                // Error handling helpers for Properties
                window.showPropertiesError = window.showPropertiesError || function(message) {
                    console.log('View helper showPropertiesError:', message);
                    const errorEl = document.getElementById('propertiesError') || 
                                   document.querySelector('#propertiesSection .error-message') ||
                                   document.querySelector('#propertiesSection [class*="error"]');
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.style.display = 'block';
                    }
                };

                window.hidePropertiesError = window.hidePropertiesError || function() {
                    console.log('View helper hidePropertiesError');
                    const errorEl = document.getElementById('propertiesError') || 
                                   document.querySelector('#propertiesSection .error-message') ||
                                   document.querySelector('#propertiesSection [class*="error"]');
                    if (errorEl) {
                        errorEl.style.display = 'none';
                    }
                };

                // Error handling helpers for Tenants
                window.showTenantsError = window.showTenantsError || function(message) {
                    console.log('View helper showTenantsError:', message);
                    const errorEl = document.getElementById('tenantsError') || 
                                   document.querySelector('#tenantsSection .error-message') ||
                                   document.querySelector('#tenantsSection [class*="error"]');
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.style.display = 'block';
                    }
                };

                window.hideTenantsError = window.hideTenantsError || function() {
                    console.log('View helper hideTenantsError');
                    const errorEl = document.getElementById('tenantsError') || 
                                   document.querySelector('#tenantsSection .error-message') ||
                                   document.querySelector('#tenantsSection [class*="error"]');
                    if (errorEl) {
                        errorEl.style.display = 'none';
                    }
                };

                // Error handling helpers for Billing
                window.showBillingError = window.showBillingError || function(message) {
                    console.log('View helper showBillingError:', message);
                    const errorEl = document.getElementById('billingError') || 
                                   document.querySelector('#billingSection .error-message') ||
                                   document.querySelector('#billingSection [class*="error"]');
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.style.display = 'block';
                    }
                };

                window.hideBillingError = window.hideBillingError || function() {
                    console.log('View helper hideBillingError');
                    const errorEl = document.getElementById('billingError') || 
                                   document.querySelector('#billingSection .error-message') ||
                                   document.querySelector('#billingSection [class*="error"]');
                    if (errorEl) {
                        errorEl.style.display = 'none';
                    }
                };

                // Error handling helpers for Maintenance
                window.showMaintenanceError = window.showMaintenanceError || function(message) {
                    console.log('View helper showMaintenanceError:', message);
                    const errorEl = document.getElementById('maintenanceError') || 
                                   document.querySelector('#maintenanceSection .error-message') ||
                                   document.querySelector('#maintenanceSection [class*="error"]');
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.style.display = 'block';
                    }
                };

                window.hideMaintenanceError = window.hideMaintenanceError || function() {
                    console.log('View helper hideMaintenanceError');
                    const errorEl = document.getElementById('maintenanceError') || 
                                   document.querySelector('#maintenanceSection .error-message') ||
                                   document.querySelector('#maintenanceSection [class*="error"]');
                    if (errorEl) {
                        errorEl.style.display = 'none';
                    }
                };

                // Stats update helpers
                window.updateBillingStats = window.updateBillingStats || function(stats) {
                    console.log('View helper updateBillingStats:', stats);
                    try {
                        // Update total bills
                        const totalEl = document.querySelector('[data-stat="total-bills"]');
                        if (totalEl) totalEl.textContent = stats.total || 0;
                        
                        // Update overdue
                        const overdueEl = document.querySelector('[data-stat="overdue-bills"]');
                        if (overdueEl) overdueEl.textContent = stats.overdueAmount || 0;
                        
                        // Update collected
                        const collectedEl = document.querySelector('[data-stat="collected-amount"]');
                        if (collectedEl) collectedEl.textContent = stats.collectedAmount || 0;
                    } catch (e) {
                        console.warn('Error updating billing stats display:', e);
                    }
                };

                window.updateMaintenanceStats = window.updateMaintenanceStats || function(stats) {
                    console.log('View helper updateMaintenanceStats:', stats);
                    try {
                        // Update pending
                        const pendingEl = document.querySelector('[data-stat="pending-requests"]');
                        if (pendingEl) pendingEl.textContent = stats.pending || 0;
                        
                        // Update in-progress
                        const inProgressEl = document.querySelector('[data-stat="in-progress-requests"]');
                        if (inProgressEl) inProgressEl.textContent = stats.inProgress || 0;
                        
                        // Update closed
                        const closedEl = document.querySelector('[data-stat="closed-requests"]');
                        if (closedEl) closedEl.textContent = stats.closed || 0;
                    } catch (e) {
                        console.warn('Error updating maintenance stats display:', e);
                    }
                };

                // Pagination helper
                window.updatePagination = window.updatePagination || function(currentPage, totalPages, onPageChange) {
                    console.log('View helper updatePagination:', { currentPage, totalPages });
                    try {
                        const paginationEl = document.querySelector('.pagination') || 
                                            document.querySelector('[data-component="pagination"]');
                        if (paginationEl) {
                            // Clear existing pagination buttons
                            paginationEl.innerHTML = '';
                            
                            // Add previous button
                            if (currentPage > 1) {
                                const prevBtn = document.createElement('button');
                                prevBtn.textContent = '← Previous';
                                prevBtn.className = 'btn btn-sm btn-outline-secondary';
                                prevBtn.onclick = () => onPageChange(currentPage - 1);
                                paginationEl.appendChild(prevBtn);
                            }
                            
                            // Add page info
                            const pageInfo = document.createElement('span');
                            pageInfo.className = 'pagination-info';
                            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
                            paginationEl.appendChild(pageInfo);
                            
                            // Add next button
                            if (currentPage < totalPages) {
                                const nextBtn = document.createElement('button');
                                nextBtn.textContent = 'Next →';
                                nextBtn.className = 'btn btn-sm btn-outline-secondary';
                                nextBtn.onclick = () => onPageChange(currentPage + 1);
                                paginationEl.appendChild(nextBtn);
                            }
                        }
                    } catch (e) {
                        console.warn('Error updating pagination display:', e);
                    }
                };

            } catch (shimErr) {
                console.warn('⚠️ Utility/view shim warning:', shimErr);
            }

            // Wait for controllers to auto-initialize
            setTimeout(() => {
                verifyControllers();
                initializeApp();
            }, 500);

        } catch (error) {
            console.error('❌ MVC Initialization Error:', error);
            showError('Application Initialization Error', error.message);
        }
    }

    /**
     * Verify all controllers are initialized
     */
    function verifyControllers() {
        const controllers = {
            'Auth': window.authController,
            'Dashboard': window.dashboardController,
            'Properties': window.propertiesController,
            'Tenants': window.tenantsController,
            'Billing': window.billingController,
            'Maintenance': window.maintenanceController
        };

        for (const [name, controller] of Object.entries(controllers)) {
            if (controller) {
                console.log(`✅ ${name}Controller initialized`);
            } else {
                console.warn(`⚠️ ${name}Controller not initialized`);
            }
        }
    }

    /**
     * Initialize Application
     */
    function initializeApp() {
        console.log('🎯 Initializing application with auth waiting...');

        try {
            // Set up global auth state tracking
            window.authReady = false;
            window.currentUser = null;
            
            // Define function to handle authenticated state
            const handleAuthenticated = (user) => {
                if (user) {
                    console.log('✅ User authenticated:', user.email);
                    window.currentUser = user;
                    window.authReady = true;
                    
                    // Initialize controllers that need authentication
                    initializeAuthenticatedControllers();
                    
                    // Hide login, show app
                    const loginSection = document.getElementById('loginSection');
                    const appSection = document.getElementById('appSection');
                    if (loginSection) loginSection.style.display = 'none';
                    if (appSection) appSection.style.display = 'block';
                } else {
                    console.log('ℹ️ No user authenticated, showing login');
                    window.authReady = false;
                    window.currentUser = null;
                    
                    // Initialize auth controller for login form
                    if (window.authController && typeof window.authController.init === 'function') {
                        window.authController.init();
                    }
                    
                    // Show login, hide app
                    const loginSection = document.getElementById('loginSection');
                    const appSection = document.getElementById('appSection');
                    if (loginSection) loginSection.style.display = 'block';
                    if (appSection) appSection.style.display = 'none';
                }
            };

            /**
             * Wait for authentication before initializing controllers
             */
            function waitForAuthAndInitialize() {
                console.log('⏳ Waiting for authentication...');
                
                // Set a timeout in case auth never happens
                const authTimeout = setTimeout(() => {
                    console.warn('⚠️ Auth timeout - proceeding with unauthenticated state');
                    handleAuthenticated(null);
                }, 10000); // 10 second timeout
                
                // Use AuthManager when available
                if (window.AuthManager && typeof window.AuthManager.onAuthChange === 'function') {
                    console.log('🔐 Using AuthManager for authentication');
                    window.AuthManager.onAuthChange((enhancedUser) => {
                        clearTimeout(authTimeout);
                        handleAuthenticated(enhancedUser);
                    });
                } 
                // Fallback to Firebase auth
                else if (window.firebaseService && typeof window.firebaseService.onAuthStateChanged === 'function') {
                    console.log('🔐 Using FirebaseService for authentication');
                    window.firebaseService.onAuthStateChanged((user) => {
                        clearTimeout(authTimeout);
                        handleAuthenticated(user);
                    });
                }
                // Legacy fallback
                else if (typeof firebase !== 'undefined' && firebase.auth) {
                    console.log('🔐 Using Firebase auth directly');
                    firebase.auth().onAuthStateChanged((user) => {
                        clearTimeout(authTimeout);
                        handleAuthenticated(user);
                    });
                }
                else {
                    console.error('❌ No authentication method available');
                    clearTimeout(authTimeout);
                    handleAuthenticated(null);
                }
            }

            /**
             * Initialize controllers that require authentication
             */
            function initializeAuthenticatedControllers() {
                console.log('🚀 Initializing authenticated controllers...');
                
                // Wait a bit to ensure window.currentUser is set
                setTimeout(() => {
                    console.log('👤 Current user for controllers:', window.currentUser ? window.currentUser.email : 'null');
                    
                    // Initialize controllers in order with error handling
                    const controllerInitOrder = [
                        { name: 'dashboardController', method: 'init' },
                        { name: 'propertiesController', method: 'init' },
                        { name: 'tenantsController', method: 'init' },
                        { name: 'billingController', method: 'init' },
                        { name: 'maintenanceController', method: 'init' }
                    ];
                    
                    let delay = 0;
                    controllerInitOrder.forEach(({ name, method }) => {
                        setTimeout(() => {
                            const controller = window[name];
                            if (controller && typeof controller[method] === 'function') {
                                console.log(`✅ Initializing ${name}...`);
                                try {
                                    controller[method]();
                                } catch (error) {
                                    console.error(`❌ Error initializing ${name}:`, error);
                                }
                            } else {
                                console.warn(`⚠️ ${name} not available for initialization`);
                            }
                        }, delay);
                        
                        delay += 200; // Stagger initialization
                    });
                    
                    console.log('✅ All authenticated controllers initialized');
                }, 300); // 300ms delay to ensure auth is ready
            }

            // Start waiting for authentication
            waitForAuthAndInitialize();

            // Hide loading spinner with delay
            setTimeout(() => {
                const spinner = document.getElementById('loadingSpinner');
                if (spinner) {
                    spinner.style.display = 'none';
                    console.log('✅ Loading spinner hidden');
                }
            }, 1000);

            console.log('✅ Application initialization started');

        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            showError('Initialization Error', error.message);
        }
    }

    /**
     * Show error message
     */
    function showError(title, message) {
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
                    <div style="text-align: center; max-width: 500px; padding: 40px;">
                        <h1 style="color: #d32f2f; margin-bottom: 20px;">⚠️ ${title}</h1>
                        <p style="color: #666; margin-bottom: 20px; font-size: 16px;">${message}</p>
                        <button onclick="location.reload()" style="padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Start loading scripts
     */
    console.log('🔧 CasaLink MVC Bootstrap Starting...');
    console.log(`📋 Loading ${mvcScripts.length} MVC scripts + ${legacyScripts.length} legacy scripts`);

    // Load MVC scripts first
    const allScripts = [...mvcScripts, ...legacyScripts];
    loadScripts(allScripts, initializeMVCApp);
})();