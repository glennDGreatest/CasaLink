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
                <button type="button" class="btn btn-sm btn-danger remove-room-btn" style="position:absolute;top:8px;right:8px;padding:2px 5px;font-size:14px;line-height:1;">&times;</button>
                <div class="form-row" style="gap:10px;flex-wrap:wrap;display:flex;">
                    <div class="form-group" style="flex:1; min-width:150px;">
                        <label class="form-label">Room Number *</label>
                        <input type="text" class="room-number form-input" value="${unit.roomNumber || ''}" required />
                        <p class="room-number-error" style="color: red; font-size: 12px; margin-top: 3px; display: none;"></p>
                    </div>
                    <div class="form-group" style="flex:1; min-width:120px;">
                        <label class="form-label">Floor *</label>
                        <input type="number" class="room-floor form-input" min="1" max="${this._editPropertyData?.numberOfFloors || 1}" value="${unit.floor || ''}" required />
                        <p class="room-floor-error" style="color: red; font-size: 12px; margin-top: 3px; display: none;"></p>
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

    _attachRoomFormListeners(formElem, onRemoveCallback, existingRoomNumbers = []) {
        const removeBtn = formElem.querySelector('.remove-room-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const uid = formElem.getAttribute('data-unit-id');
                if (uid) {
                    this._roomsToDelete = this._roomsToDelete || [];
                    this._roomsToDelete.push(uid);
                }
                formElem.remove();
                if (typeof onRemoveCallback === 'function') {
                    onRemoveCallback();
                }
            });
        }

        // Validate room number (no duplicates)
        const roomNumberInput = formElem.querySelector('.room-number');
        const roomNumberError = formElem.querySelector('.room-number-error');
        if (roomNumberInput && roomNumberError) {
            const validateRoomNumber = () => {
                const roomNumber = roomNumberInput.value.trim();
                const currentUnitId = formElem.getAttribute('data-unit-id');
                
                // ✅ FIX: Dynamically get all other room numbers from the DOM instead of using static snapshot
                // This ensures we always check against the current state, including newly added rooms
                const container = formElem.closest('[id*="Container"]') || formElem.parentElement?.parentElement;
                const otherRoomNumbers = [];
                if (container) {
                    const allForms = container.querySelectorAll('.room-form');
                    allForms.forEach(form => {
                        if (form !== formElem) {  // Don't check against self
                            const otherNumber = form.querySelector('.room-number')?.value.trim() || '';
                            if (otherNumber) {
                                otherRoomNumbers.push(otherNumber);
                            }
                        }
                    });
                }
                
                const isDuplicate = roomNumber && otherRoomNumbers.includes(roomNumber);
                
                if (isDuplicate) {
                    roomNumberInput.style.borderColor = 'red';
                    roomNumberInput.style.backgroundColor = '#ffe6e6';
                    roomNumberError.textContent = 'This room number already exists. Please use a different one.';
                    roomNumberError.style.display = 'block';
                } else {
                    roomNumberInput.style.borderColor = '';
                    roomNumberInput.style.backgroundColor = '';
                    roomNumberError.style.display = 'none';
                }
            };
            roomNumberInput.addEventListener('input', validateRoomNumber);
            roomNumberInput.addEventListener('change', validateRoomNumber);
            roomNumberInput.addEventListener('blur', validateRoomNumber);
        }

        // Validate floor (not exceeding max floors)
        const floorInput = formElem.querySelector('.room-floor');
        const floorError = formElem.querySelector('.room-floor-error');
        if (floorInput && floorError) {
            const validateFloor = () => {
                const floorValue = parseInt(floorInput.value, 10);
                const maxFloors = this._editPropertyData?.numberOfFloors || 1;
                
                if (floorValue > maxFloors) {
                    floorInput.style.borderColor = 'red';
                    floorInput.style.backgroundColor = '#ffe6e6';
                    floorError.textContent = `This is the highest floor this apartment has (${maxFloors}). If you want to have units beyond this floor, click the Back button and adjust the Number of Floors field accordingly.`;
                    floorError.style.display = 'block';
                } else {
                    floorInput.style.borderColor = '';
                    floorInput.style.backgroundColor = '';
                    floorError.style.display = 'none';
                }
            };
            floorInput.addEventListener('change', validateFloor);
            floorInput.addEventListener('blur', validateFloor);
            floorInput.addEventListener('input', validateFloor);
        }
    }

    async populateRoomDetails(propertyId, containerEl, onRemoveCallback) {
        try {
            this._roomsToDelete = [];
            if (!propertyId) return;
            const container = containerEl || document.querySelector('#editRoomContainer');
            if (!container) return;
            container.innerHTML = '<p>Loading units...</p>';
            let units = [];
            console.log('populateRoomDetails called for propertyId=', propertyId, 'editingProperty=', this._editingProperty);

            // 1) Prefer service helper when available
            if (this.service && typeof this.service.getPropertyUnits === 'function') {
                try {
                    units = await this.service.getPropertyUnits(propertyId) || [];
                } catch (svcErr) {
                    console.log('service.getPropertyUnits error:', svcErr);
                    units = [];
                }
            }

            // 2) Try the 'units' collection directly (newer schema) using available DB ref
            if ((!units || units.length === 0)) {
                const db = (typeof window !== 'undefined' && window.firebaseDb) || (typeof firebaseDb !== 'undefined' && firebaseDb) || null;
                if (db) {
                    try {
                        let snap = await db.collection('units').where('propertyId', '==', propertyId).get();
                        if (snap.empty) {
                            snap = await db.collection('units').where('apartmentId', '==', propertyId).get();
                        }
                        if (!snap.empty) units = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    } catch (dbErr) {
                        console.log('Error querying units collection:', dbErr);
                    }
                } else {
                    // If no db reference, try DataManager client-side fallback
                    if (window.DataManager && typeof window.DataManager.getLandlordUnits === 'function') {
                        try {
                            const landlordId = this.currentUser?.uid || this.currentUser?.id;
                            const allUnits = await window.DataManager.getLandlordUnits(landlordId);
                            units = (allUnits || []).filter(u => u.apartmentId === propertyId || u.propertyId === propertyId || u.apartmentAddress === (this._editingProperty?.apartmentAddress || this._editingProperty?.address));
                        } catch (dmErr) {
                            console.log('DataManager.getLandlordUnits error:', dmErr);
                        }
                    }
                }
            }

            // 3) Fallback: some installations store rooms in a 'rooms' collection
            if ((!units || units.length === 0)) {
                const db = (typeof window !== 'undefined' && window.firebaseDb) || (typeof firebaseDb !== 'undefined' && firebaseDb) || null;
                if (db) {
                    try {
                        // try by apartmentId/propertyId first
                        let roomSnap = await db.collection('rooms').where('apartmentId', '==', propertyId).get();
                        console.log('rooms.apartmentId query returned', roomSnap.size, 'docs');
                        if (roomSnap.empty) {
                            roomSnap = await db.collection('rooms').where('propertyId', '==', propertyId).get();
                            console.log('rooms.propertyId query returned', roomSnap.size);
                        }

                        // As a last resort, try matching by apartmentName or apartmentAddress from the editing context
                        if (roomSnap.empty && this._editingProperty) {
                            const name = this._editingProperty.apartmentName || this._editingProperty.name || this._editingProperty.propertyName || '';
                            const addr = this._editingProperty.apartmentAddress || this._editingProperty.address || this._editingProperty.propertyAddress || '';
                            if (name) {
                                const byName = await db.collection('rooms').where('apartmentName', '==', name).get();
                                console.log('rooms.apartmentName query returned', byName.size, 'docs for name=', name);
                                if (!byName.empty) roomSnap = byName;
                            }
                            if (roomSnap.empty && addr) {
                                const byAddr = await db.collection('rooms').where('apartmentAddress', '==', addr).get();
                                console.log('rooms.apartmentAddress query returned', byAddr.size, 'docs for addr=', addr);
                                if (!byAddr.empty) roomSnap = byAddr;
                            }
                        }

                        // landlordId + apartmentAddress fallback
                        if (roomSnap.empty && this._editingProperty && (this._editingProperty.landlordId || this.currentUser?.uid)) {
                            const landlordId = this._editingProperty.landlordId || this.currentUser?.uid;
                            const addr = this._editingProperty.apartmentAddress || this._editingProperty.address || '';
                            if (landlordId && addr) {
                                const byLandlordAndAddr = await db.collection('rooms')
                                    .where('landlordId', '==', landlordId)
                                    .where('apartmentAddress', '==', addr)
                                    .get();
                                console.log('rooms.landlordId+apartmentAddress query returned', byLandlordAndAddr.size);
                                if (!byLandlordAndAddr.empty) roomSnap = byLandlordAndAddr;
                            }
                        }

                        if (roomSnap && !roomSnap.empty) {
                            // normalize room docs to the unit shape expected by the form
                            units = roomSnap.docs.map(d => {
                                const r = d.data();
                                return {
                                    id: d.id,
                                    roomNumber: r.roomNumber || r.unitNumber || r.name || '',
                                    floor: r.floor || (r.floorNumber ? String(r.floorNumber) : ''),
                                    monthlyRent: r.monthlyRent || r.monthly_rate || r.rent || 0,
                                    securityDeposit: r.securityDeposit || r.security_deposit || r.deposit || 0,
                                    numberOfBedrooms: r.numberOfBedrooms || r.bedrooms || 0,
                                    numberOfBathrooms: r.numberOfBathrooms || r.bathrooms || 0,
                                    maxMembers: r.maxMembers || r.numberOfMembers || 1,
                                    propertyId: r.propertyId || r.apartmentId || propertyId,
                                    isAvailable: r.isAvailable !== undefined ? r.isAvailable : (r.status ? r.status !== 'occupied' : true),
                                    __raw: r
                                };
                            });
                        }
                    } catch (roomErr) {
                        console.log('Error querying rooms collection:', roomErr);
                    }
                }
            }
            units.sort((a, b) => {
                const parseFloor = (value) => {
                    const numeric = Number(value);
                    if (!Number.isNaN(numeric) && numeric > 0) return numeric;
                    const match = String(value || '').trim().match(/^\d+/);
                    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
                };

                const aFloor = parseFloor(a.floor || a.roomNumber);
                const bFloor = parseFloor(b.floor || b.roomNumber);
                if (aFloor !== bFloor) return aFloor - bFloor;

                const aLabel = String(a.roomNumber || '').trim().toUpperCase();
                const bLabel = String(b.roomNumber || '').trim().toUpperCase();
                return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: 'base' });
            });
            container.innerHTML = '';
            units.forEach(u => {
                container.insertAdjacentHTML('beforeend', this._roomFormHTML(u));
                const newForm = container.lastElementChild;
                if (newForm) {
                    const originalData = {
                        roomNumber: u.roomNumber || '',
                        floor: String(u.floor || ''),
                        monthlyRent: String(u.monthlyRent || 0),
                        securityDeposit: String(u.securityDeposit || 0),
                        numberOfBedrooms: String(u.numberOfBedrooms || 0),
                        numberOfBathrooms: String(u.numberOfBathrooms || 0),
                        maxMembers: String(u.maxMembers || 1)
                    };
                    newForm.dataset.originalRoomData = JSON.stringify(originalData);
                }
            });
            // Get all existing room numbers for duplicate checking
            const existingRoomNumbers = Array.from(container.querySelectorAll('.room-form')).map(form => ({
                number: form.querySelector('.room-number')?.value.trim() || '',
                unitId: form.getAttribute('data-unit-id') || ''
            })).filter(r => r.number);
            container.querySelectorAll('.room-form').forEach(f => this._attachRoomFormListeners(f, onRemoveCallback, existingRoomNumbers));
        } catch (err) {
            console.error('Error populating room details:', err);
        }
    }

    async _saveRoomDetails() {
        const root = document;
        const container = root.querySelector('#editRoomContainer');
        if (!container) return { added: [], modified: [], deleted: [] };
        
        const roomChanges = {
            added: [],
            modified: [],
            deleted: this._roomsToDelete?.length || 0
        };
        
        if (Array.isArray(this._roomsToDelete) && this._roomsToDelete.length > 0) {
            for (const uid of this._roomsToDelete) {
                try {
                    await window.firebaseDb.collection('rooms').doc(uid).delete();
                    console.log('🗑️ Deleted room', uid);
                } catch (e) {
                    console.warn('❌ Failed to delete room', uid, e);
                }
            }
            this._roomsToDelete = [];
        }
        const forms = container.querySelectorAll('.room-form');
        for (const form of Array.from(forms)) {
            const unitId = form.getAttribute('data-unit-id');
            
            // Get apartment address from the editing property for filtering in unit layout
            const apartmentAddress = this._editingProperty?.address || 
                                    this._editingProperty?.apartmentAddress || 
                                    this._editingProperty?.rentalAddress || '';
            const apartmentName = this._editingProperty?.name || 
                                 this._editingProperty?.apartmentName || '';
            const landlordId = this._editingProperty?.landlordId || 
                              this.currentUser?.uid || 
                              this.currentUser?.id || '';
            
            const data = {
                roomNumber: form.querySelector('.room-number')?.value || '',
                floor: form.querySelector('.room-floor')?.value || '',
                monthlyRent: parseFloat(form.querySelector('.room-rent')?.value) || 0,
                securityDeposit: parseFloat(form.querySelector('.room-deposit')?.value) || 0,
                numberOfBedrooms: parseInt(form.querySelector('.room-bedrooms')?.value, 10) || 0,
                numberOfBathrooms: parseFloat(form.querySelector('.room-bathrooms')?.value) || 0,
                maxMembers: parseInt(form.querySelector('.room-maxmembers')?.value, 10) || 1,
                apartmentId: this._currentEditingId,
                propertyId: this._currentEditingId,
                apartmentAddress: apartmentAddress,
                apartmentName: apartmentName,
                rentalAddress: apartmentAddress,
                landlordId: landlordId,
                updatedAt: new Date()
            };
            if (!data.roomNumber) continue;
            try {
                if (unitId) {
                    const originalRaw = form.dataset.originalRoomData;
                    const originalData = originalRaw ? JSON.parse(originalRaw) : {};
                    const changedFields = {};
                    if (data.roomNumber !== (originalData.roomNumber || '')) changedFields.roomNumber = data.roomNumber;
                    if (String(data.floor) !== (originalData.floor || '')) changedFields.floor = data.floor;
                    if (String(data.monthlyRent) !== (originalData.monthlyRent || '0')) changedFields.monthlyRent = data.monthlyRent;
                    if (String(data.securityDeposit) !== (originalData.securityDeposit || '0')) changedFields.securityDeposit = data.securityDeposit;
                    if (String(data.numberOfBedrooms) !== (originalData.numberOfBedrooms || '0')) changedFields.numberOfBedrooms = data.numberOfBedrooms;
                    if (String(data.numberOfBathrooms) !== (originalData.numberOfBathrooms || '0')) changedFields.numberOfBathrooms = data.numberOfBathrooms;
                    if (String(data.maxMembers) !== (originalData.maxMembers || '1')) changedFields.maxMembers = data.maxMembers;
                    if (Object.keys(changedFields).length > 0) {
                        // For existing rooms, only update when actual values changed
                        changedFields.updatedAt = new Date();
                        await window.firebaseDb.collection('rooms').doc(unitId).update({ ...changedFields, apartmentId: this._currentEditingId, propertyId: this._currentEditingId, apartmentAddress, apartmentName, rentalAddress, landlordId });
                        console.log('✏️ Updated room', unitId, 'with address:', apartmentAddress);
                        roomChanges.modified.push({ roomNumber: data.roomNumber, floor: data.floor });
                    } else {
                        console.log('ℹ️ No changes detected for room', unitId);
                    }
                } else {
                    // For new rooms, set as vacant
                    data.createdAt = new Date();
                    data.isAvailable = true;
                    data.status = 'vacant';
                    const ref = await window.firebaseDb.collection('rooms').add(data);
                    console.log('✅ Created new room', ref.id, 'with address:', apartmentAddress);
                    roomChanges.added.push({ roomNumber: data.roomNumber, floor: data.floor });
                }
            } catch (e) {
                console.warn('❌ Failed to save room:', e);
            }
        }
        
        return roomChanges;
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

            // Ensure modal exists in DOM; if not, inject a minimal modal markup so
            // the property details UI can render on any page.
            let modal = document.getElementById('propertyDetailsModal');
            if (!modal) {
                try {
                    const minimal = `
                    <div id="propertyDetailsModal" class="modal-overlay" style="display:none;">
                        <div class="modal-content modal-large property-details-modal">
                            <div class="modal-header property-details-header">
                                <div class="property-header-info">
                                    <h3 id="propertyDetailsName">Property Details</h3>
                                    <p id="propertyDetailsAddress" class="property-details-address"></p>
                                </div>
                                <button class="modal-close" id="propertyDetailsClose">&times;</button>
                            </div>
                            <div class="modal-body property-details-body">
                                <div id="propertyDetailsLoading" class="property-details-loading">
                                    <i class="fas fa-spinner fa-spin"></i> Loading property details...
                                </div>
                                <div id="propertyDetailsContent" style="display:none;">
                                    <div class="property-metrics">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                                            <div class="metric"><div class="metric-label">Units</div><div class="metric-value" id="detailsMetricUnits">-</div></div>
                                            <div class="metric"><div class="metric-label">Occupancy</div><div class="metric-value" id="detailsMetricOccupancy">-</div></div>
                                            <div class="metric"><div class="metric-label">Expected Rent</div><div class="metric-value" id="detailsMetricExpectedRent">-</div></div>
                                        </div>
                                    </div>
                                    <div class="property-info-grid" style="margin-top: 20px;">
                                        <div class="info-group" id="groupPropertyName"><label>Name</label><span id="detailsPropertyName">-</span></div>
                                        <div class="info-group" id="groupPropertyAddress"><label>Address</label><span id="detailsPropertyAddress">-</span></div>
                                        <div class="info-group" id="groupPropertyCreated"><label>Created</label><span id="detailsPropertyCreated">-</span></div>
                                        <div class="info-group" id="groupPropertyUpdated"><label>Updated</label><span id="detailsPropertyUpdated">-</span></div>
                                    </div>
                                    <div class="property-tabs" style="margin-top: 20px;">
                                        <button class="tab-button active" data-tab="overview"><i class="fas fa-info-circle"></i> Overview</button>
                                        <button class="tab-button" data-tab="units"><i class="fas fa-door-open"></i> Units</button>
                                        <button class="tab-button" data-tab="maintenance"><i class="fas fa-wrench"></i> Maintenance</button>
                                        <button class="tab-button" data-tab="tenants"><i class="fas fa-users"></i> Tenants</button>
                                    </div>
                                    <div class="property-tab-content" style="margin-top: 15px;">
                                        <div id="tab-overview" class="tab-pane active"></div>
                                        <div id="tab-units" class="tab-pane"><div id="unitsList"></div></div>
                                        <div id="tab-maintenance" class="tab-pane"><div id="maintenanceList"></div></div>
                                        <div id="tab-tenants" class="tab-pane"><div id="tenantsList"></div></div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer property-details-footer">
                                <button class="btn btn-secondary" onclick="if(window.propertiesController) window.propertiesController.closePropertyDetailsModal();">Close</button>
                                <button class="btn btn-primary" onclick="if(window.propertiesController && typeof window.propertiesController.editPropertyFromDetails==='function') window.propertiesController.editPropertyFromDetails();"><i class="fas fa-edit"></i> Edit Property</button>
                            </div>
                        </div>
                    </div>`;
                    const container = document.createElement('div');
                    container.innerHTML = minimal;
                    document.body.appendChild(container.firstElementChild);
                    modal = document.getElementById('propertyDetailsModal');
                    if (modal) {
                        // wire close button
                        const closeBtn = modal.querySelector('#propertyDetailsClose');
                        if (closeBtn) closeBtn.addEventListener('click', () => this.closePropertyDetailsModal());
                        console.log('✅ Property details modal injected successfully');
                    } else {
                        console.error('❌ Failed to inject property details modal');
                    }
                } catch (injErr) {
                    console.warn('❌ Could not inject property details modal:', injErr);
                }
            }

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

            // locate modal elements - verify modal is properly set up
            modal = document.getElementById('propertyDetailsModal');
            if (!modal) {
                console.error('❌ Property details modal not found in DOM after injection');
                window.showPropertiesError && window.showPropertiesError('Unable to display property details');
                return;
            }
            
            // Verify critical modal elements exist
            const content = modal.querySelector('#propertyDetailsContent');
            const loading = modal.querySelector('#propertyDetailsLoading');
            if (!content || !loading) {
                console.error('❌ Critical modal elements missing:', { content: !!content, loading: !!loading });
                return;
            }
            
            // store id so other helpers can access it (edit, etc.)
            modal.dataset.propertyId = propertyId;

            // Reset tab UI so every open starts on Overview (fresh state)
            console.log('🔄 Resetting property details modal tabs to Overview');
            try {
                const tabButtons = modal.querySelectorAll('.property-tabs .tab-button');
                const tabPanes = modal.querySelectorAll('.property-tab-content .tab-pane');
                
                if (tabButtons.length === 0) {
                    console.warn('⚠️ No tab buttons found in modal - tab structure may be incomplete');
                } else {
                    tabButtons.forEach(b => b.classList.remove('active'));
                    tabPanes.forEach(p => p.style.display = 'none');
                    const overviewBtn = modal.querySelector('.property-tabs .tab-button[data-tab="overview"]');
                    if (overviewBtn) overviewBtn.classList.add('active');
                    const overviewPane = modal.querySelector('#tab-overview');
                    if (overviewPane) overviewPane.style.display = 'block';
                    console.log('✅ Tabs reset successfully');
                }
            } catch (tabErr) {
                console.warn('⚠️ Error resetting tabs:', tabErr);
            }

            // reset tab content placeholders
            try {
                const unitsList = modal.querySelector('#unitsList');
                if (unitsList) unitsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading units...</p>';
                const maintenanceList = modal.querySelector('#maintenanceList');
                if (maintenanceList) maintenanceList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading maintenance requests...</p>';
                const tenantsList = modal.querySelector('#tenantsList');
                if (tenantsList) tenantsList.innerHTML = '<p style="text-align: center; color: #9ca3af;">Loading tenants...</p>';
            } catch (placeholderErr) {
                console.warn('⚠️ Error setting placeholder text:', placeholderErr);
            }

            // reset/loading state
            if (content) content.style.display = 'none';
            if (loading) loading.style.display = 'flex';
            modal.style.display = 'flex';

            // header info - ensure elements exist and use modal scoping
            const nameEl = modal.querySelector('#propertyDetailsName');
            const addressEl = modal.querySelector('#propertyDetailsAddress');
            if (!nameEl || !addressEl) {
                console.warn('❌ Property details modal elements missing (nameEl or addressEl)');
                if (loading) loading.style.display = 'none';
                if (content) content.style.display = 'block';
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

            // Populate info elements using modal scoping
            const infoNameEl = modal.querySelector('#detailsPropertyName');
            const infoNameGroup = modal.querySelector('#groupPropertyName');
            if (infoNameEl && displayName) {
                infoNameEl.textContent = displayName;
            } else if (infoNameGroup) {
                infoNameGroup.style.display = 'none';
            }

            const infoAddressEl = modal.querySelector('#detailsPropertyAddress');
            const infoAddressGroup = modal.querySelector('#groupPropertyAddress');
            if (infoAddressEl && displayAddress) {
                infoAddressEl.textContent = displayAddress;
            } else if (infoAddressGroup) {
                infoAddressGroup.style.display = 'none';
            }

            // created/updated timestamps
            const createdEl = modal.querySelector('#detailsPropertyCreated');
            const updatedEl = modal.querySelector('#detailsPropertyUpdated');
            if (createdEl) {
                createdEl.textContent = createdAtValue ? this.formatDate(createdAtValue) : '-';
            }
            if (updatedEl) {
                updatedEl.textContent = updatedAtValue ? this.formatDate(updatedAtValue) : '-';
            }

            // Populate stories metric
            const storiesMetricEl = modal.querySelector('#detailsMetricStories');
            if (storiesMetricEl) {
                const storiesValue = property.numberOfFloors != null ? property.numberOfFloors : (property.numberOfStories != null ? property.numberOfStories : '-');
                storiesMetricEl.textContent = storiesValue;
            }

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

            // Total units and metrics using modal scoping
            const totalUnits = property.numberOfRooms != null ? property.numberOfRooms : (property.totalUnits != null ? property.totalUnits : (units || []).length);
            const unitsEl = modal.querySelector('#detailsMetricUnits');
            if (unitsEl) unitsEl.textContent = totalUnits;

            const occupancyRateFinal = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
            const occupancyEl = modal.querySelector('#detailsMetricOccupancy');
            if (occupancyEl) occupancyEl.textContent = `${occupancyRateFinal}%`;

            // Expected rent using modal scoping
            let expectedRent = propertyLeases.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
            if (!expectedRent && units && units.length) {
                expectedRent = units.reduce((sum, u) => sum + (u.monthlyRent || u.rent || 0), 0);
            }
            const expectedEl = modal.querySelector('#detailsMetricExpectedRent');
            if (expectedEl) expectedEl.textContent = `₱${(expectedRent || 0).toLocaleString()}`;

            // Actual rent using modal scoping
            const actualEl = modal.querySelector('#detailsMetricActualRent');
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
            const maintenanceMetricEl = modal.querySelector('#detailsMetricMaintenance');
            if (maintenanceMetricEl) {
                maintenanceMetricEl.textContent = openMaintenance;
            }

            // overview tab - using modal scoping
            const addressStr = property.apartmentAddress || property.address || property.propertyAddress || property.location || '';
            const fullAddressEl = modal.querySelector('#detailsFullAddress');
            if (fullAddressEl) {
                fullAddressEl.textContent = addressStr;
            }
            const descEl = modal.querySelector('#detailsDescription');
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
            const amenitiesEl = modal.querySelector('#detailsAmenities');
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
            // pass the full property object and modal so tab population can match by name/address
            if (modal) {
                await this._populatePropertyDetailsTabs(modal, propertyId, units, maintenanceRequests, property);

                // tab switching helper
                this._setupPropertyDetailsTabs(modal);

                // show content
                if (loading) loading.style.display = 'none';
                if (content) content.style.display = 'block';

                console.log('✅ Modal rendered successfully');
            } else {
                console.error('❌ Modal reference lost before populating tabs');
            }
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
            let units = [];
            // 1) Prefer service helper when available
            if (this.service && typeof this.service.getPropertyUnits === 'function') {
                units = await this.service.getPropertyUnits(propertyId) || [];
            }

            // 2) Try the 'units' collection directly (newer schema)
            if ((!units || units.length === 0) && window.firebaseDb) {
                let snap = await window.firebaseDb.collection('units').where('propertyId', '==', propertyId).get();
                if (snap.empty) {
                    snap = await window.firebaseDb.collection('units').where('apartmentId', '==', propertyId).get();
                }
                if (!snap.empty) units = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // 3) Fallback: some installations store rooms in a 'rooms' collection
            if ((!units || units.length === 0) && window.firebaseDb) {
                console.debug('populateRoomDetails: attempting rooms fallback for propertyId=', propertyId, 'editingProperty=', this._editingProperty);
                // try by apartmentId/propertyId first
                let roomSnap = await window.firebaseDb.collection('rooms').where('apartmentId', '==', propertyId).get();
                console.debug('rooms.apartmentId query returned', roomSnap.size, 'docs');
                if (roomSnap.empty) {
                    roomSnap = await window.firebaseDb.collection('rooms').where('propertyId', '==', propertyId).get();
                    console.debug('rooms.propertyId query returned', roomSnap.size);
                }
                
                // 4) As a last resort, try matching by apartmentName or apartmentAddress from the editing context
                if (roomSnap.empty && this._editingProperty) {
                    const name = this._editingProperty.apartmentName || this._editingProperty.name || this._editingProperty.propertyName || '';
                    const addr = this._editingProperty.apartmentAddress || this._editingProperty.address || this._editingProperty.propertyAddress || '';
                    if (name) {
                        const byName = await window.firebaseDb.collection('rooms').where('apartmentName', '==', name).get();
                        console.debug('rooms.apartmentName query returned', byName.size, 'docs for name=', name);
                        if (!byName.empty) roomSnap = byName;
                    }
                    if (roomSnap.empty && addr) {
                        const byAddr = await window.firebaseDb.collection('rooms').where('apartmentAddress', '==', addr).get();
                        console.debug('rooms.apartmentAddress query returned', byAddr.size, 'docs for addr=', addr);
                        if (!byAddr.empty) roomSnap = byAddr;
                    }
                }

                // Additional helpful query: landlordId + apartmentAddress (covers some legacy imports)
                if (roomSnap.empty && this._editingProperty && (this._editingProperty.landlordId || this.currentUser?.uid)) {
                    const landlordId = this._editingProperty.landlordId || this.currentUser?.uid;
                    const addr = this._editingProperty.apartmentAddress || this._editingProperty.address || '';
                    if (landlordId && addr) {
                        const byLandlordAndAddr = await window.firebaseDb.collection('rooms')
                            .where('landlordId', '==', landlordId)
                            .where('apartmentAddress', '==', addr)
                            .get();
                        console.debug('rooms.landlordId+apartmentAddress query returned', byLandlordAndAddr.size);
                        if (!byLandlordAndAddr.empty) roomSnap = byLandlordAndAddr;
                    }
                }

                if (roomSnap && !roomSnap.empty) {
                    // normalize room docs to the unit shape expected by the form
                    units = roomSnap.docs.map(d => {
                        const r = d.data();
                        return {
                            id: d.id,
                            roomNumber: r.roomNumber || r.unitNumber || r.name || '',
                            floor: r.floor || (r.floorNumber ? String(r.floorNumber) : ''),
                            monthlyRent: r.monthlyRent || r.monthly_rate || r.rent || 0,
                            securityDeposit: r.securityDeposit || r.security_deposit || r.deposit || 0,
                            numberOfBedrooms: r.numberOfBedrooms || r.bedrooms || 0,
                            numberOfBathrooms: r.numberOfBathrooms || r.bathrooms || 0,
                            maxMembers: r.maxMembers || r.numberOfMembers || 1,
                            propertyId: r.propertyId || r.apartmentId || propertyId,
                            isAvailable: r.isAvailable !== undefined ? r.isAvailable : (r.status ? r.status !== 'occupied' : true),
                            // preserve original fields for debugging if needed
                            __raw: r
                        };
                    });
                }
            }
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
            landlordId: property.landlordId || this.currentUser?.uid || this.currentUser?.id || '',
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
                    <button type="button" class="btn btn-secondary" onclick="window.ModalManager.closeModal(this.closest('.modal-overlay'))">Cancel</button>
                    <button type="button" class="btn btn-primary" id="editNextBtn">Next: Room Details</button>
                </div>
            </div>
        `;

        const modal = window.ModalManager.openModal(buildStep1(), {
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
            
            const activeRoomCount = typeof this._currentStep2RoomCount === 'number' ? this._currentStep2RoomCount : (this._actualCurrentRoomCount || 0);
            const activeMaxFloor = typeof this._currentMaxRoomFloor === 'number' ? this._currentMaxRoomFloor : (this._actualMaxRoomFloor || 0);
            const minRooms = Math.max(activeRoomCount, 1);
            const minFloors = Math.max(activeMaxFloor, 1);
            
            const editPropertyRoomsField = modal.querySelector('#editPropertyRooms');
            const roomsErrorElement = document.createElement('p');
            roomsErrorElement.id = 'editPropertyRoomsError';
            roomsErrorElement.style.color = 'red';
            roomsErrorElement.style.fontSize = '12px';
            roomsErrorElement.style.marginTop = '3px';
            roomsErrorElement.style.display = 'none';
            editPropertyRoomsField.parentElement.appendChild(roomsErrorElement);
            
            const editPropertyFloorsField = modal.querySelector('#editPropertyFloors');
            const floorsErrorElement = document.createElement('p');
            floorsErrorElement.id = 'editPropertyFloorsError';
            floorsErrorElement.style.color = 'red';
            floorsErrorElement.style.fontSize = '12px';
            floorsErrorElement.style.marginTop = '3px';
            floorsErrorElement.style.display = 'none';
            editPropertyFloorsField.parentElement.appendChild(floorsErrorElement);
            
            if (editPropertyRoomsField) {
                editPropertyRoomsField.setAttribute('min', minRooms);
                const validateRoomCount = () => {
                    const roomsValue = parseInt(editPropertyRoomsField.value, 10) || 0;
                    if (roomsValue < minRooms) {
                        editPropertyRoomsField.value = minRooms;
                        this._editPropertyData.numberOfRooms = minRooms;
                        editPropertyRoomsField.style.borderColor = 'red';
                        editPropertyRoomsField.style.backgroundColor = '#ffe6e6';
                        roomsErrorElement.textContent = `Number of Rooms cannot be less than the current number of rooms in Step 2 (${minRooms}). Delete rooms in Step 2 first.`;
                        roomsErrorElement.style.display = 'block';
                    } else {
                        editPropertyRoomsField.style.borderColor = '';
                        editPropertyRoomsField.style.backgroundColor = '';
                        roomsErrorElement.style.display = 'none';
                        this._editPropertyData.numberOfRooms = roomsValue;
                    }
                };
                editPropertyRoomsField.addEventListener('input', validateRoomCount);
                editPropertyRoomsField.addEventListener('change', validateRoomCount);
                editPropertyRoomsField.addEventListener('blur', validateRoomCount);
            }
            
            if (editPropertyFloorsField) {
                editPropertyFloorsField.setAttribute('min', minFloors);
                const validateFloorCount = () => {
                    const floorsValue = parseInt(editPropertyFloorsField.value, 10) || 0;
                    if (floorsValue < minFloors) {
                        editPropertyFloorsField.value = minFloors;
                        this._editPropertyData.numberOfFloors = minFloors;
                        editPropertyFloorsField.style.borderColor = 'red';
                        editPropertyFloorsField.style.backgroundColor = '#ffe6e6';
                        floorsErrorElement.textContent = `Number of Floors cannot be less than the highest existing occupied floor (${minFloors}). Delete or move those units first.`;
                        floorsErrorElement.style.display = 'block';
                    } else {
                        editPropertyFloorsField.style.borderColor = '';
                        editPropertyFloorsField.style.backgroundColor = '';
                        floorsErrorElement.style.display = 'none';
                        this._editPropertyData.numberOfFloors = floorsValue;
                    }
                };
                editPropertyFloorsField.addEventListener('input', validateFloorCount);
                editPropertyFloorsField.addEventListener('change', validateFloorCount);
                editPropertyFloorsField.addEventListener('blur', validateFloorCount);
            }
            
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
                    const activeRoomCount = typeof this._currentStep2RoomCount === 'number' ? this._currentStep2RoomCount : (this._actualCurrentRoomCount || 0);
                    const activeMaxFloor = typeof this._currentMaxRoomFloor === 'number' ? this._currentMaxRoomFloor : (this._actualMaxRoomFloor || 0);
                    const minRooms = Math.max(activeRoomCount, 0);
                    const minFloors = Math.max(activeMaxFloor, 1);

                    if (rooms < minRooms) {
                        const msg = `Number of Rooms cannot be less than the current number of rooms in Step 2 (${minRooms}). Delete rooms in Step 2 first.`;
                        if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                            window.notificationManager.error(msg);
                        } else {
                            alert(msg);
                        }
                        return;
                    }

                    if (floors < minFloors) {
                        const msg = `Number of Floors cannot be less than the highest occupied floor (${minFloors}). Delete or move those units first.`;
                        if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                            window.notificationManager.error(msg);
                        } else {
                            alert(msg);
                        }
                        return;
                    }

                    if (!name || !addr || rooms < 1 || floors < 1) {
                        const msg = 'Please fill in all required fields (Name, Address, Rooms, Floors)';
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
                    const newData = { 
                        landlordId: this._editPropertyData.landlordId, 
                        name, 
                        address: addr, 
                        description: desc, 
                        numberOfRooms: rooms, 
                        numberOfFloors: floors, 
                        status 
                    };
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

        const showStep2 = async () => {
            console.log('showStep2 invoked for property', property.id, 'with data', this._editPropertyData);
            const step2HTML = `
                <div class="edit-property-step2">
                    <h5 style="margin-bottom:25px; color: var(--royal-blue);">Step 2: Room Details</h5>
                    <div id="editRoomContainer" style="max-height:400px; overflow-y:auto; margin-bottom:20px;">
                        <p>Loading units...</p>
                    </div>
                    <div style="margin-top:10px;">
                        <button type="button" class="btn btn-sm btn-secondary" id="addRoomBtn">+ Add Room</button>
                        <p id="roomLimitMessage" style="color: red; display: none; margin-top: 5px;"></p>
                    </div>
                    <div style="margin-top:20px;">
                        <p id="requiredFieldsMessage" style="color: red; display: none; margin-bottom: 10px; font-weight: bold;">Please fill out all required fields in all rooms.</p>
                    </div>
                    <div style="margin-top:25px; display:flex; gap:10px; justify-content:flex-end;">
                        <button type="button" class="btn btn-secondary" id="backToStep1Btn">Back</button>
                        <button type="button" class="btn btn-primary" id="savePropertyBtn" disabled>Update Property & Rooms</button>
                    </div>
                </div>
            `;
            modal.querySelector('.modal-body').innerHTML = step2HTML;

            // helper to validate all required fields in all rooms
            const validateAllRequiredFields = () => {
                const container = modal.querySelector('#editRoomContainer');
                const roomForms = container.querySelectorAll('.room-form');
                const saveBtn = modal.querySelector('#savePropertyBtn');
                const messageEl = modal.querySelector('#requiredFieldsMessage');
                const requiredFieldClasses = ['room-number', 'room-floor', 'room-bedrooms', 'room-bathrooms', 'room-maxmembers'];
                const fieldsGreaterThanZero = ['room-rent', 'room-deposit', 'room-bedrooms', 'room-bathrooms'];
                let isValid = true;

                roomForms.forEach(form => {
                    // Check required fields (must not be empty)
                    requiredFieldClasses.forEach(fieldClass => {
                        const field = form.querySelector(`.${fieldClass}`);
                        if (field) {
                            const value = field.value.trim();
                            if (!value || (fieldClass.includes('number') && parseInt(value, 10) <= 0)) {
                                field.style.borderColor = 'red';
                                field.style.backgroundColor = '#ffe6e6';
                                isValid = false;
                            } else {
                                field.style.borderColor = '';
                                field.style.backgroundColor = '';
                            }
                        }
                    });
                    
                    // Check fields that must be greater than 0
                    fieldsGreaterThanZero.forEach(fieldClass => {
                        const field = form.querySelector(`.${fieldClass}`);
                        if (field) {
                            const value = parseFloat(field.value) || 0;
                            if (value <= 0) {
                                field.style.borderColor = 'red';
                                field.style.backgroundColor = '#ffe6e6';
                                isValid = false;
                            } else {
                                field.style.borderColor = '';
                                field.style.backgroundColor = '';
                            }
                        }
                    });
                });

                if (isValid) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    messageEl.style.display = 'none';
                } else {
                    saveBtn.disabled = true;
                    saveBtn.style.opacity = '0.5';
                    messageEl.style.display = 'block';
                }
            };

            // helper to sync Step 1 numberOfRooms with current room count in Step 2
            const updateAddRoomButton = () => {
                const container = modal.querySelector('#editRoomContainer');
                const roomForms = container.querySelectorAll('.room-form');
                const currentRoomCount = roomForms.length;
                const addRoomBtn = modal.querySelector('#addRoomBtn');
                const messageEl = modal.querySelector('#roomLimitMessage');

                // ✅ Auto-adjust numberOfRooms to match current room count (added or deleted)
                this._editPropertyData.numberOfRooms = currentRoomCount;
                this._currentStep2RoomCount = currentRoomCount;

                // Determine the highest floor among current rooms in Step 2
                const currentFloorValues = Array.from(roomForms)
                    .map(form => parseInt(form.querySelector('.room-floor')?.value, 10) || 0)
                    .filter(v => v > 0);
                const currentMaxFloor = currentFloorValues.length ? Math.max(...currentFloorValues) : 0;
                this._currentMaxRoomFloor = currentMaxFloor;

                // Also update Step 1 field if it exists
                const editPropertyRoomsField = modal.querySelector('#editPropertyRooms');
                if (editPropertyRoomsField) {
                    editPropertyRoomsField.value = currentRoomCount;
                    editPropertyRoomsField.setAttribute('min', currentRoomCount);
                }

                const editPropertyFloorsField = modal.querySelector('#editPropertyFloors');
                if (editPropertyFloorsField) {
                    editPropertyFloorsField.setAttribute('min', Math.max(currentMaxFloor, 1));
                }

                // Always keep Add Room button enabled
                addRoomBtn.disabled = false;
                addRoomBtn.style.opacity = '1';
                messageEl.style.display = 'none';
            };

            // populate rooms from database
            await this.populateRoomDetails(property.id, modal.querySelector('#editRoomContainer'), updateAddRoomButton);
            updateAddRoomButton();

            // helper to get all existing room numbers
            const getExistingRoomNumbers = () => {
                const container = modal.querySelector('#editRoomContainer');
                const roomForms = container.querySelectorAll('.room-form');
                return Array.from(roomForms).map(form => ({
                    number: form.querySelector('.room-number')?.value.trim() || '',
                    unitId: form.getAttribute('data-unit-id') || ''
                })).filter(r => r.number); // only include non-empty room numbers
            };

            // attach validation listeners to newly added room
            const attachValidationToRoom = (form) => {
                const requiredFieldClasses = ['room-number', 'room-floor', 'room-bedrooms', 'room-bathrooms', 'room-maxmembers'];
                requiredFieldClasses.forEach(fieldClass => {
                    const field = form.querySelector(`.${fieldClass}`);
                    if (field) {
                        field.addEventListener('input', validateAllRequiredFields);
                        field.addEventListener('change', validateAllRequiredFields);
                        field.addEventListener('blur', validateAllRequiredFields);
                    }
                });
            };

            // allow adding blank form
            const addRoomBtn = modal.querySelector('#addRoomBtn');
            if (addRoomBtn) {
                addRoomBtn.addEventListener('click', () => {
                    const container = modal.querySelector('#editRoomContainer');
                    if (container) {
                        container.insertAdjacentHTML('beforeend', this._roomFormHTML());
                        const newForm = container.lastElementChild;
                        const existingRoomNumbers = getExistingRoomNumbers();
                        this._attachRoomFormListeners(newForm, updateAddRoomButton, existingRoomNumbers);
                        attachValidationToRoom(newForm); // attach validation to new room
                        updateAddRoomButton(); // update after adding
                        validateAllRequiredFields(); // validate all fields
                        // Focus on the room number field of the newly added room
                        const roomNumberInput = newForm.querySelector('.room-number');
                        if (roomNumberInput) {
                            roomNumberInput.focus();
                        }
                    }
                });
            }

            // back button
            modal.querySelector('#backToStep1Btn').addEventListener('click', () => {
                showStep1();
            });

            // save button
            modal.querySelector('#savePropertyBtn').addEventListener('click', async () => {
                // validate before saving
                validateAllRequiredFields();
                const btn = modal.querySelector('#savePropertyBtn');
                if (btn.disabled) {
                    return; // don't save if validation fails
                }
                btn.disabled = true;
                try {
                    // updateProperty already handles room saving, activity logging, and modal closing
                    await this.updateProperty(property.id, this._editPropertyData);
                } catch (err) {
                    console.error('Error saving edits:', err);
                    if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                        window.notificationManager.error('Failed to update property/rooms');
                    }
                    btn.disabled = false;
                }
            });

            // update button after populate (need to wait for populate to finish)
            setTimeout(() => {
                updateAddRoomButton();
                // attach validation listeners to existing rooms
                const container = modal.querySelector('#editRoomContainer');
                const roomForms = container.querySelectorAll('.room-form');
                roomForms.forEach(form => attachValidationToRoom(form));
                validateAllRequiredFields(); // initial validation check
            }, 100);
        };

        // start on step 1
        // First, load the actual current room count from database
        (async () => {
            try {
                const roomsSnapshot = await firebaseDb.collection('rooms')
                    .where('apartmentId', '==', property.id)
                    .get();
                this._actualCurrentRoomCount = roomsSnapshot.size;
                this._actualMaxRoomFloor = 0;
                roomsSnapshot.forEach(doc => {
                    const roomData = doc.data();
                    const floorValue = parseInt(roomData.floor, 10);
                    if (!Number.isNaN(floorValue) && floorValue > (this._actualMaxRoomFloor || 0)) {
                        this._actualMaxRoomFloor = floorValue;
                    }
                });
                console.log(`✅ Loaded ${this._actualCurrentRoomCount} actual rooms and max floor ${this._actualMaxRoomFloor} for property ${property.id}`);
            } catch (err) {
                console.warn('⚠️ Failed to fetch actual room count:', err);
                this._actualCurrentRoomCount = 0;
                this._actualMaxRoomFloor = 0;
            }
            showStep1();
        })();
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

            if (window.ModalManager) {
                window.ModalManager.closeModal('addProperty');
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
                const errorMsg = errors.length > 0 ? errors.join(', ') : 'Property validation failed';
                throw new Error(errorMsg);
            }

            // Get the original property data BEFORE updating (for change tracking)
            let originalData = null;
            try {
                const originalDoc = await this.service.firebaseService.read('apartments', propertyId);
                if (originalDoc && originalDoc.exists) {
                    originalData = originalDoc.data();
                }
            } catch (err) {
                console.warn('⚠️ Could not fetch original property data for change tracking:', err);
            }

            await this.service.updateProperty(propertyId, propertyData);
            
            // CASCADE UPDATE: Update all related documents when apartment is edited
            try {
                await this.cascadeUpdateRelatedDocuments(propertyId, originalData, propertyData);
            } catch (cascadeErr) {
                console.warn('⚠️ Cascade update warning:', cascadeErr);
                // Don't fail the entire update if cascade fails
            }
            
            // reload the list so cards reflect changes
            await this.loadProperties();

            if (window.notificationManager) {
                window.notificationManager.success('Property updated successfully');
            }

            // Show push notification for property edit
            if (window.NotificationManager && typeof window.NotificationManager.notifyPropertyEdited === 'function') {
                try {
                    window.NotificationManager.notifyPropertyEdited(propertyData, changes);
                    console.log('✅ Push notification sent for property edit');
                } catch (notifyErr) {
                    console.warn('⚠️ Failed to send push notification for property edit:', notifyErr);
                }
            }

            // save room changes as well
            const roomChanges = await this._saveRoomDetails();

            // Log activity for property edit
            try {
                const landlordId = propertyData.landlordId || this.currentUser?.uid || this.currentUser?.id;
                const propertyName = propertyData.name || 'Unknown Property';
                
                // Track what changed - handle both field name variants
                const changes = {};
                if (originalData) {
                    const fieldMappings = [
                        { fields: ['name', 'apartmentName'], displayName: 'name' },
                        { fields: ['address', 'apartmentAddress'], displayName: 'address' },
                        { fields: ['description'], displayName: 'description' },
                        { fields: ['numberOfRooms', 'totalUnits'], displayName: 'numberOfRooms' },
                        { fields: ['numberOfFloors'], displayName: 'numberOfFloors' },
                        { fields: ['status', 'isActive'], displayName: 'status' }
                    ];
                    
                    fieldMappings.forEach(({ fields, displayName }) => {
                        // Get original value (check all possible field names)
                        let originalValue = null;
                        for (const field of fields) {
                            if (originalData[field] != null) {
                                originalValue = originalData[field];
                                break;
                            }
                        }
                        
                        // Get new value (check all possible field names)
                        let newValue = null;
                        for (const field of fields) {
                            if (propertyData[field] != null) {
                                newValue = propertyData[field];
                                break;
                            }
                        }
                        
                        // Special handling for status/isActive conversion
                        if (displayName === 'status') {
                            if (originalData.isActive != null && originalData.status == null) {
                                originalValue = originalData.isActive ? 'active' : 'inactive';
                            }
                            if (propertyData.isActive != null && propertyData.status == null) {
                                newValue = propertyData.isActive ? 'active' : 'inactive';
                            }
                        }
                        
                        // More robust comparison that handles type differences
                        const hasChanged = originalValue !== newValue && 
                                         !(originalValue == null && newValue == null) &&
                                         !(originalValue === '' && newValue == null) &&
                                         !(originalValue == null && newValue === '');
                        
                        if (hasChanged) {
                            changes[displayName] = {
                                from: originalValue != null ? String(originalValue) : 'Not set',
                                to: newValue != null ? String(newValue) : 'Not set'
                            };
                        }
                    });
                }
                
                // ADD ROOM CHANGES TO THE CHANGES SUMMARY
                if (roomChanges && roomChanges.added && roomChanges.added.length > 0) {
                    const addedRoomsDetails = roomChanges.added.map(r => `${r.roomNumber} (Floor ${r.floor})`).join(', ');
                    changes.roomsAdded = {
                        from: '(none)',
                        to: addedRoomsDetails
                    };
                }
                if (roomChanges && roomChanges.modified && roomChanges.modified.length > 0) {
                    const modifiedRoomsDetails = roomChanges.modified.map(r => `${r.roomNumber} (Floor ${r.floor})`).join(', ');
                    changes.roomsModified = {
                        from: '(previous)',
                        to: modifiedRoomsDetails
                    };
                }
                if (roomChanges && roomChanges.deleted && roomChanges.deleted > 0) {
                    changes.roomsDeleted = {
                        from: roomChanges.deleted + ' room(s)',
                        to: '(deleted)'
                    };
                }

                const activityData = {
                    landlordId: landlordId,
                    type: 'property_edited',
                    title: 'Property Edited',
                    message: `Apartment "${propertyName}" has been updated`,
                    apartmentId: propertyId, // Use apartmentId for consistency
                    propertyId: propertyId,
                    data: {
                        // Include comprehensive property details in activity data for modal display
                        name: propertyData.name || 'Unknown Property',
                        address: propertyData.address || 'Unknown Address',
                        numberOfRooms: propertyData.numberOfRooms || 0,
                        numberOfUnits: propertyData.numberOfRooms || propertyData.numberOfUnits || 0,
                        landlordName: propertyData.landlordName || this.currentUser?.displayName || this.currentUser?.email || 'Landlord',
                        ownerName: propertyData.landlordName || this.currentUser?.displayName || this.currentUser?.email || 'Landlord',
                        status: propertyData.status || 'active', // Ensure status is always set
                        updatedAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        // Add change summary
                        changes: changes,
                        hasChanges: Object.keys(changes).length > 0,
                        // Add additional fallback fields
                        propertyName: propertyData.name || 'Unknown Property',
                        location: propertyData.address || 'Unknown Address',
                        apartmentAddress: propertyData.address || 'Unknown Address',
                        apartmentId: propertyId,
                        propertyId: propertyId
                    },
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString(),
                    isSeen: 'unseen'
                };

                if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.addActivity === 'function') {
                    await window.DataManager.addActivity(activityData);
                    console.log('✅ Activity created for property edit');
                } else if (typeof window.firebaseDb !== 'undefined') {
                    await window.firebaseDb.collection('activities').add(activityData);
                    console.log('✅ Activity created for property edit (direct Firestore)');
                }
            } catch (actErr) {
                console.warn('⚠️ Failed to log activity for property edit:', actErr);
            }

            // Close ALL modals after successful update
            try {
                window.ModalManager.closeAllModals();
            } catch (modalErr) {
                console.warn('⚠️ Failed to close modals after property update:', modalErr);
            }

            // do not automatically close modal; user can close manually
        } catch (error) {
            console.error('Error updating property:', error);
            console.error('Property data being updated:', propertyData);
            const errorMsg = error?.message || 'Failed to update property';
            window.showPropertiesError(errorMsg);
            // leave modal open so user can try again
        } finally {
            window.setPropertiesLoading(false);
        }
    }

    /**
     * Cascade update related documents when apartment is edited
     * Updates rooms, leases, and other documents that reference this apartment
     */
    async cascadeUpdateRelatedDocuments(propertyId, originalData, updatedData) {
        console.log('🔄 Cascading updates to related documents...');
        
        if (!propertyId) {
            console.warn('⚠️ No propertyId provided for cascade update');
            return;
        }

        const updates = {};
        
        // Track which fields changed
        const changedFields = {};
        
        // Check for address changes (name and address changes need to cascade)
        const oldAddress = originalData?.address || originalData?.apartmentAddress;
        const newAddress = updatedData.address || updatedData.apartmentAddress;
        
        const oldName = originalData?.name || originalData?.apartmentName;
        const newName = updatedData.name || updatedData.apartmentName;
        
        if (oldAddress && oldAddress !== newAddress) {
            updates.apartmentAddress = newAddress;
            updates.rentalAddress = newAddress;
            changedFields.address = true;
            console.log(`🏷️  Address changed: "${oldAddress}" → "${newAddress}"`);
        }
        
        if (oldName && oldName !== newName) {
            updates.apartmentName = newName;
            changedFields.name = true;
            console.log(`🏷️  Name changed: "${oldName}" → "${newName}"`);
        }

        // Only proceed with cascade if there are relevant changes
        if (Object.keys(updates).length === 0) {
            console.log('ℹ️ No cascade updates needed');
            return;
        }

        // Update all rooms that belong to this apartment
        try {
            console.log(`📝 Updating rooms for apartment ${propertyId}...`);
            const roomsSnapshot = await firebaseDb.collection('rooms')
                .where('apartmentId', '==', propertyId)
                .get();
            
            if (!roomsSnapshot.empty) {
                const batch = firebaseDb.batch();
                roomsSnapshot.docs.forEach(doc => {
                    batch.update(doc.ref, updates);
                });
                await batch.commit();
                console.log(`✅ Updated ${roomsSnapshot.size} rooms`);
            } else {
                console.log('ℹ️ No rooms found for this apartment');
            }
        } catch (err) {
            console.error('❌ Error updating rooms:', err);
        }

        // Update all leases that belong to this apartment
        try {
            console.log(`📝 Updating leases for apartment ${propertyId}...`);
            const leasesSnapshot = await firebaseDb.collection('leases')
                .where('propertyId', '==', propertyId)
                .get();
            
            if (!leasesSnapshot.empty) {
                const batch = firebaseDb.batch();
                leasesSnapshot.docs.forEach(doc => {
                    const updateObj = {};
                    if (changedFields.address) updateObj.propertyAddress = newAddress;
                    if (changedFields.name) updateObj.propertyName = newName;
                    batch.update(doc.ref, updateObj);
                });
                await batch.commit();
                console.log(`✅ Updated ${leasesSnapshot.size} leases`);
            } else {
                console.log('ℹ️ No leases found for this apartment');
            }
        } catch (err) {
            console.error('❌ Error updating leases:', err);
        }

        // Update tenant records that reference this apartment's address
        try {
            if (changedFields.address) {
                console.log(`📝 Updating tenant records with old address...`);
                const tenantsSnapshot = await firebaseDb.collection('tenants')
                    .where('rentalAddress', '==', oldAddress)
                    .get();
                
                if (!tenantsSnapshot.empty) {
                    const batch = firebaseDb.batch();
                    tenantsSnapshot.docs.forEach(doc => {
                        batch.update(doc.ref, {
                            rentalAddress: newAddress,
                            apartmentAddress: newAddress
                        });
                    });
                    await batch.commit();
                    console.log(`✅ Updated ${tenantsSnapshot.size} tenant records`);
                }
            }
        } catch (err) {
            console.error('❌ Error updating tenants:', err);
        }

        // Update activity log with apartment reference changes
        try {
            if (changedFields.address || changedFields.name) {
                const actUpdateObj = {};
                if (changedFields.address) {
                    actUpdateObj['data.address'] = newAddress;
                    actUpdateObj['data.apartmentAddress'] = newAddress;
                }
                if (changedFields.name) {
                    actUpdateObj['data.name'] = newName;
                    actUpdateObj['data.propertyName'] = newName;
                }
                
                console.log(`📝 Updating activity log...`);
                const activitiesSnapshot = await firebaseDb.collection('activities')
                    .where('apartmentId', '==', propertyId)
                    .get();
                
                if (!activitiesSnapshot.empty) {
                    const batch = firebaseDb.batch();
                    activitiesSnapshot.docs.forEach(doc => {
                        batch.update(doc.ref, { 'data': { ...doc.data().data, ...actUpdateObj } });
                    });
                    await batch.commit();
                    console.log(`✅ Updated ${activitiesSnapshot.size} activity records`);
                }
            }
        } catch (err) {
            console.warn('⚠️ Error updating activity log (non-critical):', err);
        }

        console.log('✅ Cascade update completed');
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
    async _populatePropertyDetailsTabs(modal, propertyId, units, maintenanceRequests, property) {
        // units tab
        const unitsList = modal.querySelector('#unitsList');
        if (unitsList) {
            if (!units || units.length === 0) {
                unitsList.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 40px 20px;">No units found</p>';
            } else {
                unitsList.innerHTML = `
                    <div class="units-grid">
                        ${units.map(unit => {
                            // Handle both unit and room formats
                            const unitName = unit.roomNumber || unit.unitNumber || unit.name || ('Unit ' + (unit.id?.substring(0, 5) || '?'));
                            // Determine occupancy - check multiple possible fields
                            const isOccupied = unit.isOccupied === true || unit.occupied === true || unit.status === 'occupied';
                            const occupancyStatus = isOccupied ? 'Occupied' : 'Vacant';
                            const badgeClass = isOccupied ? 'status-occupied' : 'status-vacant';
                            
                            // Get additional details if available
                            const monthlyRent = unit.monthlyRent || unit.rent || 0;
                            const deposit = unit.securityDeposit || unit.deposit || 0;
                            const bedrooms = unit.numberOfBedrooms || unit.bedrooms || 0;
                            const bathrooms = unit.numberOfBathrooms || unit.bathrooms || 0;
                            const floor = unit.floor || '-';
                            
                            return `
                                <div class="unit-card">
                                    <div class="unit-card-header">
                                        <div class="unit-card-title">${String(unitName).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</div>
                                        <span class="unit-status-badge ${badgeClass}">
                                            <i class="fas fa-${isOccupied ? 'check-circle' : 'circle'}"></i> ${occupancyStatus}
                                        </span>
                                    </div>
                                    <div class="unit-card-body">
                                        <div class="unit-detail">
                                            <span class="unit-detail-label"><i class="fas fa-layer-group"></i> Floor</span>
                                            <span class="unit-detail-value">${floor}</span>
                                        </div>
                                        <div class="unit-detail">
                                            <span class="unit-detail-label"><i class="fas fa-door-open"></i> Bedrooms</span>
                                            <span class="unit-detail-value">${bedrooms}</span>
                                        </div>
                                        <div class="unit-detail">
                                            <span class="unit-detail-label"><i class="fas fa-bath"></i> Bathrooms</span>
                                            <span class="unit-detail-value">${bathrooms}</span>
                                        </div>
                                    </div>
                                    <div class="unit-card-footer">
                                        <div class="unit-price-info">
                                            <div class="unit-price-item">
                                                <span class="price-label">Monthly Rent</span>
                                                <span class="price-value">₱${monthlyRent.toLocaleString('en-PH', {minimumFractionDigits: 0})}</span>
                                            </div>
                                            <div class="unit-price-item">
                                                <span class="price-label">Deposit</span>
                                                <span class="price-value">₱${deposit.toLocaleString('en-PH', {minimumFractionDigits: 0})}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
        }

        // maintenance tab
        const maintenanceList = modal.querySelector('#maintenanceList');
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

            const tenantsList = modal.querySelector('#tenantsList');
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
    }

    /**
     * Wire up tab buttons inside property details modal.
     */
    _setupPropertyDetailsTabs(modal) {
        if (!modal) {
            console.warn('⚠️ _setupPropertyDetailsTabs called without modal reference');
            return;
        }

        try {
            const tabButtons = modal.querySelectorAll('.property-tabs .tab-button');
            const tabPanes = modal.querySelectorAll('.property-tab-content .tab-pane');

            if (tabButtons.length === 0) {
                console.warn('⚠️ No tab buttons found - tabs may not be configured');
                return;
            }

            // Reset tab listeners for this specific modal to allow re-opening
            let hasExistingListeners = false;
            tabButtons.forEach(button => {
                // Check if listeners are already attached
                if (button.onclick !== null || button._tabListenerAttached) {
                    hasExistingListeners = true;
                }
            });

            if (hasExistingListeners) {
                console.log('ℹ️ Tab listeners already configured for this modal');
                return;
            }

            tabButtons.forEach(button => {
                button._tabListenerAttached = true;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tabName = button.getAttribute('data-tab');

                    tabButtons.forEach(b => b.classList.remove('active'));
                    tabPanes.forEach(p => p.style.display = 'none');

                    button.classList.add('active');
                    const pane = modal.querySelector(`#tab-${tabName}`);
                    if (pane) pane.style.display = 'block';
                });
            });
            console.log('✅ Tab listeners configured successfully');
        } catch (err) {
            console.error('❌ Error setting up property details tabs:', err);
        }
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
