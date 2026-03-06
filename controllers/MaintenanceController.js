/**
 * MaintenanceController
 * Handles all maintenance request interactions
 * Orchestrates between Maintenance views and DataService
 */

class MaintenanceController {
    constructor(dataService) {
        this.service = dataService;
        this.currentFilter = '';
        this.priorityFilter = '';
        this.statusFilter = '';
        this.allRequests = [];
        this.setupEventListeners();
    }

    /**
     * Initialize controller
     */
    async init() {
        try {
            window.setMaintenanceLoading(true);
            await this.loadRequests();
            await this.updateStats();
            window.hideMaintenanceError();
        } catch (error) {
            console.error('Error initializing maintenance:', error);
            window.showMaintenanceError('Failed to load maintenance requests');
        } finally {
            window.setMaintenanceLoading(false);
        }
    }

    /**
     * Load all maintenance requests from service
     */
    async loadRequests() {
        try {
            this.allRequests = await this.service.getMaintenanceRequests();
            console.log('MaintenanceController loaded requests', this.allRequests.map(r => ({ id: r.id, priority: r.priority, status: r.status })));
            this.displayFilteredRequests();
        } catch (error) {
            throw new Error(`Failed to load requests: ${error.message}`);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event listeners handled in views
    }

    /**
     * Search requests
     */
    searchRequests(query) {
        this.currentFilter = query.toLowerCase();
        this.displayFilteredRequests();
    }

    /**
     * Filter by priority
     */
    filterByPriority(priority) {
        this.priorityFilter = priority;
        this.displayFilteredRequests();
    }

    /**
     * Filter by status
     */
    filterByStatus(status) {
        this.statusFilter = status;
        this.displayFilteredRequests();
    }

    /**
     * Display filtered requests
     */
    displayFilteredRequests() {
        let filtered = this.allRequests;

        if (this.currentFilter) {
            filtered = filtered.filter(req =>
                req.title.toLowerCase().includes(this.currentFilter) ||
                req.description.toLowerCase().includes(this.currentFilter) ||
                req.propertyName.toLowerCase().includes(this.currentFilter)
            );
        }

        if (this.priorityFilter) {
            filtered = filtered.filter(req => req.priority === this.priorityFilter);
        }

        if (this.statusFilter) {
            filtered = filtered.filter(req => req.status === this.statusFilter);
        }

        // debug: show what will be rendered so we can verify priority/status values
        console.log('MaintenanceController filtered requests', filtered.map(r => ({ id: r.id, priority: r.priority, status: r.status })));

        window.displayMaintenanceRequests(filtered);
    }

    /**
     * Update maintenance statistics
     */
    async updateStats() {
        try {
            const stats = {
                total: this.allRequests.length,
                urgent: this.allRequests.filter(r => r.priority === 'urgent').length,
                inProgress: this.allRequests.filter(r => r.status === 'in-progress').length,
                closed: this.allRequests.filter(r => r.status === 'closed').length
            };
            window.updateMaintenanceStats(stats);
        } catch (error) {
            console.error('Error updating maintenance stats:', error);
        }
    }

    /**
     * View request details
     */
    viewRequest(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            window.location.hash = `#maintenance/${requestId}`;
            console.log('Navigating to request detail:', requestId);
        }
    }

    /**
     * Open create request modal
     */
    openCreateRequestModal() {
        console.log('Opening create maintenance request modal');
        if (window.modalManager) {
            window.modalManager.openModal('createMaintenanceRequest');
        }
    }

    /**
     * Open update status modal
     */
    openUpdateStatusModal(requestId) {
        const request = this.allRequests.find(r => r.id === requestId);
        if (request) {
            console.log('Opening update status modal for request:', requestId);
            if (window.modalManager) {
                window.modalManager.openModal('updateMaintenanceStatus', request);
            }
        }
    }

    /**
     * Create new maintenance request
     */
    async createRequest(requestData) {
        try {
            window.setMaintenanceLoading(true);
            window.hideMaintenanceError();

            const request = new MaintenanceRequest(requestData);
            if (!request.isValid()) {
                const errors = request.getValidationErrors();
                throw new Error(errors.join(', '));
            }

            await this.service.createMaintenanceRequest(requestData);
            await this.loadRequests();
            await this.updateStats();

            if (window.modalManager) {
                window.modalManager.closeModal('createMaintenanceRequest');
            }

            if (window.notificationManager) {
                window.notificationManager.success('Maintenance request created');
            }
        } catch (error) {
            console.error('Error creating request:', error);
            window.showMaintenanceError(error.message || 'Failed to create request');
        } finally {
            window.setMaintenanceLoading(false);
        }
    }

    /**
     * Update request status
     */
    async updateRequestStatus(requestId, newStatus, notes = '') {
        try {
            window.setMaintenanceLoading(true);
            window.hideMaintenanceError();

            await this.service.updateMaintenanceRequest(requestId, {
                status: newStatus,
                statusNotes: notes,
                lastUpdated: new Date()
            });

            await this.loadRequests();
            await this.updateStats();

            if (window.modalManager) {
                window.modalManager.closeModal('updateMaintenanceStatus');
            }

            if (window.notificationManager) {
                window.notificationManager.success('Request status updated');
            }
        } catch (error) {
            console.error('Error updating request:', error);
            window.showMaintenanceError(error.message || 'Failed to update request');
        } finally {
            window.setMaintenanceLoading(false);
        }
    }

    /**
     * Assign request to contractor
     */
    async assignRequest(requestId, contractorId) {
        try {
            window.setMaintenanceLoading(true);
            window.hideMaintenanceError();

            await this.service.updateMaintenanceRequest(requestId, {
                assignedTo: contractorId,
                status: 'in-progress',
                assignedDate: new Date()
            });

            await this.loadRequests();

            if (window.notificationManager) {
                window.notificationManager.success('Request assigned');
            }
        } catch (error) {
            console.error('Error assigning request:', error);
            window.showMaintenanceError(error.message || 'Failed to assign request');
        } finally {
            window.setMaintenanceLoading(false);
        }
    }

    /**
     * Close maintenance request
     */
    async closeRequest(requestId, completionNotes = '') {
        try {
            window.setMaintenanceLoading(true);
            window.hideMaintenanceError();

            await this.service.updateMaintenanceRequest(requestId, {
                status: 'closed',
                completionNotes: completionNotes,
                closedDate: new Date()
            });

            await this.loadRequests();
            await this.updateStats();

            if (window.notificationManager) {
                window.notificationManager.success('Request closed');
            }
        } catch (error) {
            console.error('Error closing request:', error);
            window.showMaintenanceError(error.message || 'Failed to close request');
        } finally {
            window.setMaintenanceLoading(false);
        }
    }

    /**
     * Get urgent requests
     */
    getUrgentRequests() {
        return this.allRequests.filter(r =>
            r.priority === 'urgent' && r.status !== 'closed'
        );
    }

    /**
     * Get open requests by property
     */
    getOpenRequestsByProperty(propertyId) {
        return this.allRequests.filter(r =>
            r.propertyId === propertyId && r.status !== 'closed'
        );
    }
}

// Initialize and expose to window
if (window.dataService) {
    window.maintenanceController = new MaintenanceController(window.dataService);
}
