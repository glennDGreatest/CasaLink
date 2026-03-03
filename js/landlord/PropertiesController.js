/**
 * PropertiesController - Manages property CRUD operations for landlords
 * Follows CasaLink MVC pattern and integrates with DataService
 */
class PropertiesController {
    constructor(dataService) {
        this.service = dataService;
        this.currentUser = window.currentUser || null;
        this.allProperties = [];
        this.filteredProperties = [];
        this.currentPage = 1;
        this.itemsPerPage = 9;
        this.totalPages = 1;
        this.currentFilters = {
            search: '',
            type: '',
            status: ''
        };
        this.editingPropertyId = null;
        this.deleteConfirmPropertyId = null;

        console.log('✅ PropertiesController initialized');
    }

    /**
     * Initialize controller and load properties
     */
    /**
     * Initialize controller and load properties
     * @param {HTMLElement} root Optional root element to scope DOM queries
     */
    async init(root = document) {
        console.log('🏠 Initializing Properties View with root:', root);
        this.root = root;

        try {
            // Set loading state
            this.showLoading(true);
            this.hideError();
            this.hideEmpty();

            // Load properties for current landlord
            await this.loadProperties();

            // Setup event listeners
            this.setupEventListeners();

            console.log('✅ Properties View initialized');
        } catch (error) {
            console.error('❌ Error initializing properties view:', error);
            this.showError('Failed to load properties: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load all properties for the current landlord
     */
    async loadProperties() {
        try {
            if (!this.currentUser || !this.currentUser.uid) {
                throw new Error('User not authenticated');
            }

            // Wait for Firebase to be initialized
            await this.waitForFirebase();

            if (!window.firebaseDb) {
                throw new Error('Firebase is not initialized');
            }

            // Fetch properties from service
            const snapshot = await window.firebaseDb
                .collection('properties')
                .where('landlordId', '==', this.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .get();

            this.allProperties = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply filters and display
            this.applyFilters();

        } catch (error) {
            console.error('❌ Error loading properties:', error);
            throw error;
        }
    }

    /**
     * Wait for Firebase to be initialized with timeout
     */
    async waitForFirebase() {
        const maxAttempts = 50; // 5 seconds max
        let attempts = 0;

        while (!window.firebaseDb && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.firebaseDb) {
            throw new Error('Firebase failed to initialize');
        }
    }

    /**
     * Apply current filters to properties list
     */
    applyFilters() {
        let filtered = [...this.allProperties];

        // Search filter
        if (this.currentFilters.search) {
            const search = this.currentFilters.search.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(search) ||
                p.address.toLowerCase().includes(search) ||
                p.city.toLowerCase().includes(search)
            );
        }

        // Type filter
        if (this.currentFilters.type) {
            filtered = filtered.filter(p => p.propertyType === this.currentFilters.type);
        }

        // Status filter
        if (this.currentFilters.status) {
            filtered = filtered.filter(p => p.status === this.currentFilters.status);
        }

        this.filteredProperties = filtered;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.filteredProperties.length / this.itemsPerPage);

        // Render properties
        this.renderProperties();
    }

    /**
     * Render properties grid based on current page
     */
    renderProperties() {
        // Try both possible container IDs
        let container = (this.root || document).querySelector('#propertiesContainer');
        if (!container) {
            container = (this.root || document).querySelector('#propertiesGrid');
        }
        if (!container) return;

        // Check empty state
        if (this.filteredProperties.length === 0) {
            this.showEmpty(this.allProperties.length === 0);
            container.innerHTML = '';
            return;
        }

        this.hideEmpty();

        // Calculate pagination
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        const pageProperties = this.filteredProperties.slice(startIdx, endIdx);

        // Render cards
        container.innerHTML = pageProperties.map(property => this.renderPropertyCard(property)).join('');

        // Update pagination
        this.updatePagination();
    }

    /**
     * Render a single property card
     */
    renderPropertyCard(property) {
        const occupancyRate = this.calculateOccupancyRate(property);
        const statusClass = property.status === 'active' ? 'status-active' : 'status-inactive';
        const typeIcon = this.getPropertyTypeIcon(property.propertyType);

        return `
            <div class="property-card" data-property-id="${property.id}">
                <div class="property-image">
                    <div class="property-placeholder">
                        <i class="fas ${typeIcon}"></i>
                    </div>
                    <span class="property-type-badge">${this.formatPropertyType(property.propertyType)}</span>
                    <span class="status-badge ${statusClass}">${property.status}</span>
                </div>

                <div class="property-content">
                    <h3 class="property-name">${this.escapeHtml(property.name)}</h3>
                    <p class="property-address">
                        <i class="fas fa-map-marker-alt"></i>
                        ${this.escapeHtml(property.address)}, ${this.escapeHtml(property.city)}, ${this.escapeHtml(property.state)}
                    </p>

                    <div class="property-stats">
                        <div class="stat">
                            <span class="stat-label">Units</span>
                            <span class="stat-value">${property.totalUnits || 0}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Occupancy</span>
                            <span class="stat-value">${occupancyRate}%</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Monthly Revenue</span>
                            <span class="stat-value">$${(property.monthlyRevenue || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="property-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${occupancyRate}%"></div>
                        </div>
                        <small>${occupancyRate}% Occupied</small>
                    </div>

                    <div class="property-actions">
                        <button class="btn btn-sm btn-primary" onclick="if(window.propertiesController) window.propertiesController.viewProperty('${property.id}')">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="if(window.propertiesController) window.propertiesController.editProperty('${property.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="if(window.propertiesController) window.propertiesController.openDeleteConfirm('${property.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for the view
     */
    setupEventListeners() {
        const root = this.root || document;

        // Add property button
        const addBtn = root.querySelector('#addPropertyBtn');
        const addBtnEmpty = root.querySelector('#addPropertyBtnEmpty');
        console.log('PropertiesController.setupEventListeners() found addBtn, addBtnEmpty:', addBtn, addBtnEmpty);
        // use a dedicated method that matches dashboard behaviour
        if (addBtn) {
            addBtn.addEventListener('click', () => this.triggerAddProperty());
        }
        if (addBtnEmpty) {
            addBtnEmpty.addEventListener('click', () => this.triggerAddProperty());
        }

        // listen for any property additions elsewhere so list stays up to date
        document.addEventListener('propertyAdded', () => {
            // reload properties when event fires
            this.loadProperties().catch(err => console.warn('Unable to reload properties after add event:', err));
        });

        // Search
        const searchInput = root.querySelector('#propertySearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value;
                this.applyFilters();
            });
        }

        // Filters
        const typeFilter = root.querySelector('#propertyTypeFilter');
        const statusFilter = root.querySelector('#propertyStatusFilter');
        const clearBtn = root.querySelector('#clearFiltersBtn');

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentFilters.type = e.target.value;
                this.applyFilters();
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentFilters.status = e.target.value;
                this.applyFilters();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.currentFilters = { search: '', type: '', status: '' };
                root.querySelector('#propertySearch').value = '';
                root.querySelector('#propertyTypeFilter').value = '';
                root.querySelector('#propertyStatusFilter').value = '';
                this.applyFilters();
            });
        }

        // Modal events
        const modal = root.querySelector('#propertyModal');
        const form = root.querySelector('#propertyForm');
        const closeBtn = root.querySelector('#propertyModalClose');
        const cancelBtn = root.querySelector('#propertyModalCancel');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePropertySubmit();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePropertyModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closePropertyModal());
        }

        // Delete modal
        const deleteModal = root.querySelector('#deletePropertyModal');
        const deleteCloseBtn = root.querySelector('#deletePropertyModalClose');
        const deleteCancelBtn = root.querySelector('#deletePropertyCancel');
        const deleteConfirmBtn = root.querySelector('#deletePropertyConfirm');

        if (deleteCloseBtn) {
            deleteCloseBtn.addEventListener('click', () => this.closeDeleteModal());
        }

        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => this.closeDeleteModal());
        }

        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', () => this.confirmDelete());
        }

        // Property Details Modal
        const propertyDetailsModal = document.querySelector('#propertyDetailsModal');
        if (propertyDetailsModal) {
            // Close when clicking outside modal
            propertyDetailsModal.addEventListener('click', (e) => {
                if (e.target === propertyDetailsModal) {
                    this.closePropertyDetailsModal();
                }
            });

            // Close with ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && propertyDetailsModal.style.display === 'flex') {
                    this.closePropertyDetailsModal();
                }
            });
        }

        // Pagination
        const prevBtn = root.querySelector('#prevPageBtn');
        const nextBtn = root.querySelector('#nextPageBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderProperties();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.renderProperties();
                }
            });
        }

        // clickable cards: open view (edit) modal when card or view button clicked
        const containers = [
            root.querySelector('#propertiesContainer'),
            root.querySelector('#propertiesGrid')
        ].filter(Boolean);

        containers.forEach(container => {
            container.addEventListener('click', (e) => {
                const card = e.target.closest('.property-card');
                if (!card) return;

                const id = card.getAttribute('data-property-id');
                if (!id) return;
                console.log('property card clicked', id);

                // if click came from edit button we let its own handler run
                if (e.target.closest('.btn-secondary') || e.target.classList.contains('fa-edit')) {
                    // explicit edit request
                    console.log('edit button detected in card click');
                    this.editProperty(id);
                    e.stopPropagation();
                    return;
                }

                // otherwise treat as view
                this.viewProperty(id);
            });
        });
    }

    /**
     * Trigger the add‑property flow.
     * This mirrors the dashboard "Add Property" button, opening the
     * multi‑step apartment modal when the CASA link helper is available
     * and otherwise falling back to the legacy inline modal.
     */
    triggerAddProperty() {
        console.log('triggerAddProperty() invoked');
        if (window.casaLink && typeof window.casaLink.showAddPropertyForm === 'function') {
            console.log('Calling casaLink.showAddPropertyForm() from PropertiesController');
            try {
                window.casaLink.showAddPropertyForm();
            } catch (err) {
                console.error('Error while calling showAddPropertyForm:', err);
                // fallback to legacy modal if possible
                this.openAddPropertyModal();
            }
        } else {
            console.warn('casaLink or showAddPropertyForm unavailable, using fallback
 to inline modal');
            this.openAddPropertyModal();
        }
    }

    /**
     * Open add property modal
     */
    openAddPropertyModal() {
        // prefer the dashboard multi‑step form when available
        if (window.casaLink && typeof window.casaLink.showAddPropertyForm === 'function') {
            window.casaLink.showAddPropertyForm();
            return;
        }

        // fallback to legacy inline modal
        // always query from document so we can find the shared modal element
        const root = document;
        console.log('openAddPropertyModal() fallback using document root');
        this.editingPropertyId = null;
        const titleEl = root.querySelector('#propertyModalTitle');
        const formEl = root.querySelector('#propertyForm');
        const modalEl = root.querySelector('#propertyModal');
        if (!modalEl) {
            console.warn('openAddPropertyModal: propertyModal element not found');
            return;
        }
        if (titleEl) titleEl.textContent = 'Add New Property';
        if (formEl) formEl.reset();
        modalEl.style.display = 'flex';
    }

    /**
     * Open edit property modal
     */
    editProperty(propertyId) {
        const property = this.allProperties.find(p => p.id === propertyId);
        if (!property) return;

        console.log('editProperty() loading data for', propertyId);
        // use document as root for modal access; when page content is injected
        // the inline modal lives outside the scoped area
        const root = document;
        this.editingPropertyId = propertyId;
        const titleEl = root.querySelector('#propertyModalTitle');
        if (titleEl) titleEl.textContent = 'Edit Property';

        // Populate form
        const setVal = (selector, value) => {
            const el = root.querySelector(selector);
            if (el) el.value = value || '';
        };

        setVal('#propertyName', property.name);
        setVal('#propertyType', property.propertyType);
        setVal('#propertyStatus', property.status || 'active');
        setVal('#totalUnits', property.totalUnits);
        setVal('#propertyAddress', property.address);
        setVal('#propertyCity', property.city);
        setVal('#propertyState', property.state);
        setVal('#propertyZipCode', property.zipCode);
        setVal('#yearBuilt', property.yearBuilt);
        setVal('#squareFootage', property.squareFootage);
        setVal('#propertyDescription', property.description);

        // Set amenities checkboxes
        root.querySelectorAll('input[name="amenities"]').forEach(checkbox => {
            checkbox.checked = (property.amenities || []).includes(checkbox.value);
        });

        const modalEl = root.querySelector('#propertyModal');
        if (modalEl) {
            modalEl.style.display = 'flex';
        } else {
            console.warn('editProperty: propertyModal element not found');
        }
    }

    /**
     * Handle property form submission
     */
    async handlePropertySubmit() {
        try {
            // Wait for Firebase
            await this.waitForFirebase();

            // Collect form data
            const root = this.root || document;
            const propertyData = {
                name: root.querySelector('#propertyName').value,
                propertyType: root.querySelector('#propertyType').value,
                status: root.querySelector('#propertyStatus').value,
                totalUnits: parseInt(root.querySelector('#totalUnits').value),
                address: root.querySelector('#propertyAddress').value,
                city: root.querySelector('#propertyCity').value,
                state: root.querySelector('#propertyState').value,
                zipCode: root.querySelector('#propertyZipCode').value,
                yearBuilt: root.querySelector('#yearBuilt').value || null,
                squareFootage: parseFloat(root.querySelector('#squareFootage').value) || 0,
                description: root.querySelector('#propertyDescription').value,
                amenities: Array.from(root.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
                landlordId: this.currentUser.uid,
                updatedAt: new Date(),
                monthlyRevenue: 0 // Will be calculated from units/leases
            };

            // Validate
            if (!propertyData.name || !propertyData.address || !propertyData.city || !propertyData.state) {
                throw new Error('Please fill in all required fields');
            }

            // Show loading
            const submitBtn = document.querySelector('#propertyForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            // Save to Firebase
            if (this.editingPropertyId) {
                // Update existing
                await window.firebaseDb
                    .collection('properties')
                    .doc(this.editingPropertyId)
                    .update(propertyData);

                console.log('✅ Property updated:', this.editingPropertyId);
                this.showToast('Property updated successfully', 'success');
            } else {
                // Create new
                propertyData.createdAt = new Date();
                const docRef = await window.firebaseDb.collection('properties').add(propertyData);
                console.log('✅ Property created:', docRef.id);
                this.showToast('Property created successfully', 'success');
            }

            // Reload and close
            await this.loadProperties();
            this.closePropertyModal();

        } catch (error) {
            console.error('❌ Error saving property:', error);
            this.showToast('Error: ' + error.message, 'error');
            const submitBtn = document.querySelector('#propertyForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Property';
            submitBtn.disabled = false;
        }
    }

    /**
     * View property details in a dedicated details modal
     */
    viewProperty(propertyId) {
        this.openPropertyDetailsModal(propertyId);
    }

    /**
     * Open property details modal with comprehensive information
     */
    async openPropertyDetailsModal(propertyId) {
        try {
            // Find property data
            const property = this.allProperties.find(p => p.id === propertyId);
            if (!property) {
                this.showToast('Property not found', 'error');
                return;
            }

            // Show modal with loading state
            const modal = document.getElementById('propertyDetailsModal');
            const content = document.getElementById('propertyDetailsContent');
            const loading = document.getElementById('propertyDetailsLoading');

            if (!modal) {
                console.error('Property details modal not found');
                return;
            }

            // Reset to loading state
            content.style.display = 'none';
            loading.style.display = 'flex';
            modal.style.display = 'flex';

            // Populate header information
            document.getElementById('propertyDetailsName').textContent = this.escapeHtml(property.name);
            const addressStr = `${property.address}, ${property.city}, ${property.state} ${property.zipCode || ''}`;
            document.getElementById('propertyDetailsAddress').textContent = addressStr;

            // Populate basic info grid
            document.getElementById('detailsPropertyType').textContent = this.formatPropertyType(property.propertyType);
            const statusBadge = document.getElementById('detailsPropertyStatus');
            statusBadge.textContent = property.status;
            statusBadge.className = property.status === 'active' ? 'status-badge status-active' : 'status-badge status-inactive';
            document.getElementById('detailsPropertyYearBuilt').textContent = property.yearBuilt || '-';
            document.getElementById('detailsPropertySqft').textContent = property.squareFootage ? `${property.squareFootage.toLocaleString()} sq ft` : '-';

            // Calculate and populate metrics
            const units = await this.fetchPropertyUnits(propertyId);
            const occupiedUnits = (units || []).filter(u => u.isOccupied).length;
            const occupancyRate = units && units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0;

            document.getElementById('detailsMetricUnits').textContent = (units || []).length;
            document.getElementById('detailsMetricOccupancy').textContent = `${occupancyRate}%`;
            document.getElementById('detailsMetricRevenue').textContent = `₱${(property.monthlyRevenue || 0).toLocaleString()}`;

            // Get maintenance count
            const maintenanceRequests = await this.fetchPropertyMaintenance(propertyId);
            const openMaintenance = (maintenanceRequests || []).filter(m => m.status !== 'completed').length;
            document.getElementById('detailsMetricMaintenance').textContent = openMaintenance;

            // Populate overview tab
            document.getElementById('detailsFullAddress').textContent = addressStr;
            const descEl = document.getElementById('detailsDescription');
            if (property.description) {
                descEl.textContent = property.description;
                descEl.style.fontStyle = 'normal';
                descEl.style.color = '#1f2937';
            }

            // Populate amenities
            const amenitiesEl = document.getElementById('detailsAmenities');
            if (property.amenities && property.amenities.length > 0) {
                amenitiesEl.innerHTML = property.amenities.map(a =>
                    `<span><i class="fas fa-check-circle"></i> ${this.formatPropertyType(a)}</span>`
                ).join('');
            }

            // Populate units tab
            await this.populateUnitsTab(units);

            // Populate maintenance tab
            await this.populateMaintenanceTab(maintenanceRequests);

            // Populate tenants tab
            const tenants = await this.fetchPropertyTenants(propertyId);
            await this.populateTenantsTab(tenants);

            // Populate activity tab
            const activities = await this.fetchPropertyActivity(propertyId);
            await this.populateActivityTab(activities);

            // Setup tab switching
            this.setupPropertyDetailsTabs();

            // Hide loading and show content
            loading.style.display = 'none';
            content.style.display = 'block';

        } catch (error) {
            console.error('Error opening property details modal:', error);
            this.showToast('Error loading property details: ' + error.message, 'error');
            document.getElementById('propertyDetailsModal').style.display = 'none';
        }
    }

    /**
     * Fetch property units from Firestore
     */
    async fetchPropertyUnits(propertyId) {
        try {
            await this.waitForFirebase();
            const snapshot = await window.firebaseDb
                .collection('units')
                .where('propertyId', '==', propertyId)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching units:', error);
            return [];
        }
    }

    /**
     * Fetch property maintenance requests
     */
    async fetchPropertyMaintenance(propertyId) {
        try {
            await this.waitForFirebase();
            const snapshot = await window.firebaseDb
                .collection('maintenance')
                .where('propertyId', '==', propertyId)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching maintenance:', error);
            return [];
        }
    }

    /**
     * Fetch property tenants
     */
    async fetchPropertyTenants(propertyId) {
        try {
            await this.waitForFirebase();
            // Get active leases for this property
            const snapshot = await window.firebaseDb
                .collection('leases')
                .where('propertyId', '==', propertyId)
                .where('status', '==', 'active')
                .get();

            const tenantIds = [...new Set(snapshot.docs.map(doc => doc.data().tenantId))];

            // Get tenant details
            const tenants = [];
            for (const tenantId of tenantIds) {
                try {
                    const tenantDoc = await window.firebaseDb.collection('users').doc(tenantId).get();
                    if (tenantDoc.exists) {
                        tenants.push({
                            id: tenantId,
                            ...tenantDoc.data()
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching tenant:', e);
                }
            }

            return tenants;
        } catch (error) {
            console.error('Error fetching tenants:', error);
            return [];
        }
    }

    /**
     * Fetch property activity/history
     */
    async fetchPropertyActivity(propertyId) {
        try {
            await this.waitForFirebase();
            // For now, return recent changes to the property
            // This could be enhanced with an activity log collection
            const snapshot = await window.firebaseDb
                .collection('properties')
                .doc(propertyId)
                .collection('activity')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.warn('Activity history not available:', error);
            return [];
        }
    }

    /**
     * Populate units tab content
     */
    async populateUnitsTab(units) {
        const unitsList = document.getElementById('unitsList');
        if (!units || units.length === 0) {
            unitsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No units found</p>';
            return;
        }

        unitsList.innerHTML = units.map(unit => `
            <div class="unit-item">
                <div class="unit-header">
                    <div class="unit-name">${this.escapeHtml(unit.unitNumber || 'Unit ' + unit.id.substring(0, 5))}</div>
                    <div class="unit-status">${unit.isOccupied ? 'Occupied' : 'Vacant'}</div>
                </div>
                <span class="status-badge ${unit.isOccupied ? 'status-active' : 'status-inactive'}">
                    ${unit.isOccupied ? 'Occupied' : 'Vacant'}
                </span>
            </div>
        `).join('');
    }

    /**
     * Populate maintenance tab content
     */
    async populateMaintenanceTab(requests) {
        const maintenanceList = document.getElementById('maintenanceList');
        if (!requests || requests.length === 0) {
            maintenanceList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No maintenance requests</p>';
            return;
        }

        maintenanceList.innerHTML = requests.map(req => {
            const date = req.createdAt ? new Date(req.createdAt.toDate?.() || req.createdAt).toLocaleDateString() : '';
            return `
                <div class="maintenance-item">
                    <div class="maintenance-header">
                        <div>
                            <div class="maintenance-title">${this.escapeHtml(req.title || 'Maintenance Request')}</div>
                            <div class="maintenance-description">${this.escapeHtml(req.description || '')}</div>
                        </div>
                        <span class="maintenance-status ${(req.status || 'pending').toLowerCase()}">
                            ${req.status || 'Pending'}
                        </span>
                    </div>
                    <div class="maintenance-date">${date}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Populate tenants tab content
     */
    async populateTenantsTab(tenants) {
        const tenantsList = document.getElementById('tenantsList');
        if (!tenants || tenants.length === 0) {
            tenantsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No active tenants</p>';
            return;
        }

        tenantsList.innerHTML = tenants.map(tenant => `
            <div class="tenant-item">
                <div class="tenant-info">
                    <div class="tenant-name">${this.escapeHtml(tenant.firstName || '')} ${this.escapeHtml(tenant.lastName || '')}</div>
                    <div class="tenant-unit">${this.escapeHtml(tenant.email || '')}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Populate activity tab content
     */
    async populateActivityTab(activities) {
        const activityList = document.getElementById('activityList');
        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No activity recorded</p>';
            return;
        }

        activityList.innerHTML = activities.map(activity => {
            const date = activity.timestamp ? new Date(activity.timestamp.toDate?.() || activity.timestamp).toLocaleDateString() : '';
            return `
                <div class="activity-item">
                    <div class="activity-icon"><i class="fas fa-circle"></i></div>
                    <div class="activity-content">
                        <div class="activity-title">${this.escapeHtml(activity.action || 'Activity')}</div>
                        <div class="activity-time">${date}</div>
                        ${activity.description ? `<div class="activity-description">${this.escapeHtml(activity.description)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Setup tab switching in property details modal
     */
    setupPropertyDetailsTabs() {
        const tabButtons = document.querySelectorAll('.property-tabs .tab-button');
        const tabPanes = document.querySelectorAll('.property-tab-content .tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');

                // Remove active class from all buttons and panes
                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.style.display = 'none');

                // Add active class to clicked button
                button.classList.add('active');

                // Show corresponding pane
                const pane = document.getElementById(`tab-${tabName}`);
                if (pane) {
                    pane.style.display = 'block';
                }
            });
        });
    }

    /**
     * Close property details modal
     */
    closePropertyDetailsModal() {
        const modal = document.getElementById('propertyDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Open edit property modal from details view
     */
    editPropertyFromDetails() {
        const propertyName = document.getElementById('propertyDetailsName').textContent;
        // Find the property by name
        const property = this.allProperties.find(p => p.name === propertyName);
        if (property) {
            this.closePropertyDetailsModal();
            this.editProperty(property.id);
        }
    }

    /**
     * Open edit property modal (called from list view)
     */
    openEditPropertyModal(propertyId) {
        this.editProperty(propertyId);
    }

    /**
     * Open delete confirmation modal
     */
    openDeleteConfirm(propertyId) {
        const property = this.allProperties.find(p => p.id === propertyId);
        if (!property) return;

        const root = this.root || document;
        this.deleteConfirmPropertyId = propertyId;
        const message = `Are you sure you want to delete "${property.name}"? This will also delete all associated units and data.`;
        root.querySelector('#deletePropertyMessage').textContent = message;
        root.querySelector('#deletePropertyModal').style.display = 'flex';
    }

    /**
     * Confirm and delete property
     */
    async confirmDelete() {
        try {
            if (!this.deleteConfirmPropertyId) return;

            // Wait for Firebase
            await this.waitForFirebase();

            const root = this.root || document;
            const deleteBtn = root.querySelector('#deletePropertyConfirm');
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            deleteBtn.disabled = true;

            // Delete property and associated units
            const batch = window.firebaseDb.batch();

            // Delete property
            batch.delete(window.firebaseDb.collection('properties').doc(this.deleteConfirmPropertyId));

            // Delete associated units
            const unitsSnapshot = await window.firebaseDb
                .collection('units')
                .where('propertyId', '==', this.deleteConfirmPropertyId)
                .get();

            unitsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            console.log('✅ Property deleted:', this.deleteConfirmPropertyId);
            this.showToast('Property deleted successfully', 'success');

            // Reload and close
            await this.loadProperties();
            this.closeDeleteModal();

        } catch (error) {
            console.error('❌ Error deleting property:', error);
            this.showToast('Error deleting property: ' + error.message, 'error');
            const deleteBtn = (this.root || document).querySelector('#deletePropertyConfirm');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Property';
            deleteBtn.disabled = false;
        }
    }

    /**
     * Close modals
     */
    closePropertyModal() {
        const root = this.root || document;
        const modal = root.querySelector('#propertyModal');
        if (modal) modal.style.display = 'none';
        this.editingPropertyId = null;
    }

    closeDeleteModal() {
        const root = this.root || document;
        const modal = root.querySelector('#deletePropertyModal');
        if (modal) modal.style.display = 'none';
        this.deleteConfirmPropertyId = null;
    }

    /**
     * Update pagination UI
     */
    updatePagination() {
        const root = this.root || document;
        const pagination = root.querySelector('#propertiesPagination');
        const pageInfo = root.querySelector('#pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (!pagination) return;

        if (this.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === this.totalPages;
    }

    /**
     * UI Helper Methods
     */
    showLoading(show = true) {
        const root = this.root || document;
        const loading = root.querySelector('#propertiesLoading');
        if (loading) loading.style.display = show ? 'grid' : 'none';
    }

    showEmpty(show = true) {
        const root = this.root || document;
        const empty = root.querySelector('#propertiesEmpty');
        if (empty) empty.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const root = this.root || document;
        const error = root.querySelector('#propertiesError');
        const errorMsg = root.querySelector('#propertiesErrorMessage');
        if (error) {
            errorMsg.textContent = message;
            error.style.display = 'flex';
        }
    }

    hideError() {
        const root = this.root || document;
        const error = root.querySelector('#propertiesError');
        if (error) error.style.display = 'none';
    }

    hideEmpty() {
        const root = this.root || document;
        const empty = root.querySelector('#propertiesEmpty');
        if (empty) empty.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideInUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /**
     * Utility Methods
     */
    calculateOccupancyRate(property) {
        // TODO: Calculate from actual units
        return 75; // Placeholder
    }

    getPropertyTypeIcon(type) {
        const icons = {
            'single-family': 'fa-home',
            'multi-family': 'fa-apartment',
            'commercial': 'fa-building',
            'condo': 'fa-cube',
            'townhouse': 'fa-rows'
        };
        return icons[type] || 'fa-home';
    }

    formatPropertyType(type) {
        return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.PropertiesController = PropertiesController;
}