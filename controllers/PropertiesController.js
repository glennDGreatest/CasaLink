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
        const property = this.allProperties.find(p => p.id === propertyId);
        if (property) {
            // Navigate to detail view
            window.location.hash = `#property/${propertyId}`;
            console.log('Navigating to property detail:', propertyId);
        }
    }

    /**
     * Open add property modal
     */
    openAddPropertyModal() {
        console.log('Opening add property modal');
        // Emit event or call modal manager
        if (window.modalManager) {
            window.modalManager.openModal('addProperty');
        }
    }

    /**
     * Open edit property modal
     */
    openEditPropertyModal(propertyId) {
        const property = this.allProperties.find(p => p.id === propertyId);
        if (property) {
            console.log('Opening edit modal for property:', propertyId);
            if (window.modalManager) {
                window.modalManager.openModal('editProperty', property);
            }
        }
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
            await this.loadProperties();

            if (window.modalManager) {
                window.modalManager.closeModal('editProperty');
            }

            if (window.notificationManager) {
                window.notificationManager.success('Property updated successfully');
            }
        } catch (error) {
            console.error('Error updating property:', error);
            window.showPropertiesError(error.message || 'Failed to update property');
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
