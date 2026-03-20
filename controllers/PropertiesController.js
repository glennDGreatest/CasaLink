/**
 * PropertiesController
 * Handles all property management interactions
 * Orchestrates between Properties views and DataService
 */

class PropertiesController {
    constructor(dataService) {
        this.service = dataService;
        this.currentUser = window.currentUser || null;
        this.currentFilter = '';
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.allProperties = [];

        console.log('PropertiesController instance constructed; editProperty=', typeof this.editProperty);

        // expose controller globally for legacy onclick handlers
        window.propertiesController = this;
        // bind methods which will be called from views/inline listeners
        this.editProperty = this.editProperty.bind(this);
        this.openEditPropertyModal = this.openEditPropertyModal.bind(this);

        this.setupEventListeners();
    }

    /**
     * Initialize controller
     */
    async init() {
        try {
            window.setPropertiesLoading(true);

            // Update current user reference
            if (window.currentUser) {
                this.currentUser = window.currentUser;
            }

            await this.loadProperties();
            window.hidePropertiesError();
        } catch (error) {
            console.error('Error initializing properties:', error);
            window.showPropertiesError('Failed to load properties: ' + error.message);
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Load all properties from service for current landlord
     */
    async loadProperties() {
        try {
            if (!this.currentUser || !this.currentUser.uid) {
                throw new Error('User not authenticated');
            }

            // Only load properties for landlords
            if (this.currentUser.role !== 'landlord') {
                this.allProperties = [];
                this.displayFilteredProperties();
                return;
            }

            this.allProperties = await this.service.getLandlordProperties(this.currentUser.uid);
            this.displayFilteredProperties();
        } catch (error) {
            throw new Error(`Failed to load properties: ${error.message}`);
        }
    }

    /**
     * Setup event listeners for property actions
     */
    setupEventListeners() {
        // Search functionality (debounced in view)
        // Filter functionality (delegated to view)
        // All other event listeners bound in views
    }

    /**
     * Format a date string, Date object, or Firestore timestamp for display.
     */
    formatDate(date) {
        if (!date) return '-';
        if (typeof date.toDate === 'function') {
            date = date.toDate();
        }
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Search properties by name or address
     */
    searchProperties(query) {
        this.currentFilter = query.toLowerCase();
        this.currentPage = 1;
        this.displayFilteredProperties();
    }

    /**
     * Display filtered properties
     */
    displayFilteredProperties() {
        let filtered = this.allProperties;

        if (this.currentFilter) {
            filtered = filtered.filter(prop =>
                prop.name.toLowerCase().includes(this.currentFilter) ||
                prop.address.toLowerCase().includes(this.currentFilter)
            );
        }

        // Paginate
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = filtered.slice(start, end);

        // Display in view
        window.displayProperties(paginated);

        // Update pagination
        const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
        window.updatePagination(this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.displayFilteredProperties();
        });
    }

    /**
     * View property details
     */
    viewProperty(propertyId) {
        console.log('viewProperty called with id', propertyId);
        // prefer showing a modal if the functionality exists
        if (typeof this.showPropertyDetailsModal === 'function') {
            this.showPropertyDetailsModal(propertyId);
            return;
        }

        // fallback: navigate to the detail page (legacy behaviour)
        const property = this.allProperties.find(p => p.id === propertyId);
        if (property) {
            console.log('No modal available, navigating to property detail:', propertyId);
            window.location.hash = `#property/${propertyId}`;
        }
    }

    /**
     * Entry point used by dashboard cards and other inline handlers.  Accepts
     * either a property ID string or an object and makes sure the full record
     * is loaded before showing the edit modal.
     *
     * @param {string|Object} propertyOrId
     */
    editProperty(propertyOrId) {
        console.log('editProperty() invoked with', propertyOrId);
        if (!propertyOrId) return;

        // if caller provided a full object we still prefer to refresh from
        // the database to ensure we have the latest fields (rooms/floors, etc.).
        const handleObject = async (obj) => {
            if (!obj || !obj.id) return;
            if (this.service && typeof this.service.getProperty === 'function') {
                try {
                    window.setPropertiesLoading(true);
                    const fresh = await this.service.getProperty(obj.id);
                    window.setPropertiesLoading(false);
                    if (fresh) {
                        return this.openEditPropertyModal(fresh);
                    }
                } catch (err) {
                    window.setPropertiesLoading(false);
                    console.warn('Failed to refresh property object before edit:', err);
                }
            }
            // fall back to whatever we already have
            return this.openEditPropertyModal(obj);
        };

        if (typeof propertyOrId === 'object' && propertyOrId.id) {
            return handleObject(propertyOrId);
        }

        // When given an ID string always fetch the latest copy rather than rely
        // on whatever might be sitting in allProperties; this guarantees the
        // Step 1 form receives accurate room/floor counts.
        if (typeof propertyOrId === 'string') {
            if (this.service && typeof this.service.getProperty === 'function') {
                window.setPropertiesLoading(true);
                return this.service.getProperty(propertyOrId)
                    .then(p => {
                        window.setPropertiesLoading(false);
                        if (p) {
                            return this.openEditPropertyModal(p);
                        } else {
                            throw new Error('Property not found');
                        }
                    })
                    .catch(err => {
                        window.setPropertiesLoading(false);
                        console.error('Error loading property for edit:', err);
                        if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                            window.notificationManager.error('Error loading property');
                        }
                    });
            } else {
                console.warn('Cannot load property – service unavailable');
            }
        }
    }

    /**
     * Called by dashboard/detail views when the "Edit" button inside the
     * property details modal is clicked.  Simply grabs the current property id
     * and hands it off to {@link editProperty}.
     */
    editPropertyFromDetails() {
        const modal = document.getElementById('propertyDetailsModal');
        const pid = modal && modal.dataset.propertyId;
        if (pid) {
            this.editProperty(pid);
        } else {
            console.warn('editPropertyFromDetails called but no propertyId present');
        }
    }

    /**
     * Injected helper methods for editing room/unit details.  These mirror the
     * landlord-specific controller so that the generic modal also supports
     * room forms when editing a property.
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
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Bedrooms *</label>
                        <input type="number" class="room-bedrooms form-input" min="0" value="${unit.numberOfBedrooms || 0}" required />
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Bathrooms *</label>
                        <input type="number" class="room-bathrooms form-input" min="0" step="0.5" value="${unit.numberOfBathrooms || 0}" required />
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Max Members *</label>
                        <input type="number" class="room-maxmembers form-input" min="1" value="${unit.maxMembers || 1}" required />
                    </div>
                </div>
            </div>
        `;
    }

    _attachRoomFormListeners(formElem) {
        const removeBtn = formElem.querySelector('.remove-room-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const uid = formElem.getAttribute('data-unit-id');
                if (uid) {
                    this._roomsToDelete = this._roomsToDelete || [];
                    this._roomsToDelete.push(uid);
                }
                formElem.remove();
            });
        }
    }

    async populateRoomDetails(propertyId, containerEl, refreshCallback) {
        try {
            this._roomsToDelete = [];
            if (!propertyId) return;
            const container = containerEl || document.querySelector('#editRoomContainer');
            if (!container) return;
            container.innerHTML = '<p>Loading units...</p>';
            let units = [];
            if (this.service && typeof this.service.getPropertyUnits === 'function') {
                units = await this.service.getPropertyUnits(propertyId);
            } else if (window.firebaseDb) {
                const snapshot = await window.firebaseDb
                    .collection('units')
                    .where('propertyId', '==', propertyId)
                    .get();
                units = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            container.innerHTML = '';
            units.forEach(u => {
                container.insertAdjacentHTML('beforeend', this._roomFormHTML(u));
            });
            container.querySelectorAll('.room-form').forEach(f => this._attachRoomFormListeners(f));
            if (typeof refreshCallback === 'function') refreshCallback();
        } catch (err) {
            console.error('Error populating room details:', err);
        }
    }

    async _saveRoomDetails() {
        const root = document;
        const container = root.querySelector('#editRoomContainer');
        if (!container) return;
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
                numberOfBedrooms: parseInt(form.querySelector('.room-bedrooms')?.value, 10) || 0,
                numberOfBathrooms: parseFloat(form.querySelector('.room-bathrooms')?.value) || 0,
                maxMembers: parseInt(form.querySelector('.room-maxmembers')?.value, 10) || 1,
                propertyId: this._currentEditingId,
                updatedAt: new Date()
            };
            if (!data.roomNumber) continue;
            try {
                if (unitId) {
                    await window.firebaseDb.collection('units').doc(unitId).update(data);
                    console.log('Updated unit', unitId);
                } else {
                    data.createdAt = new Date();
                    const ref = await window.firebaseDb.collection('units').add(data);
                    console.log('Created unit', ref.id);
                }
            } catch (e) {
                console.warn('Failed to save unit:', e);
            }
        }
    }

    /**
     * Display a modal containing detailed information for a property.
     * If the landlord-specific controller is in use it may override this with
     * a richer implementation, but the generic logic will still work.
     *
     * @param {string} propertyId
     */
    async showPropertyDetailsModal(propertyId) {
        console.log('Fetching property data for modal:', propertyId);
        try {
            window.setPropertiesLoading(true);

            // try to find cached copy first
            let property = this.allProperties.find(p => p.id === propertyId);
            if (!property) {
                property = await this.service.getProperty(propertyId);
            }

            if (!property) {
                throw new Error('Property not found');
            }

            console.log('Property data received, rendering modal');

            // ensure click-outside / escape-close listeners registered once
            if (!this._propertyModalEventsSetup) {
                const tempModal = document.getElementById('propertyDetailsModal');
                if (tempModal) {
                    tempModal.addEventListener('click', (e) => {
                        if (e.target === tempModal) {
                            this.closePropertyDetailsModal();
                        }
                    });
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && tempModal.style.display === 'flex') {
                            this.closePropertyDetailsModal();
                        }
                    });
                }
                this._propertyModalEventsSetup = true;
            }

            // locate modal elements defined in index.html
            const modal = document.getElementById('propertyDetailsModal');
            const content = document.getElementById('propertyDetailsContent');
            const loading = document.getElementById('propertyDetailsLoading');

            if (!modal) {
                console.error('Property details modal not found in DOM');
                return;
            }
            // store id so other helpers can access it (edit, etc.)
            modal.dataset.propertyId = propertyId;

            // Reset tab UI so every open starts on Overview (fresh state)
            console.log('Resetting property details modal tabs to Overview');
            const tabButtons = modal.querySelectorAll('.property-tabs .tab-button');
            const tabPanes = modal.querySelectorAll('.property-tab-content .tab-pane');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.style.display = 'none');
            const overviewBtn = modal.querySelector('.property-tabs .tab-button[data-tab="overview"]');
            if (overviewBtn) overviewBtn.classList.add('active');
            const overviewPane = modal.querySelector('#tab-overview');
            if (overviewPane) overviewPane.style.display = 'block';

            // reset tab content placeholders
            const unitsList = document.getElementById('unitsList');
            if (unitsList) unitsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading units...</p>';
            const maintenanceList = document.getElementById('maintenanceList');
            if (maintenanceList) maintenanceList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading maintenance requests...</p>';
            const tenantsList = document.getElementById('tenantsList');
            if (tenantsList) tenantsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading tenants...</p>';
            const activityList = document.getElementById('activityList');
            if (activityList) activityList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading activity...</p>';

            // reset/loading state
            content && (content.style.display = 'none');
            loading && (loading.style.display = 'flex');
            modal.style.display = 'flex';

            // header info - ensure elements exist (modal may be absent on some pages)
            const nameEl = document.getElementById('propertyDetailsName');
            const addressEl = document.getElementById('propertyDetailsAddress');
            if (!nameEl || !addressEl) {
                console.warn('Property details modal elements missing; aborting display');
                window.showPropertiesError && window.showPropertiesError('Property details modal not available on this page');
                // hide loading spinner if present
                loading && (loading.style.display = 'none');
                content && (content.style.display = 'block');
                return;
            }
            nameEl.textContent = 'Property Details';
            addressEl.textContent = '';

            // Populate property info grid (name/address/rooms/landlord)
            const displayName = property.apartmentName || property.name || property.propertyName || property.title || '';
            const displayAddress = property.apartmentAddress || property.address || property.propertyAddress || property.location || '';
            const roomsCount = property.numberOfRooms != null ? property.numberOfRooms : (property.totalUnits != null ? property.totalUnits : (property.numberOfUnits != null ? property.numberOfUnits : null));
            const landlordName = property.landlordName || property.ownerName || property.owner || property.landlordEmail || '';
            const createdAtValue = property.createdAt || property.created_at || property.createdOn || property.created || null;
            const updatedAtValue = property.updatedAt || property.updated_at || property.updatedOn || property.updated || null;

            const infoNameEl = document.getElementById('detailsPropertyName');
            const infoNameGroup = document.getElementById('groupPropertyName');
            if (infoNameEl && displayName) {
                infoNameEl.textContent = displayName;
            } else if (infoNameGroup) {
                infoNameGroup.style.display = 'none';
            }

            const infoAddressEl = document.getElementById('detailsPropertyAddress');
            const infoAddressGroup = document.getElementById('groupPropertyAddress');
            if (infoAddressEl && displayAddress) {
                infoAddressEl.textContent = displayAddress;
            } else if (infoAddressGroup) {
                infoAddressGroup.style.display = 'none';
            }

            // created/updated timestamps
            const createdEl = document.getElementById('detailsPropertyCreated');
            const updatedEl = document.getElementById('detailsPropertyUpdated');
            if (createdEl) {
                createdEl.textContent = createdAtValue ? this.formatDate(createdAtValue) : '-';
            }
            if (updatedEl) {
                updatedEl.textContent = updatedAtValue ? this.formatDate(updatedAtValue) : '-';
            }

            // Populate stories metric (moved to the metrics grid)
            const storiesMetricEl = document.getElementById('detailsMetricStories');
            if (storiesMetricEl) {
                const storiesValue = property.numberOfFloors != null ? property.numberOfFloors : (property.numberOfStories != null ? property.numberOfStories : '-');
                storiesMetricEl.textContent = storiesValue;
            }

            // hide year built / sqft rows as they are not stored
            ['detailsPropertyYearBuilt','detailsPropertySqft'].forEach(id=>{
                const el = document.getElementById(id);
                if (el) el.closest('.info-group').style.display = 'none';
            });

            // Metrics calculations (occupancy, expected/actual rent, maintenance)
            const propertyNameForQuery = property.apartmentName || property.name || property.apartmentAddress || property.address || '';
            const propertyAddressForQuery = property.apartmentAddress || property.address || '';
            const landlordId = this.currentUser?.uid || this.currentUser?.id;

            // --- Fetch units in the same way the unit layout uses (so occupancy matches) ---
            let units = [];
            try {
                if (window.DataManager && typeof window.DataManager.getLandlordUnits === 'function') {
                    const allUnits = await window.DataManager.getLandlordUnits(landlordId);
                    units = (allUnits || []).filter(u => {
                        return (u.apartmentId && u.apartmentId === propertyId) ||
                            (u.propertyId && u.propertyId === propertyId) ||
                            (propertyAddressForQuery && (u.apartmentAddress === propertyAddressForQuery || u.rentalAddress === propertyAddressForQuery));
                    });
                }
            } catch (err) {
                console.warn('⚠️ Error fetching units via DataManager:', err);
            }

            // Fallbacks: use service helper or legacy rooms collection
            if (!units.length) {
                if (typeof this.service.getPropertyUnits === 'function') {
                    units = await this.service.getPropertyUnits(propertyId);
                }
            }

            if (!units.length && window.firebaseDb) {
                // Try to load from units collection directly (newer schema)
                const unitQueries = [
                    { field: 'propertyId', value: propertyId },
                    { field: 'apartmentId', value: propertyId }
                ];
                for (const q of unitQueries) {
                    if (!q.value) continue;
                    const snapshot = await window.firebaseDb.collection('units').where(q.field, '==', q.value).get();
                    if (!snapshot.empty) {
                        units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        break;
                    }
                }
            }

            // Make sure units have a normalized occupied status (like the unit layout)
            units = units.map(u => ({
                ...u,
                status: (u.status || '').toLowerCase() === 'occupied' ? 'occupied' : (u.status || 'vacant'),
                isAvailable: u.isAvailable !== undefined ? u.isAvailable : (u.status || '').toLowerCase() !== 'occupied'
            }));

            // --- Fetch leases for this property to compute occupancy / expected rent ---
            let leases = [];
            try {
                if (window.DataManager && typeof window.DataManager.getLandlordLeases === 'function') {
                    leases = await window.DataManager.getLandlordLeases(landlordId);
                } else if (window.firebaseDb) {
                    const snapshot = await window.firebaseDb.collection('leases').where('landlordId', '==', landlordId).get();
                    leases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            } catch (err) {
                console.warn('⚠️ Error fetching leases for property stats:', err);
            }

            const leaseMatchesProperty = (lease) => {
                if (!lease) return false;
                if (propertyId && (lease.apartmentId === propertyId || lease.propertyId === propertyId || lease.rentalPropertyId === propertyId)) {
                    return true;
                }
                if (propertyAddressForQuery) {
                    if (lease.apartmentAddress === propertyAddressForQuery || lease.rentalAddress === propertyAddressForQuery) return true;
                }
                if (propertyNameForQuery && lease.apartmentName === propertyNameForQuery) return true;
                return false;
            };

            const isActiveLease = (lease) => lease && lease.isActive !== false && (lease.status === 'active' || lease.status === 'verified' || !lease.status);

            const propertyLeases = leases.filter(l => leaseMatchesProperty(l) && isActiveLease(l));
            const occupiedUnits = propertyLeases.length;

            // Total units should reflect numberOfRooms (or totalUnits) if available, otherwise fall back to fetched units
            const totalUnits = property.numberOfRooms != null ? property.numberOfRooms : (property.totalUnits != null ? property.totalUnits : (units || []).length);
            const unitsEl = document.getElementById('detailsMetricUnits');
            if (unitsEl) unitsEl.textContent = totalUnits;

            const occupancyRateFinal = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
            const occupancyEl = document.getElementById('detailsMetricOccupancy');
            if (occupancyEl) occupancyEl.textContent = `${occupancyRateFinal}%`;

            // Expected rent: sum of monthly rent from active leases (fallback to unit rents)
            let expectedRent = propertyLeases.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
            if (!expectedRent && units && units.length) {
                expectedRent = units.reduce((sum, u) => sum + (u.monthlyRent || u.rent || 0), 0);
            }
            const expectedEl = document.getElementById('detailsMetricExpectedRent');
            if (expectedEl) expectedEl.textContent = `₱${(expectedRent || 0).toLocaleString()}`;

            // Actual rent collection: sum of paid bills this month for this apartment
            const actualEl = document.getElementById('detailsMetricActualRent');
            if (actualEl) {
                let actualRent = 0;
                try {
                    let bills = [];
                    if (window.DataManager && typeof window.DataManager.getBillsForApartment === 'function') {
                        bills = await window.DataManager.getBillsForApartment(landlordId, propertyNameForQuery);
                    } else if (window.DataManager && typeof window.DataManager.getBills === 'function') {
                        bills = await window.DataManager.getBills(landlordId);
                    } else if (window.firebaseDb) {
                        const snapshot = await window.firebaseDb.collection('bills').where('landlordId', '==', landlordId).get();
                        bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    }

                    // Filter bills to this property
                    bills = bills.filter(b => {
                        if (!b) return false;
                        if (propertyId && (b.propertyId === propertyId || b.apartmentId === propertyId)) return true;
                        if (propertyAddressForQuery && (b.apartmentAddress === propertyAddressForQuery || b.propertyAddress === propertyAddressForQuery)) return true;
                        if (propertyNameForQuery && (b.apartment === propertyNameForQuery || b.apartmentName === propertyNameForQuery || b.propertyName === propertyNameForQuery)) return true;
                        if (b.roomNumber && units.some(u => u.roomNumber && u.roomNumber === b.roomNumber)) return true;
                        return false;
                    });

                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

                    const normalizeDate = (d) => {
                        if (!d) return null;
                        if (d.toDate) return d.toDate();
                        return new Date(d);
                    };
                    const isThisMonth = (d) => d && d >= monthStart && d < monthEnd;

                    actualRent = bills.reduce((sum, bill) => {
                        const paidDate = normalizeDate(bill.paidDate);
                        if (!isThisMonth(paidDate)) return sum;
                        const paidAmount = (bill.paidAmount != null && bill.paidAmount !== '')
                            ? bill.paidAmount
                            : (bill.status === 'paid' ? bill.amount : 0);
                        return sum + (paidAmount || 0);
                    }, 0);
                } catch (err) {
                    console.warn('Unable to compute actual rent collection:', err);
                }
                actualEl.textContent = `₱${(actualRent || 0).toLocaleString()}`;
            }

            // Maintenance requests (open)
            let maintenanceRequests = [];
            try {
                if (window.DataManager && typeof window.DataManager.getMaintenanceRequests === 'function') {
                    maintenanceRequests = await window.DataManager.getMaintenanceRequests(landlordId);
                } else if (window.firebaseDb) {
                    const snapshot = await window.firebaseDb.collection('maintenance').where('landlordId', '==', landlordId).get();
                    maintenanceRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            } catch (err) {
                console.warn('⚠️ Error fetching maintenance requests:', err);
            }

            const matchingMaintenance = maintenanceRequests.filter(m => {
                if (!m) return false;
                if (propertyId && (m.propertyId === propertyId || m.apartmentId === propertyId)) return true;
                if (propertyAddressForQuery && (m.apartmentAddress === propertyAddressForQuery || m.propertyAddress === propertyAddressForQuery)) return true;
                if (propertyNameForQuery && (m.apartment === propertyNameForQuery || m.apartmentName === propertyNameForQuery || m.propertyName === propertyNameForQuery)) return true;
                if (m.roomNumber && units.some(u => u.roomNumber && u.roomNumber === m.roomNumber)) return true;
                return false;
            });
            const openMaintenance = (matchingMaintenance || []).filter(m => m.status !== 'completed').length;
            document.getElementById('detailsMetricMaintenance').textContent = openMaintenance;

            // overview tab
            const addressStr = property.apartmentAddress || property.address || property.propertyAddress || property.location || '';
            document.getElementById('detailsFullAddress').textContent = addressStr;
            const descEl = document.getElementById('detailsDescription');
            if (descEl) {
                if (property.description) {
                    descEl.textContent = property.description;
                    descEl.style.fontStyle = 'normal';
                    descEl.style.color = '#1f2937';
                } else {
                    descEl.textContent = 'No description';
                    descEl.style.fontStyle = 'italic';
                    descEl.style.color = '#6b7280';
                }
            }

            // amenities
            const amenitiesEl = document.getElementById('detailsAmenities');
            if (amenitiesEl) {
                if (property.amenities && property.amenities.length > 0) {
                    amenitiesEl.innerHTML = property.amenities.map(a =>
                        `<span><i class="fas fa-check-circle"></i> ${a}</span>`
                    ).join('');
                } else {
                    amenitiesEl.innerHTML = '<span style="color:#9ca3af;">None listed</span>';
                }
            }

            // populate tabs (units, maintenance, tenants, activity)
            // pass the full property object so tab population can match by name/address
            await this._populatePropertyDetailsTabs(propertyId, units, maintenanceRequests, property);

            // tab switching helper
            this._setupPropertyDetailsTabs();

            // show content
            loading && (loading.style.display = 'none');
            content && (content.style.display = 'block');

            console.log('Modal rendered successfully');
        } catch (error) {
            console.error('Error fetching property for modal:', error);
            window.showPropertiesError('Failed to load property details: ' + error.message);
            const modal = document.getElementById('propertyDetailsModal');
            if (modal) modal.style.display = 'none';
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Open edit property modal
     */
    /**
     * Open edit form modal for a property object.  The form fields are
     * pre‑populated and the submit handler will call {@link updateProperty}.
     *
     * @param {Object} property  Property record (must contain id)
     */
    /**
     * When the details modal is open there is a small "edit" button that
     * simply needs to funnel through to the same editing logic.  This helper
     * lets the dashboard and other pages call it without worrying about the
     * underlying implementation.
     */
    editPropertyFromDetails() {
        const modal = document.getElementById('propertyDetailsModal');
        if (!modal) {
            console.warn('editPropertyFromDetails: modal element missing');
            return;
        }
        const pid = modal.dataset.propertyId;
        if (pid) {
            // should open the generic edit modal; landlords may override this
            this.editProperty(pid);
        } else {
            console.warn('editPropertyFromDetails called but no propertyId found');
        }
    }

    openEditPropertyModal(property) {
        // support being called with an id string so existing view code doesn't break
        if (typeof property === 'string') {
            return this.editProperty(property);
        }
        if (!property || !property.id) {
            console.warn('openEditPropertyModal called without valid property');
            return;
        }

        console.log('Opening edit modal for property:', property.id);
        // store original values so we can re-popaint when navigating back
        this._editingProperty = property;
        this._editPropertyData = {
            name: property.name || '',
            address: property.address || '',
            description: property.description || '',
            numberOfRooms: property.numberOfRooms || property.rooms || 0,
            numberOfFloors: property.numberOfFloors || property.floors || 0,
            status: property.status || (property.isActive ? 'active' : 'inactive')
        };

        // helper to build step1 form html using current _editPropertyData
        const buildStep1 = () => `
            <div id="editPropertyForm">
                <div class="form-group">
                    <label>Apartment Name *</label>
                    <input type="text" id="editPropertyName" class="form-input" required value="${(this._editPropertyData.name||'').replace(/"/g,'&quot;')}" />
                </div>
                <div class="form-group">
                    <label>Apartment Address *</label>
                    <input type="text" id="editPropertyAddress" class="form-input" required value="${(this._editPropertyData.address||'').replace(/"/g,'&quot;')}" />
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="editPropertyDescription" class="form-input" rows="3">${this._editPropertyData.description||''}</textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label>Number of Rooms *</label>
                        <input type="number" id="editPropertyRooms" class="form-input" min="1" required value="${this._editPropertyData.numberOfRooms||0}" />
                    </div>
                    <div class="form-group">
                        <label>Number of Floors *</label>
                        <input type="number" id="editPropertyFloors" class="form-input" min="1" required value="${this._editPropertyData.numberOfFloors||0}" />
                    </div>
                </div>
                <div class="form-group">
                    <label>Status *</label>
                    <select id="editPropertyStatus" class="form-input" required>
                        <option value="active" ${this._editPropertyData.status==='active'?'selected':''}>Active</option>
                        <option value="inactive" ${this._editPropertyData.status==='inactive'?'selected':''}>Inactive</option>
                    </select>
                </div>
                <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="ModalManager.closeModal(this.closest('.modal-overlay'))">Cancel</button>
                    <button type="button" class="btn btn-primary" id="editNextBtn">Next: Room Details</button>
                </div>
            </div>
        `;

        const modal = window.modalManager.openModal(buildStep1(), {
            title: 'Edit Property',
            showFooter: false,
            width: '600px'
        });

        // keep reference on controller so we can update after save
        this._currentEditModal = modal;
        this._currentEditingId = property.id;

        // helpers to switch steps
        const showStep1 = () => {
            modal.querySelector('.modal-body').innerHTML = buildStep1();
            const nextBtn = modal.querySelector('#editNextBtn');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    console.log('edit modal step1 next clicked');
                    // gather and validate
                    const name = modal.querySelector('#editPropertyName').value.trim();
                    const addr = modal.querySelector('#editPropertyAddress').value.trim();
                    const floors = parseInt(modal.querySelector('#editPropertyFloors').value, 10) || 0;
                    const rooms = parseInt(modal.querySelector('#editPropertyRooms').value, 10) || 0;
                    const desc = modal.querySelector('#editPropertyDescription').value.trim();
                    const status = modal.querySelector('#editPropertyStatus').value;

                    if (!name || !addr || rooms < 1 || floors < 1) {
                        const msg = 'Please fill in all required fields';
                        if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                            window.notificationManager.error(msg);
                        } else {
                            // fallback when notificationManager hasn't been initialized
                            alert(msg);
                            console.warn('Validation failed and notificationManager was missing');
                        }
                        return;
                    }

                    // store data for later, including mirrored apartment fields if necessary
                    const newData = { name, address: addr, description: desc, numberOfRooms: rooms, numberOfFloors: floors, status };
                    if (this._editingProperty && this._editingProperty.apartmentName !== undefined) {
                        newData.apartmentName = name;
                        newData.apartmentAddress = addr;
                    }
                    this._editPropertyData = newData;
                    showStep2();
                });
            } else {
                console.warn('editNextBtn not found in modal');
            }
        };

        const showStep2 = () => {
            console.log('showStep2 invoked for property', property.id, 'with data', this._editPropertyData);
            const step2HTML = `
                <div class="edit-property-step2">
                    <h5 style="margin-bottom:25px; color: var(--royal-blue);">Step 2: Room Details</h5>
                    <div id="editRoomContainer" style="max-height:400px; overflow-y:auto; margin-bottom:20px;">
                        <p>Loading units...</p>
                    </div>
                    <div style="margin-top:10px;">
                        <button type="button" class="btn btn-sm btn-secondary" id="addRoomBtn">+ Add Room</button>
                    </div>
                    <div style="margin-top:25px; display:flex; gap:10px; justify-content:flex-end;">
                        <button type="button" class="btn btn-secondary" id="backToStep1Btn">Back</button>
                        <button type="button" class="btn btn-primary" id="savePropertyBtn">Update Property & Rooms</button>
                    </div>
                </div>
            `;
            modal.querySelector('.modal-body').innerHTML = step2HTML;

            // populate rooms from database
            this.populateRoomDetails(property.id, modal.querySelector('#editRoomContainer'));

            // allow adding blank form
            const addRoomBtn = modal.querySelector('#addRoomBtn');
            if (addRoomBtn) {
                addRoomBtn.addEventListener('click', () => {
                    const container = modal.querySelector('#editRoomContainer');
                    if (container) {
                        container.insertAdjacentHTML('beforeend', this._roomFormHTML());
                        const newForm = container.lastElementChild;
                        this._attachRoomFormListeners(newForm);
                    }
                });
            }

            // back button
            modal.querySelector('#backToStep1Btn').addEventListener('click', () => {
                showStep1();
            });

            // save button
            modal.querySelector('#savePropertyBtn').addEventListener('click', async () => {
                const btn = modal.querySelector('#savePropertyBtn');
                btn.disabled = true;
                try {
                    // updateProperty already handles room saving as part of its workflow
                    await this.updateProperty(property.id, this._editPropertyData);
                    if (window.notificationManager && typeof window.notificationManager.success === 'function') {
                        window.notificationManager.success('Property and room details updated');
                    }
                    window.modalManager.closeModal(modal);
                    // clear references so updateProperty won't try to refresh later
                    this._currentEditModal = null;
                    this._currentEditingId = null;
                } catch (err) {
                    console.error('Error saving edits:', err);
                    if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                        window.notificationManager.error('Failed to update property/rooms');
                    }
                } finally {
                    btn.disabled = false;
                }
            });
        };

        // start on step 1
        showStep1();
    }

    /**
     * Create new property
     */
    async createProperty(propertyData) {
        try {
            window.setPropertiesLoading(true);
            window.hidePropertiesError();

            const property = new Property(propertyData);
            if (!property.isValid()) {
                const errors = property.getValidationErrors();
                throw new Error(errors.join(', '));
            }

            await this.service.createProperty(propertyData);
            await this.loadProperties();

            if (window.modalManager) {
                window.modalManager.closeModal('addProperty');
            }

            if (window.notificationManager) {
                window.notificationManager.success('Property created successfully');
            }
        } catch (error) {
            console.error('Error creating property:', error);
            window.showPropertiesError(error.message || 'Failed to create property');
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Update property
     */
    async updateProperty(propertyId, propertyData) {
        try {
            window.setPropertiesLoading(true);
            window.hidePropertiesError();

            const property = new Property(propertyData);
            if (!property.isValid()) {
                const errors = property.getValidationErrors();
                throw new Error(errors.join(', '));
            }

            await this.service.updateProperty(propertyId, propertyData);
            // reload the list so cards reflect changes
            await this.loadProperties();

            if (window.notificationManager) {
                window.notificationManager.success('Property updated successfully');
            }

            // save room changes as well
            await this._saveRoomDetails();

            // if the edit modal is still open for this property refresh its fields
            if (this._currentEditingId === propertyId && this._currentEditModal) {
                const updated = await this.service.getProperty(propertyId);
                if (updated) {
                    const nameField = document.getElementById('editPropertyName');
                    if (nameField) {
                        nameField.value = updated.name || '';
                    }
                    const addrField = document.getElementById('editPropertyAddress');
                    if (addrField) {
                        addrField.value = updated.address || '';
                    }
                    const descField = document.getElementById('editPropertyDescription');
                    if (descField) {
                        descField.value = updated.description || '';
                    }
                    const roomsField = document.getElementById('editPropertyRooms');
                    if (roomsField) {
                        roomsField.value = updated.numberOfRooms || updated.rooms || 0;
                    }
                    const floorsField = document.getElementById('editPropertyFloors');
                    if (floorsField) {
                        floorsField.value = updated.numberOfFloors || updated.floors || 0;
                    }
                    const statusField = document.getElementById('editPropertyStatus');
                    if (statusField) {
                        statusField.value = updated.status || (updated.isActive ? 'active' : 'inactive');
                    }
                }
            }

            // do not automatically close modal; user can close manually
        } catch (error) {
            console.error('Error updating property:', error);
            window.showPropertiesError(error.message || 'Failed to update property');
            // leave modal open so user can try again
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Delete property
     */
    async deleteProperty(propertyId) {
        try {
            window.setPropertiesLoading(true);
            window.hidePropertiesError();

            await this.service.deleteProperty(propertyId);
            await this.loadProperties();

            if (window.notificationManager) {
                window.notificationManager.success('Property deleted successfully');
            }
        } catch (error) {
            console.error('Error deleting property:', error);
            window.showPropertiesError(error.message || 'Failed to delete property');
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Called internally to populate additional detail tabs after the initial data load.
     * @param {string} propertyId
     * @param {Array} units
     * @param {Array} maintenanceRequests
     */
    async _populatePropertyDetailsTabs(propertyId, units, maintenanceRequests, property) {
        // units tab
        const unitsList = document.getElementById('unitsList');
        if (unitsList) {
            if (!units || units.length === 0) {
                unitsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No units found</p>';
            } else {
                unitsList.innerHTML = units.map(unit => `
                    <div class="unit-item">
                        <div class="unit-header">
                            <div class="unit-name">${unit.unitNumber || 'Unit ' + unit.id.substring(0, 5)}</div>
                            <div class="unit-status">${unit.isOccupied ? 'Occupied' : 'Vacant'}</div>
                        </div>
                        <span class="status-badge ${unit.isOccupied ? 'status-active' : 'status-inactive'}">
                            ${unit.isOccupied ? 'Occupied' : 'Vacant'}
                        </span>
                    </div>
                `).join('');
            }
        }

        // maintenance tab
        const maintenanceList = document.getElementById('maintenanceList');
        if (maintenanceList) {
            if (!maintenanceRequests || maintenanceRequests.length === 0) {
                maintenanceList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No maintenance requests</p>';
            } else {
                maintenanceList.innerHTML = maintenanceRequests.map(req => {
                    const date = req.createdAt ? new Date(req.createdAt.toDate?.() || req.createdAt).toLocaleDateString() : '';
                    return `
                        <div class="maintenance-item">
                            <div class="maintenance-header">
                                <div>
                                    <div class="maintenance-title">${req.title || 'Maintenance Request'}</div>
                                    <div class="maintenance-description">${req.description || ''}</div>
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
        }

        // tenants tab
        // Use the users collection (role=tenant + apartmentId matches) so the activity tab can easily filter by tenant IDs.
        let tenants = [];
            try {
                if (this.service.getPropertyTenants) {
                    tenants = await this.service.getPropertyTenants(propertyId);
                } else if (window.DataManager && typeof window.DataManager.getTenantsForLandlord === 'function') {
                    // prefer DataManager helper when available
                    const landlordId = this.currentUser?.uid || this.currentUser?.id;
                    const allTenants = await window.DataManager.getTenantsForLandlord(landlordId);
                    tenants = (allTenants || []).filter(t => {
                        if (!t) return false;
                        // treat missing isActive as active, exclude archived
                        if (t.archived === true) return false;
                        if (t.isActive === false) return false;
                        // match by common fields
                        if (t.apartmentId === propertyId || t.propertyId === propertyId) return true;
                        if (t.apartment === propertyId || t.apartmentName === propertyId) return true;
                        // also allow matching by stored apartment name/address when available
                        if (t.apartmentName && property && (t.apartmentName === property.apartmentName || t.apartmentName === property.name)) return true;
                        if (t.apartmentAddress && property && (t.apartmentAddress === property.apartmentAddress || t.apartmentAddress === property.address)) return true;
                        return false;
                    });
                } else if (window.firebaseDb) {
                    // Firestore composite/index issues can cause strict chained where() queries
                    // to miss records. Query by role and filter client-side for robustness.
                    const snapshot = await window.firebaseDb
                        .collection('users')
                        .where('role', '==', 'tenant')
                        .get();

                    tenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // client-side filter: treat missing isActive as active, exclude archived
                    tenants = tenants.filter(t => {
                        if (!t) return false;
                        if (t.archived === true) return false;
                        if (t.isActive === false) return false;

                        // direct id references
                        if (t.apartmentId === propertyId || t.propertyId === propertyId) return true;

                        // common alternate fields (some tenants store apartment name/address)
                        if (t.apartmentName && property && (t.apartmentName === property.apartmentName || t.apartmentName === property.name)) return true;
                        if (t.apartmentAddress && property && (t.apartmentAddress === property.apartmentAddress || t.apartmentAddress === property.address)) return true;

                        // fallback: match by unit/room number if both present
                        if (t.roomNumber && Array.isArray(units) && units.some(u => u.roomNumber && u.roomNumber === t.roomNumber && (u.propertyId === propertyId || u.apartmentId === propertyId))) return true;

                        return false;
                    });
                }

            const tenantsList = document.getElementById('tenantsList');
            if (tenantsList) {
                // Fallback: if no tenants found in `users`, try leases (some flows write tenants to `leases`/`tenants` first)
                if ((!tenants || tenants.length === 0) && window.firebaseDb) {
                    try {
                        const leaseQueries = [
                            { field: 'propertyId', value: propertyId },
                            { field: 'apartmentId', value: propertyId },
                            { field: 'rentalPropertyId', value: propertyId }
                        ];

                        let leaseDocs = [];
                        for (const q of leaseQueries) {
                            if (!q.value) continue;
                            const snap = await window.firebaseDb.collection('leases')
                                .where(q.field, '==', q.value)
                                .where('isActive', '==', true)
                                .where('archived', '==', false)
                                .get();
                            if (!snap.empty) {
                                leaseDocs = leaseDocs.concat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                            }
                        }

                        // Deduplicate leases by tenantId
                        const seenTenantIds = new Set();
                        const leaseTenants = [];
                        for (const l of leaseDocs) {
                            const tid = l.tenantId || l.tenant || null;
                            if (!tid || seenTenantIds.has(tid)) continue;
                            seenTenantIds.add(tid);

                            // Try to get user doc for richer info
                            let userObj = null;
                            try {
                                const udoc = await window.firebaseDb.collection('users').doc(tid).get();
                                if (udoc.exists) userObj = { id: udoc.id, ...udoc.data() };
                            } catch (uErr) {
                                console.warn('Could not read user for tenantId', tid, uErr);
                            }

                            if (userObj && userObj.archived !== true && userObj.isActive !== false) {
                                leaseTenants.push(userObj);
                            } else {
                                // synthesize a minimal tenant object from lease
                                leaseTenants.push({
                                    id: tid,
                                    name: l.tenantName || l.tenant || (userObj && userObj.name) || 'Tenant',
                                    email: l.tenantEmail || (userObj && userObj.email) || '',
                                    phone: l.tenantPhone || (userObj && userObj.phone) || '',
                                    roomNumber: l.roomNumber || '',
                                    occupation: (userObj && userObj.occupation) || '',
                                    age: (userObj && userObj.age) || null
                                });
                            }
                        }

                        if (leaseTenants.length) {
                            tenants = leaseTenants;
                        }
                    } catch (leaseErr) {
                        console.warn('Error fetching leases fallback for tenants tab:', leaseErr);
                    }
                }

                if (!tenants || tenants.length === 0) {
                    tenantsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No active tenants</p>';
                } else {
                    tenantsList.innerHTML = tenants.map(tenant => {
                        const age = tenant.age ? `Age: ${tenant.age}` : '';
                        const occupation = tenant.occupation ? `Occupation: ${tenant.occupation}` : '';
                        const phone = tenant.phone ? `Phone: ${tenant.phone}` : '';
                        const extras = [age, occupation, phone].filter(Boolean).join(' · ');

                        // Some user documents store a full `name` field instead of first/last.
                        const displayName = (tenant.firstName || tenant.lastName)
                            ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()
                            : (tenant.name || '');

                        return `
                        <div class="tenant-item">
                            <div class="tenant-info">
                                <div class="tenant-name">${displayName}</div>
                                <div class="tenant-unit">${tenant.email || ''}</div>
                                ${extras ? `<div class="tenant-meta">${extras}</div>` : ''}
                            </div>
                        </div>
                    `;
                    }).join('');
                }
            }
        } catch (e) {
            console.warn('Error populating tenants tab', e);
        }

        // activity tab
        try {
            let activities = [];

            // Determine which tenants are associated with this apartment (used to filter activities)
            const tenantIds = (tenants || []).map(t => t.id).filter(Boolean);

            if (this.service.getPropertyActivity) {
                activities = await this.service.getPropertyActivity(propertyId);
            } else if (window.firebaseDb && tenantIds.length > 0) {
                // Firestore "in" queries are limited to 10 items; chunk if needed
                const chunked = [];
                for (let i = 0; i < tenantIds.length; i += 10) {
                    chunked.push(tenantIds.slice(i, i + 10));
                }

                for (const chunk of chunked) {
                    const snapshot = await window.firebaseDb
                        .collection('activities')
                        .where('tenantId', 'in', chunk)
                        .where('landlordId', '==', this.currentUser?.uid || '')
                        .orderBy('createdAt', 'desc')
                        .limit(20)
                        .get();
                    activities.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }

                // ensure newest first
                activities.sort((a, b) => {
                    const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0).getTime();
                    const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0).getTime();
                    return bDate - aDate;
                });
            }

            const activityList = document.getElementById('activityList');
            if (activityList) {
                if (!activities || activities.length === 0) {
                    activityList.innerHTML = '<p style="text-align: center; color: #9ca3af;">No activity recorded</p>';
                } else {
                    activityList.innerHTML = activities.map(activity => {
                        const date = activity.createdAt ? new Date(activity.createdAt.toDate?.() || activity.createdAt).toLocaleDateString() : '';
                        const title = activity.title || activity.action || 'Activity';
                        const message = activity.message || activity.description || '';
                        return `
                            <div class="activity-item">
                                <div class="activity-icon"><i class="fas fa-circle"></i></div>
                                <div class="activity-content">
                                    <div class="activity-title">${title}</div>
                                    <div class="activity-time">${date}</div>
                                    ${message ? `<div class="activity-description">${message}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (e) {
            console.warn('Error populating activity tab', e);
        }
    }

    /**
     * Wire up tab buttons inside property details modal.
     */
    _setupPropertyDetailsTabs() {
        // Avoid binding duplicate listeners on repeated modal opens
        if (this._propertyDetailsTabsInitialized) return;
        this._propertyDetailsTabsInitialized = true;

        const tabButtons = document.querySelectorAll('.property-tabs .tab-button');
        const tabPanes = document.querySelectorAll('.property-tab-content .tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = button.getAttribute('data-tab');

                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.style.display = 'none');

                button.classList.add('active');
                const pane = document.getElementById(`tab-${tabName}`);
                if (pane) pane.style.display = 'block';
            });
        });
    }

    /**
     * Close the details modal if it's visible.
     */
    closePropertyDetailsModal() {
        const modal = document.getElementById('propertyDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Get property statistics
     */
    async getPropertyStats() {
        try {
            const stats = {
                total: this.allProperties.length,
                occupied: this.allProperties.filter(p => p.occupancyRate === 100).length,
                vacant: this.allProperties.filter(p => p.occupancyRate < 100).length,
                totalRevenue: this.allProperties.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0)
            };
            return stats;
        } catch (error) {
            console.error('Error getting property stats:', error);
            return null;
        }
    }
}

// Initialize and expose to window
if (window.dataService) {
    window.propertiesController = new PropertiesController(window.dataService);
}
