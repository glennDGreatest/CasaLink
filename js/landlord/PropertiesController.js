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
    async init() {
        console.log('🏠 Initializing Properties View...');

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
        const container = document.getElementById('propertiesContainer');
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
        // Add property button
        const addBtn = document.getElementById('addPropertyBtn');
        const addBtnEmpty = document.getElementById('addPropertyBtnEmpty');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddPropertyModal());
        }
        if (addBtnEmpty) {
            addBtnEmpty.addEventListener('click', () => this.openAddPropertyModal());
        }

        // Search
        const searchInput = document.getElementById('propertySearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value;
                this.applyFilters();
            });
        }

        // Filters
        const typeFilter = document.getElementById('propertyTypeFilter');
        const statusFilter = document.getElementById('propertyStatusFilter');
        const clearBtn = document.getElementById('clearFiltersBtn');

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
                document.getElementById('propertySearch').value = '';
                document.getElementById('propertyTypeFilter').value = '';
                document.getElementById('propertyStatusFilter').value = '';
                this.applyFilters();
            });
        }

        // Modal events
        const modal = document.getElementById('propertyModal');
        const form = document.getElementById('propertyForm');
        const closeBtn = document.getElementById('propertyModalClose');
        const cancelBtn = document.getElementById('propertyModalCancel');

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
        const deleteModal = document.getElementById('deletePropertyModal');
        const deleteCloseBtn = document.getElementById('deletePropertyModalClose');
        const deleteCancelBtn = document.getElementById('deletePropertyCancel');
        const deleteConfirmBtn = document.getElementById('deletePropertyConfirm');

        if (deleteCloseBtn) {
            deleteCloseBtn.addEventListener('click', () => this.closeDeleteModal());
        }

        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => this.closeDeleteModal());
        }

        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', () => this.confirmDelete());
        }

        // Pagination
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

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
    }

    /**
     * Open add property modal
     */
    openAddPropertyModal() {
        this.editingPropertyId = null;
        document.getElementById('propertyModalTitle').textContent = 'Add New Property';
        document.getElementById('propertyForm').reset();
        document.getElementById('propertyModal').style.display = 'flex';
    }

    /**
     * Open edit property modal
     */
    editProperty(propertyId) {
        const property = this.allProperties.find(p => p.id === propertyId);
        if (!property) return;

        this.editingPropertyId = propertyId;
        document.getElementById('propertyModalTitle').textContent = 'Edit Property';

        // Populate form
        document.getElementById('propertyName').value = property.name || '';
        document.getElementById('propertyType').value = property.propertyType || '';
        document.getElementById('propertyStatus').value = property.status || 'active';
        document.getElementById('totalUnits').value = property.totalUnits || '';
        document.getElementById('propertyAddress').value = property.address || '';
        document.getElementById('propertyCity').value = property.city || '';
        document.getElementById('propertyState').value = property.state || '';
        document.getElementById('propertyZipCode').value = property.zipCode || '';
        document.getElementById('yearBuilt').value = property.yearBuilt || '';
        document.getElementById('squareFootage').value = property.squareFootage || '';
        document.getElementById('propertyDescription').value = property.description || '';

        // Set amenities checkboxes
        document.querySelectorAll('input[name="amenities"]').forEach(checkbox => {
            checkbox.checked = (property.amenities || []).includes(checkbox.value);
        });

        document.getElementById('propertyModal').style.display = 'flex';
    }

    /**
     * Handle property form submission
     */
    async handlePropertySubmit() {
        try {
            // Wait for Firebase
            await this.waitForFirebase();

            // Collect form data
            const propertyData = {
                name: document.getElementById('propertyName').value,
                propertyType: document.getElementById('propertyType').value,
                status: document.getElementById('propertyStatus').value,
                totalUnits: parseInt(document.getElementById('totalUnits').value),
                address: document.getElementById('propertyAddress').value,
                city: document.getElementById('propertyCity').value,
                state: document.getElementById('propertyState').value,
                zipCode: document.getElementById('propertyZipCode').value,
                yearBuilt: document.getElementById('yearBuilt').value || null,
                squareFootage: parseFloat(document.getElementById('squareFootage').value) || 0,
                description: document.getElementById('propertyDescription').value,
                amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
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
     * View property details
     */
    viewProperty(propertyId) {
        if (window.casaLink) {
            window.casaLink.showPage('property-detail', propertyId);
        }
    }

    /**
     * Open delete confirmation modal
     */
    openDeleteConfirm(propertyId) {
        const property = this.allProperties.find(p => p.id === propertyId);
        if (!property) return;

        this.deleteConfirmPropertyId = propertyId;
        const message = `Are you sure you want to delete "${property.name}"? This will also delete all associated units and data.`;
        document.getElementById('deletePropertyMessage').textContent = message;
        document.getElementById('deletePropertyModal').style.display = 'flex';
    }

    /**
     * Confirm and delete property
     */
    async confirmDelete() {
        try {
            if (!this.deleteConfirmPropertyId) return;

            // Wait for Firebase
            await this.waitForFirebase();

            const deleteBtn = document.getElementById('deletePropertyConfirm');
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
            const deleteBtn = document.getElementById('deletePropertyConfirm');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Property';
            deleteBtn.disabled = false;
        }
    }

    /**
     * Close modals
     */
    closePropertyModal() {
        document.getElementById('propertyModal').style.display = 'none';
        this.editingPropertyId = null;
    }

    closeDeleteModal() {
        document.getElementById('deletePropertyModal').style.display = 'none';
        this.deleteConfirmPropertyId = null;
    }

    /**
     * Update pagination UI
     */
    updatePagination() {
        const pagination = document.getElementById('propertiesPagination');
        const pageInfo = document.getElementById('pageInfo');
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
        const loading = document.getElementById('propertiesLoading');
        if (loading) loading.style.display = show ? 'grid' : 'none';
    }

    showEmpty(show = true) {
        const empty = document.getElementById('propertiesEmpty');
        if (empty) empty.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const error = document.getElementById('propertiesError');
        const errorMsg = document.getElementById('propertiesErrorMessage');
        if (error) {
            errorMsg.textContent = message;
            error.style.display = 'flex';
        }
    }

    hideError() {
        const error = document.getElementById('propertiesError');
        if (error) error.style.display = 'none';
    }

    hideEmpty() {
        const empty = document.getElementById('propertiesEmpty');
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