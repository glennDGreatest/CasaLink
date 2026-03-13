/**
 * PropertiesController - Manages property CRUD operations for landlords
 * Follows CasaLink MVC pattern and integrates with DataService
 */
// Override or replace any existing global PropertiesController by assigning
// directly to window. Using a class expression avoids redeclaration errors
// when both generic and landlord versions are loaded.
window.PropertiesController = class PropertiesController {
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

        // which Firestore collection should we operate on?  the platform
        // historically used `properties` but later switched landlords to a
        // separate `apartments` collection; this value lets us point all
        // queries/updates in one place and fall back if needed.
        this._collection = 'apartments';

        // expose and bind for global use
        window.propertiesController = this;
        this.editProperty = this.editProperty.bind(this);
        this.openEditPropertyModal = this.openEditPropertyModal.bind(this);

        console.log('✅ Landlord PropertiesController initialized; editProperty=', typeof this.editProperty);
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

            // Landlord properties are now stored in the apartments collection.
            // Older code used the generic "properties" collection which is
            // why nothing appeared if the tenant had only apartment records.
            // Use DataManager helper so the logic stays in one place and the
            // controller remains thin.
            let apartments = [];
            if (window.DataManager && typeof window.DataManager.getLandlordApartments === 'function') {
                apartments = await window.DataManager.getLandlordApartments(this.currentUser.uid);
            } else {
                // fallback: query directly
                const snapshot = await window.firebaseDb
                    .collection('apartments')
                    .where('landlordId', '==', this.currentUser.uid)
                    .where('isActive', '==', true)
                    .orderBy('createdAt', 'desc')
                    .get();
                apartments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            // store results using the same property terminology
            this.allProperties = apartments;
            console.log('✅ Landlord PropertiesController loaded items:', this.allProperties);

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
        
        // room details helpers (dynamic forms)
        const addRoomBtn = root.querySelector('#addRoomBtn');
        const refreshTotal = () => {
            const total = document.querySelectorAll('#roomDetailsContainer .room-form').length;
            const totalEl = document.querySelector('#totalUnits');
            if (totalEl) totalEl.value = total;
        };
        if (addRoomBtn) {
            addRoomBtn.addEventListener('click', () => {
                const container = document.querySelector('#roomDetailsContainer');
                if (container) {
                    container.insertAdjacentHTML('beforeend', this._roomFormHTML());
                    const newForm = container.lastElementChild;
                    this._attachRoomFormListeners(newForm);
                    refreshTotal();
                }
            });
        }
        // also update total when user removes a form (listener already handles removal)
        // _attachRoomFormListeners removes the element, so we wrap that to refresh total
        const origAttach = this._attachRoomFormListeners;
        this._attachRoomFormListeners = (formElem) => {
            origAttach.call(this, formElem);
            const removeBtn = formElem.querySelector('.remove-room-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    setTimeout(refreshTotal, 0);
                });
            }
        };
        // listen for any property additions elsewhere so list stays up to date
        document.addEventListener('propertyAdded', (evt) => {
            // if the event provides the full apartment, just prepend and re-render
            try {
                const apt = evt && evt.detail && evt.detail.apartment;
                if (apt && apt.id) {
                    console.log('propertyAdded event contains apartment, inserting into list');
                    // ensure no duplicate
                    if (!this.allProperties.find(p => p.id === apt.id)) {
                        this.allProperties.unshift(apt);
                    }
                    this.applyFilters();
                    return;
                }
            } catch (err) {
                console.warn('error handling propertyAdded detail:', err);
            }
            // fallback: reload from backend
            this.loadProperties().catch(err => console.warn('Unable to reload properties after add event:', err));
        });
        // also reload when a property is updated
        document.addEventListener('propertyUpdated', () => {
            this.loadProperties().catch(err => console.warn('Unable to reload properties after update event:', err));
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

            // details modal edit form listeners (edit/ save handled elsewhere)
            const detailsForm = propertyDetailsModal.querySelector('#propertyDetailsEditForm');
            if (detailsForm) {
                detailsForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveDetailsEdit();
                });
            }
            const cancelEditBtn = propertyDetailsModal.querySelector('#propertyDetailsCancelEdit');
            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => this.cancelDetailsEdit());
            }
            const addAmenityBtn = propertyDetailsModal.querySelector('#addDetailsAmenityBtn');
            if (addAmenityBtn) {
                addAmenityBtn.addEventListener('click', () => this.addCustomAmenity());
            }
            const retryBtn = propertyDetailsModal.querySelector('#propertyDetailsRetryBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    const pid = propertyDetailsModal.dataset.propertyId;
                    if (pid) this.openPropertyDetailsModal(pid);
                });
            }
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
            console.warn('casaLink or showAddPropertyForm unavailable, using fallback to inline modal');
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
        const roomSection = root.querySelector('#roomDetailsSection');
        const roomContainer = root.querySelector('#roomDetailsContainer');
        if (!modalEl) {
            console.warn('openAddPropertyModal: propertyModal element not found');
            return;
        }
        if (titleEl) titleEl.textContent = 'Add New Property';
        if (formEl) formEl.reset();
        if (roomSection) {
            roomSection.style.display = 'none';
        }
        if (roomContainer) {
            roomContainer.innerHTML = '';
        }
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

        // show room details section and populate with existing units
        const roomSection = root.querySelector('#roomDetailsSection');
        if (roomSection) {
            roomSection.style.display = 'block';
            // fetch units and populate
            this.populateRoomDetails(propertyId);
        }

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
    /**
     * Build HTML string for a single room/unit form entry.
     * Accepts optional unit object to prefill values.
     */
    _roomFormHTML(unit = {}) {
        return `
            <div class="room-form" data-unit-id="${unit.id || ''}" style="border:1px solid #ddd;padding:15px;margin-bottom:10px;position:relative;">
                <button type="button" class="btn btn-sm btn-danger remove-room-btn" style="position:absolute;top:5px;right:5px;">&times;</button>
                <div class="form-row" style="gap:10px;flex-wrap:wrap;display:flex;">
                    <div class="form-group" style="flex:1; min-width:150px;">
                        <label class="form-label">Room Number *</label>
                        <input type="text" class="room-number form-input" value="${unit.roomNumber || ''}" required />
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Floor *</label>
                        <input type="number" class="room-floor form-input" min="1" value="${unit.floor || ''}" required />
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Monthly Rent ₱</label>
                        <input type="number" class="room-rent form-input" min="0" value="${unit.monthlyRent || 0}" />
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Deposit ₱</label>
                        <input type="number" class="room-deposit form-input" min="0" value="${unit.securityDeposit || 0}" />
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach local listeners to a room form element (remove button etc).
     */
    _attachRoomFormListeners(formElem) {
        const removeBtn = formElem.querySelector('.remove-room-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const uid = formElem.getAttribute('data-unit-id');
                if (uid) {
                    // queue for deletion on save
                    this._roomsToDelete = this._roomsToDelete || [];
                    this._roomsToDelete.push(uid);
                }
                formElem.remove();
            });
        }
    }

    /**
     * Fetch units for property and populate the room details container.
     */
    async populateRoomDetails(propertyId) {
        try {
            // clear deletion buffer
            this._roomsToDelete = [];
            if (!propertyId) return;
            const container = document.querySelector('#roomDetailsContainer');
            if (!container) return;
            container.innerHTML = '<p>Loading units...</p>';
            let units = [];
            if (this.service && typeof this.service.getPropertyUnits === 'function') {
                units = await this.service.getPropertyUnits(propertyId);
            } else if (window.firebaseDb) {
                // some schemas refer to propertyId, others to apartmentId
                const query = window.firebaseDb.collection('units')
                    .where('propertyId', '==', propertyId);
                const snapshot1 = await query.get();
                if (snapshot1.empty) {
                    // try alternate field
                    const snapshot2 = await window.firebaseDb.collection('units')
                        .where('apartmentId', '==', propertyId)
                        .get();
                    units = snapshot2.docs.map(d => ({ id: d.id, ...d.data() }));
                } else {
                    units = snapshot1.docs.map(d => ({ id: d.id, ...d.data() }));
                }
            }
            container.innerHTML = '';
            units.forEach(u => {
                container.insertAdjacentHTML('beforeend', this._roomFormHTML(u));
            });
            // append listeners to existing forms
            container.querySelectorAll('.room-form').forEach(f => this._attachRoomFormListeners(f));

            // update totalUnits field
            const totalUnitsEl = document.querySelector('#totalUnits');
            if (totalUnitsEl) totalUnitsEl.value = units.length;
        } catch (err) {
            console.error('Error populating room details:', err);
        }
    }

    /**
     * Save room/detail forms after property update. Creates, updates or deletes units as needed.
     */
    async _saveRoomDetails() {
        const root = document;
        const container = root.querySelector('#roomDetailsContainer');
        if (!container) return;

        // delete removed units first
        if (Array.isArray(this._roomsToDelete) && this._roomsToDelete.length > 0) {
            for (const uid of this._roomsToDelete) {
                try {
                    await window.firebaseDb.collection('units').doc(uid).delete();
                    console.log('Deleted unit', uid);
                } catch (e) {
                    console.warn('Failed to delete unit', uid, e);
                }
            }
            this._roomsToDelete = [];
        }

        const forms = container.querySelectorAll('.room-form');
        for (const form of Array.from(forms)) {
            const unitId = form.getAttribute('data-unit-id');
            const data = {
                roomNumber: form.querySelector('.room-number')?.value || '',
                floor: form.querySelector('.room-floor')?.value || '',
                monthlyRent: parseFloat(form.querySelector('.room-rent')?.value) || 0,
                securityDeposit: parseFloat(form.querySelector('.room-deposit')?.value) || 0,
                propertyId: this.editingPropertyId,
                landlordId: this.currentUser.uid,
                updatedAt: new Date()
            };
            if (!data.roomNumber) continue; // skip invalid
            try {
                if (unitId) {
                    // update existing
                    await window.firebaseDb.collection('units').doc(unitId).update(data);
                    console.log('Updated unit', unitId);
                } else {
                    // create new
                    data.createdAt = new Date();
                    const ref = await window.firebaseDb.collection('units').add(data);
                    console.log('Created unit', ref.id);
                }
            } catch (e) {
                console.warn('Failed to save unit:', e);
            }
        }
    }

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
                    .collection(this._collection)
                    .doc(this.editingPropertyId)
                    .update(propertyData);

                console.log('✅ Property updated:', this.editingPropertyId);
                this.showToast('Property updated successfully', 'success');

                // also persist room/unit updates if present
                await this._saveRoomDetails();
            } else {
                // Create new
                propertyData.createdAt = new Date();
                const docRef = await window.firebaseDb.collection(this._collection).add(propertyData);
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
            // Find property data (we keep a local cache but reload from Firestore to ensure metrics are fresh)
            let property = this.allProperties.find(p => p.id === propertyId);
            if (!property) {
                this.showToast('Property not found', 'error');
                return;
            }
            try {
                const doc = await window.firebaseDb.collection('apartments').doc(propertyId).get();
                if (doc.exists) {
                    property = { id: doc.id, ...doc.data() };
                    // update cache as well
                    const idx = this.allProperties.findIndex(p => p.id === propertyId);
                    if (idx !== -1) this.allProperties[idx] = property;
                }
            } catch (reloadErr) {
                console.warn('Unable to reload property from Firestore:', reloadErr);
                // continue using cached copy
            }

            // Show modal with loading state
            const modal = document.getElementById('propertyDetailsModal');
            const content = document.getElementById('propertyDetailsContent');
            const loading = document.getElementById('propertyDetailsLoading');

            if (!modal) {
                console.error('Property details modal not found');
                return;
            }
            // reset any edit state
            this.detailsEditing = false;
            const editForm = modal.querySelector('#propertyDetailsEditForm');
            const viewArea = modal.querySelector('#propertyDetailsViewArea');
            const errorBox = document.getElementById('propertyDetailsError');
            if (editForm) editForm.style.display = 'none';
            if (viewArea) viewArea.style.display = 'block';
            if (errorBox) errorBox.style.display = 'none';
            const editBtn = modal.querySelector('.property-details-footer .btn-primary');
            if (editBtn) {
                editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Property';
            }
            // remember current property id for later edits
            modal.dataset.propertyId = propertyId;

            // clear tab contents for fresh load
            const unitsList = document.getElementById('unitsList');
            if (unitsList) unitsList.innerHTML = '';
            const maintenanceList = document.getElementById('maintenanceList');
            if (maintenanceList) maintenanceList.innerHTML = '';

            // Reset to loading state
            content.style.display = 'none';
            loading.style.display = 'flex';
            modal.style.display = 'flex';

            // log the raw document for debugging mismatches
            console.log('📝 property document', property);

            // Populate header information using the apartment schema
            document.getElementById('propertyDetailsName').textContent = this.escapeHtml(property.apartmentName || property.name || '');
            const addressStr = property.apartmentAddress || '';
            document.getElementById('propertyDetailsAddress').textContent = addressStr;

            // Populate basic info grid
            const typeEl = document.getElementById('detailsPropertyType');
            const typeGroup = document.getElementById('groupPropertyType');
            if (typeEl && property.propertyType) {
                typeEl.textContent = this.formatPropertyType(property.propertyType);
            } else if (typeGroup) {
                typeGroup.style.display = 'none';
            }

            const statusBadge = document.getElementById('detailsPropertyStatus');
            if (statusBadge) {
                const isActive = property.isActive === true || property.status === 'active';
                statusBadge.textContent = isActive ? 'Active' : 'Inactive';
                statusBadge.className = isActive ? 'status-badge status-active' : 'status-badge status-inactive';
            }

            const storiesEl = document.getElementById('detailsPropertyStories');
            const storiesGroup = document.getElementById('groupPropertyStories');
            if (storiesEl && property.numberOfFloors != null) {
                storiesEl.textContent = property.numberOfFloors;
            } else if (storiesGroup) {
                storiesGroup.style.display = 'none';
            }

            // created/updated timestamps
            const createdEl = document.getElementById('detailsPropertyCreated');
            const updatedEl = document.getElementById('detailsPropertyUpdated');
            if (createdEl) {
                createdEl.textContent = property.createdAt ? this.formatDate(property.createdAt) : '-';
            }
            if (updatedEl) {
                updatedEl.textContent = property.updatedAt ? this.formatDate(property.updatedAt) : '-';
            }

            // hide unused rows (year built, sqft, lot, parking) since no fields exist
            ['detailsPropertyYearBuilt','detailsPropertySqft','detailsPropertyLot','detailsPropertyParking'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.closest('.info-group').style.display = 'none';
            });

            // Calculate and populate metrics
            const units = await this.fetchPropertyUnits(propertyId, property);
            const occupiedUnits = (units || []).filter(u => u.isOccupied).length;
            const occupancyRate = units && units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0;

            // Total units should reflect numberOfRooms (or totalUnits) if available, otherwise fall back to fetched units
            const unitsCount = property.numberOfRooms != null ? property.numberOfRooms : (property.totalUnits != null ? property.totalUnits : ((units || []).length));
            document.getElementById('detailsMetricUnits').textContent = unitsCount;
            // occupancy uses property.numberOfRooms as denominator when present
            let occupancyRateFinal = 0;
            if (property.numberOfRooms) {
                occupancyRateFinal = Math.round((occupiedUnits / property.numberOfRooms) * 100);
            } else if (property.totalUnits) {
                occupancyRateFinal = Math.round((occupiedUnits / property.totalUnits) * 100);
            } else {
                occupancyRateFinal = occupancyRate;
            }
            document.getElementById('detailsMetricOccupancy').textContent = `${occupancyRateFinal}%`;
            // calculate rent roll: use stored monthlyRevenue or sum from units
            let rentRoll = property.monthlyRevenue || 0;
            if (!rentRoll && units && units.length > 0) {
                rentRoll = units.reduce((sum,u) => sum + (u.rent || u.monthlyRent || 0), 0);
            }
            document.getElementById('detailsMetricRevenue').textContent = `₱${rentRoll.toLocaleString()}`;

            // Get maintenance count
            const maintenanceRequests = await this.fetchPropertyMaintenance(propertyId, property);
            const openMaintenance = (maintenanceRequests || []).filter(m => m.status !== 'completed').length;
            document.getElementById('detailsMetricMaintenance').textContent = openMaintenance;

            // Populate overview tab
            document.getElementById('detailsFullAddress').textContent = addressStr;
            const descEl = document.getElementById('detailsDescription');
            if (property.description) {
                descEl.textContent = property.description;
                descEl.style.fontStyle = 'normal';
                descEl.style.color = '#1f2937';
            } else if (descEl) {
                descEl.textContent = 'No description provided';
                descEl.style.fontStyle = 'italic';
                descEl.style.color = '#6b7280';
            }

            // Populate amenities
            const amenitiesEl = document.getElementById('detailsAmenities');
            if (property.amenities && property.amenities.length > 0) {
                amenitiesEl.innerHTML = property.amenities.map(a =>
                    `<span><i class="fas fa-check-circle"></i> ${this.formatPropertyType(a)}</span>`
                ).join('');
            }

            // Populate documents
            const docsEl = document.getElementById('detailsDocuments');
            if (docsEl) {
                if (property.documents && property.documents.length > 0) {
                    docsEl.innerHTML = property.documents.map(d =>
                        `<a href="${d.url}" target="_blank" class="doc-link"><i class="fas fa-file-alt"></i> ${d.name || 'Document'}</a>`
                    ).join('');
                } else {
                    docsEl.innerHTML = '<span style="color: #9ca3af;">No documents</span>';
                }
            }

            // Populate units tab on tab switch

            // Populate maintenance tab on tab switch

            // Populate tenants tab
            const tenants = await this.fetchPropertyTenants(propertyId, property);
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
            // display error message inside modal with retry option
            const modal = document.getElementById('propertyDetailsModal');
            const loadingEl = document.getElementById('propertyDetailsLoading');
            const contentEl = document.getElementById('propertyDetailsContent');
            const errorBox = document.getElementById('propertyDetailsError');
            const errorMsg = document.getElementById('propertyDetailsErrorMsg');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            if (errorBox) errorBox.style.display = 'block';
            if (errorMsg) errorMsg.textContent = 'Failed to load property details. Please try again.';
            // hide view area so stale info doesn't show
            const viewArea = document.getElementById('propertyDetailsViewArea');
            if (viewArea) viewArea.style.display = 'none';
            this.showToast('Error loading property details: ' + error.message, 'error');
            // keep modal open so user can retry
        }
    }

    /**
     * Fetch property units from Firestore
     */
    async fetchPropertyUnits(propertyId, propertyObj = {}) {
        try {
            console.log('🏠 Fetching units for property details modal:', propertyId);
            await this.waitForFirebase();
            // query rooms collection by landlordId, then filter by apartmentAddress
            const roomsSnap = await window.firebaseDb.collection('rooms').where('landlordId', '==', this.currentUser.uid).get();
            let units = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(u => u.apartmentAddress === propertyObj.apartmentAddress);
            // convert to unit format
            units = units.map(u => ({
                ...u,
                unitNumber: u.roomNumber || u.unitNumber || u.id,
                isOccupied: u.isAvailable === false || u.status === 'occupied',
                rent: u.monthlyRent || u.rent || 0
            }));
            return units;
        } catch (error) {
            console.error('Error fetching property units:', error);
            return [];
        }
    }

    /**
     * Fetch property maintenance requests
     */
    async fetchPropertyMaintenance(propertyId, propertyObj = {}) {
        try {
            console.log('🔧 Fetching maintenance for property details modal:', propertyId);
            await this.waitForFirebase();
            let requests = [];

            // use DataManager if available (it handles landlordId filter)
            if (window.DataManager && typeof DataManager.getMaintenanceRequests === 'function') {
                requests = await DataManager.getMaintenanceRequests(this.currentUser.uid);
            } else {
                const snapshot = await window.firebaseDb
                    .collection('maintenance')
                    .where('landlordId', '==', this.currentUser.uid)
                    .get();
                requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            // Determine which units belong to this property (room numbers + unit IDs)
            const units = await this.fetchPropertyUnits(propertyId, propertyObj);
            const unitIds = units.map(u => u.id);
            const roomNumbers = units.map(u => u.roomNumber || u.unitNumber).filter(Boolean);

            // Filter maintenance requests for this property:
            // 1) Owned by this property ID (apartmentId/propertyId)
            // 2) Or matches this property's name/address AND a room number from this property
            // 3) Or matches by unit/room ID
            requests = requests.filter(r => {
                const matchesByPropertyId = r.apartmentId === propertyId || r.propertyId === propertyId;
                const matchesByNameAndRoom = (r.propertyName === propertyObj.apartmentName || r.propertyName === propertyObj.apartmentAddress) && roomNumbers.includes(r.roomNumber);
                const matchesByUnitId = unitIds.includes(r.unitId) || unitIds.includes(r.roomId);
                return matchesByPropertyId || matchesByNameAndRoom || matchesByUnitId;
            });

            // sort descending by createdAt and take first 5
            requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return requests.slice(0, 5);
        } catch (error) {
            console.error('Error fetching maintenance:', error);
            return [];
        }
    }

    /**
     * Fetch property tenants
     */
    async fetchPropertyTenants(propertyId, propertyObj = {}) {
        try {
            await this.waitForFirebase();
            let leases = [];

            if (window.DataManager && typeof DataManager.getLandlordLeases === 'function') {
                leases = await DataManager.getLandlordLeases(this.currentUser.uid);
            } else {
                const snap = await window.firebaseDb
                    .collection('leases')
                    .where('landlordId', '==', this.currentUser.uid)
                    .get();
                leases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // filter leases associated with this property/apartment
            leases = leases.filter(l =>
                l.propertyId === propertyId ||
                l.apartmentId === propertyId ||
                l.rentalPropertyId === propertyId ||
                l.apartmentAddress === propertyObj.apartmentAddress
            );

            const tenantIds = [...new Set(leases.map(l => l.tenantId).filter(Boolean))];
            const tenants = [];
            for (const tenantId of tenantIds) {
                try {
                    const tenantDoc = await window.firebaseDb.collection('users').doc(tenantId).get();
                    if (tenantDoc.exists) {
                        tenants.push({ id: tenantId, ...tenantDoc.data() });
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
                .collection(this._collection)
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

        const occupied = units.filter(u => u.isOccupied).length;
        const vacant = units.length - occupied;

        // build summary section and first three units
        const shortUnits = units.slice(0, 3);
        unitsList.innerHTML = `
            <div class="unit-summary">
                <div>Total units: ${units.length}</div>
                <div>Occupied: ${occupied}</div>
                <div>Vacant: ${vacant}</div>
                <div><a href="#" onclick="if(window.propertiesController) window.propertiesController.navigateToUnits('${units[0]?.propertyId}');return false;">View All Units</a></div>
                <button class="btn btn-sm btn-primary" onclick="if(window.propertiesController) window.propertiesController.addUnit('${units[0]?.propertyId}');">Add Unit</button>
            </div>
            <div class="unit-list-short">
                ${shortUnits.map(unit => `
                    <div class="unit-item">
                        <div class="unit-header">
                            <div class="unit-name">${this.escapeHtml(unit.unitNumber || 'Unit ' + unit.id.substring(0, 5))}</div>
                            <div class="unit-status">${unit.isOccupied ? 'Occupied' : 'Vacant'}</div>
                        </div>
                        <span class="status-badge ${unit.isOccupied ? 'status-active' : 'status-inactive'}">
                            ${unit.isOccupied ? 'Occupied' : 'Vacant'}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
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
                if (tabName === 'units') {
                    console.log('📋 Units tab clicked for property:', this.currentPropertyId);
                    (async () => {
                        const units = await this.fetchPropertyUnits(this.currentPropertyId, this.currentProperty);
                        await this.populateUnitsTab(units);
                    })();
                }
                if (tabName === 'maintenance') {
                    console.log('🔧 Maintenance tab clicked for property:', this.currentPropertyId);
                    (async () => {
                        const maintenance = await this.fetchPropertyMaintenance(this.currentPropertyId, this.currentProperty);
                        await this.populateMaintenanceTab(maintenance);
                    })();
                }
            });
        });
    }

    /**
     * Close property details modal
     */
    closePropertyDetailsModal() {
        // warn if editing and unsaved
        if (this.detailsEditing) {
            const ok = confirm('You have unsaved changes. Discard and close?');
            if (!ok) return;
        }
        const modal = document.getElementById('propertyDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            // reset modal state for fresh open
            modal.dataset.propertyId = '';
            this.detailsEditing = false;
            // reset tabs to overview
            const tabButtons = modal.querySelectorAll('.property-tabs .tab-button');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            const overviewBtn = modal.querySelector('.property-tabs .tab-button[data-tab="overview"]');
            if (overviewBtn) overviewBtn.classList.add('active');
            const tabPanes = modal.querySelectorAll('.property-tab-content .tab-pane');
            tabPanes.forEach(pane => pane.style.display = 'none');
            const overviewPane = modal.querySelector('.property-tab-content #tab-overview');
            if (overviewPane) overviewPane.style.display = 'block';
            // reset content areas
            const contentEl = document.getElementById('propertyDetailsContent');
            if (contentEl) contentEl.style.display = 'none';
            const loadingEl = document.getElementById('propertyDetailsLoading');
            if (loadingEl) loadingEl.style.display = 'block';
            const errorEl = document.getElementById('propertyDetailsError');
            if (errorEl) {
                errorEl.style.display = 'none';
                const msgEl = errorEl.querySelector('#propertyDetailsErrorMsg');
                if (msgEl) msgEl.textContent = '';
            }
        }
    }

    /**
     * Entry point for footer button in details modal.
     * Toggles between view and edit mode; will call save when already editing.
     */
    editPropertyFromDetails() {
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) return;
        const propId = modal.dataset.propertyId;
        if (!propId) return;
        const property = this.allProperties.find(p => p.id === propId);
        if (!property) return;

        if (!this.detailsEditing) {
            this.startDetailsEdit(property);
        } else {
            // save is triggered by form submit but allow toolbar button too
            this.saveDetailsEdit();
        }
    }

    /**
     * Prepare and show the edit form inside the details modal.
     */
    startDetailsEdit(property) {
        this.detailsEditing = true;
        this.detailsOriginal = JSON.parse(JSON.stringify(property)); // deep copy

        const modal = document.getElementById('propertyDetailsModal');
        const viewArea = modal.querySelector('#propertyDetailsViewArea');
        const editForm = modal.querySelector('#propertyDetailsEditForm');
        const editBtn = modal.querySelector('.property-details-footer .btn-primary');

        // hide view and show form
        if (viewArea) viewArea.style.display = 'none';
        if (editForm) editForm.style.display = 'block';

        // update footer buttons
        if (editBtn) {
            editBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
        const closeBtn = modal.querySelector('.property-details-footer .btn-secondary');
        if (closeBtn) {
            closeBtn.innerHTML = 'Cancel';
            closeBtn.onclick = () => this.cancelDetailsEdit();
        }

        // populate form fields
        this.populateDetailsEditForm(property);
    }

    /**
     * Fill the fields of the details edit form with property data.
     */
    populateDetailsEditForm(property) {
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) return;
        const set = (selector, value) => {
            const el = modal.querySelector(selector);
            if (el) {
                if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = value != null ? value : '';
                }
            }
        };

        set('#detailsEditName', property.name);
        set('#detailsEditType', property.propertyType);
        set('#detailsEditStatus', property.status || 'active');
        set('#detailsEditYearBuilt', property.yearBuilt || '');
        set('#detailsEditSqft', property.squareFootage || '');
        set('#detailsEditStories', property.numberOfStories || '');
        set('#detailsEditLotSize', property.lotSize || '');
        set('#detailsEditParkingSpaces', property.parkingSpaces || '');
        set('#detailsEditParkingType', property.parkingType || '');
        set('#detailsEditDescription', property.description || '');

        // amenities checkboxes
        const amenitiesContainer = modal.querySelector('#detailsAmenitiesEdit');
        if (amenitiesContainer) {
            const allAmenities = ['Pool','Gym','Laundry','Elevator','Security','Pet Friendly','Furnished','Balcony/Patio','Storage','Wheelchair Access'];
            amenitiesContainer.innerHTML = '';
            allAmenities.forEach(a => {
                const val = a.toLowerCase().replace(/[^a-z0-9]/g,'');
                const checked = (property.amenities || []).includes(val);
                const div = document.createElement('label');
                div.className = 'checkbox-label';
                div.innerHTML = `<input type="checkbox" name="detailsAmenities" value="${val}" ${checked ? 'checked' : ''}> ${a}`;
                amenitiesContainer.appendChild(div);
            });
            // include any custom amenities
            (property.amenities || []).forEach(a => {
                if (!allAmenities.map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,'')).includes(a)) {
                    const div = document.createElement('label');
                    div.className = 'checkbox-label';
                    div.innerHTML = `<input type="checkbox" name="detailsAmenities" value="${a}" checked> ${a}`;
                    amenitiesContainer.appendChild(div);
                }
            });
        }

        // documents list
        const docsList = modal.querySelector('#detailsDocsList');
        if (docsList) {
            docsList.innerHTML = '';
            (property.documents || []).forEach(doc => {
                const link = document.createElement('a');
                link.href = doc.url || '#';
                link.target = '_blank';
                link.textContent = doc.name || 'Document';
                docsList.appendChild(link);
            });
        }
    }

    /**
     * Cancel editing and revert to view mode.
     */
    cancelDetailsEdit() {
        // if there are unsaved changes, confirm before discarding
        if (this.detailsEditing) {
            const answer = confirm('Discard unsaved changes?');
            if (!answer) return;
        }
        this.detailsEditing = false;
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) return;
        const viewArea = modal.querySelector('#propertyDetailsViewArea');
        const editForm = modal.querySelector('#propertyDetailsEditForm');
        const editBtn = modal.querySelector('.property-details-footer .btn-primary');

        if (editForm) editForm.style.display = 'none';
        if (viewArea) viewArea.style.display = 'block';
        if (editBtn) {
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Property';
        }
        // restore footer close button behaviour
        const closeBtn = modal.querySelector('.property-details-footer .btn-secondary');
        if (closeBtn) {
            closeBtn.innerHTML = 'Close';
            closeBtn.onclick = () => this.closePropertyDetailsModal();
        }
        // reset form if necessary
        if (editForm) editForm.reset();
    }

    /**
     * Handle submission of edit form inside details modal.
     */
    async saveDetailsEdit() {
        if (!this.detailsEditing) return;
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) return;
        const propId = modal.dataset.propertyId;
        if (!propId) return;

        // collect values
        const getVal = selector => {
            const el = modal.querySelector(selector);
            return el ? el.value : '';
        };
        const updated = {
            name: getVal('#detailsEditName'),
            propertyType: getVal('#detailsEditType'),
            status: getVal('#detailsEditStatus'),
            yearBuilt: getVal('#detailsEditYearBuilt') || null,
            squareFootage: parseFloat(getVal('#detailsEditSqft')) || 0,
            numberOfStories: parseInt(getVal('#detailsEditStories')) || 0,
            lotSize: getVal('#detailsEditLotSize'),
            parkingSpaces: parseInt(getVal('#detailsEditParkingSpaces')) || 0,
            parkingType: getVal('#detailsEditParkingType'),
            description: getVal('#detailsEditDescription'),
            amenities: Array.from(modal.querySelectorAll('input[name="detailsAmenities"]:checked')).map(cb => cb.value),
            updatedAt: new Date()
        };

        // validation
        if (!updated.name || !updated.propertyType) {
            this.showToast('Name and type are required', 'error');
            return;
        }
        if (updated.squareFootage < 0) {
            this.showToast('Square footage must be positive', 'error');
            return;
        }
        const year = parseInt(updated.yearBuilt);
        if (year && (year < 1800 || year > new Date().getFullYear()+1)) {
            this.showToast('Year built must be valid', 'error');
            return;
        }

        // handle document uploads
        const fileInput = modal.querySelector('#detailsDocsUpload');
        if (fileInput && fileInput.files.length > 0) {
            const newDocs = await this.uploadPropertyDocuments(fileInput.files, propId);
            updated.documents = (this.detailsOriginal.documents || []).concat(newDocs);
        }

        // show saving state
        const saveBtn = modal.querySelector('#propertyDetailsSaveBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;
        }

        try {
            await this.waitForFirebase();
            await window.firebaseDb.collection(this._collection).doc(propId).update(updated);
            this.showToast('Property updated', 'success');
            // update local copy
            const idx = this.allProperties.findIndex(p => p.id === propId);
            if (idx !== -1) {
                this.allProperties[idx] = { ...this.allProperties[idx], ...updated };
            }
            // refresh both list and details view
            await this.loadProperties();
            document.dispatchEvent(new CustomEvent('propertyUpdated', { detail: { id: propId } }));
            this.openPropertyDetailsModal(propId);
            this.detailsEditing = false;
        } catch (err) {
            console.error('Error saving details edit:', err);
            this.showToast('Unable to save changes: ' + err.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Property';
                saveBtn.disabled = false;
            }
        }
    }

    /**
     * Add a custom amenity checkbox when editing.
     */
    addCustomAmenity() {
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) return;
        const input = modal.querySelector('#detailsCustomAmenity');
        if (!input || !input.value.trim()) return;
        const val = input.value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `<input type="checkbox" name="detailsAmenities" value="${val}" checked> ${input.value.trim()}`;
        const container = modal.querySelector('#detailsAmenitiesEdit');
        if (container) container.appendChild(label);
        input.value = '';
    }

    /**
     * Upload document files to Firebase Storage and return array of doc meta.
     */
    async uploadPropertyDocuments(files, propertyId) {
        const docs = [];
        const storage = firebase.storage();
        const timestamp = new Date().getTime();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const path = `property-docs/${propertyId}/${timestamp}-${file.name}`;
                const ref = storage.ref(path);
                await ref.put(file);
                const url = await ref.getDownloadURL();
                docs.push({ name: file.name, url });
            } catch (err) {
                console.error('Error uploading document', err);
            }
        }
        return docs;
    }

    /**
     * Navigate to the units management view for a specific property.
     */
    navigateToUnits(propertyId) {
        // simple implementation: change hash so other routing logic can respond
        if (propertyId) {
            window.location.hash = `#units?propertyId=${propertyId}`;
        }
    }

    /**
     * Open interface to add a new unit under the property.
     * Placeholder - implement real logic as needed.
     */
    addUnit(propertyId) {
        console.log('addUnit called for property', propertyId);
        // could trigger a modal or redirect to unit creation page
        this.showToast('Add Unit feature coming soon', 'info');
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
            batch.delete(window.firebaseDb.collection(this._collection).doc(this.deleteConfirmPropertyId));

            // Delete associated units (field may be propertyId or apartmentId)
            const unitsCollection = window.firebaseDb.collection('units');
            let unitsSnapshot = await unitsCollection
                .where('propertyId', '==', this.deleteConfirmPropertyId)
                .get();
            if (unitsSnapshot.empty) {
                unitsSnapshot = await unitsCollection
                    .where('apartmentId', '==', this.deleteConfirmPropertyId)
                    .get();
            }
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

// Export block removed: assignment is done when the class is defined above.
// (keeping this section caused a second assignment but was harmless; removal
// avoids confusion and redundant code.)

// If the generic controller was instantiated earlier we want to override it.
// Run when dataService is already available (it should be after bootstrap).
if (window.dataService) {
    try {
        window.propertiesController = new PropertiesController(window.dataService);
        console.log('✅ Landlord PropertiesController instantiated and bound globally');
    } catch (e) {
        console.warn('⚠️ Could not instantiate landlord PropertiesController automatically:', e);
    }
}