/**
 * DashboardController
 * Handles dashboard interactions and data aggregation
 * Orchestrates between Dashboard view and DataService
 */

class DashboardController {
    constructor(dataService) {
        this.service = dataService;
        this.currentUser = null;
        this.dashboardData = {};
        this.initialized = false;
        this.setupEventListeners();
    }

    /**
     * Wait for user to be authenticated before initializing
     */
    async waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (window.currentUser) {
                    this.currentUser = window.currentUser;
                    console.log('✅ DashboardController: User authenticated:', this.currentUser.email);
                    resolve();
                } else {
                    console.log('⏳ DashboardController: Waiting for auth...');
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    /**
     * Initialize controller with auth check
     */
    async init() {
        try {
            if (this.initialized) {
                console.log('✅ DashboardController already initialized');
                return;
            }

            console.log('🚀 DashboardController initializing...');
            
            // Wait for authentication
            await this.waitForAuth();
            
            // Update header
            if (window.updateDashboardHeader) {
                window.updateDashboardHeader(this.currentUser.name);
            }

            // Set loading states
            if (window.setDashboardLoading) {
                window.setDashboardLoading('properties', true);
                window.setDashboardLoading('activity', true);
                window.setDashboardLoading('maintenance', true);
                window.setDashboardLoading('leases', true);
            }

            // Load all dashboard data in parallel with error handling
            await Promise.all([
                this.loadStatistics(),
                this.loadRecentProperties(),
                this.loadRecentActivity(),
                this.loadMaintenanceRequests(),
                this.loadUpcomingLeases()
            ]);

            this.initialized = true;
            console.log('✅ DashboardController initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing dashboard:', error);
            this.handleInitializationError(error);
        } finally {
            // Ensure loading states are cleared
            if (window.setDashboardLoading) {
                window.setDashboardLoading('properties', false);
                window.setDashboardLoading('activity', false);
                window.setDashboardLoading('maintenance', false);
                window.setDashboardLoading('leases', false);
            }
        }
    }

    /**
     * Handle initialization errors gracefully
     */
    handleInitializationError(error) {
        console.error('Dashboard initialization error:', error);
        
        // Set default stats
        if (window.updateDashboardStats) {
            window.updateDashboardStats({
                properties: 0,
                tenants: 0,
                overdueBills: 0,
                pendingRequests: 0
            });
        }
        
        // Clear any displayed lists
        if (window.displayProperties) {
            window.displayProperties([]);
        }
        if (window.displayMaintenanceRequests) {
            window.displayMaintenanceRequests([]);
        }
        if (window.displayLeases) {
            window.displayLeases([]);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event listeners handled in dashboard view
    }

    /**
     * Load dashboard statistics
     */
    async loadStatistics() {
        try {
            window.setDashboardLoading('properties', true);

            const [properties, tenants, bills, maintenance] = await Promise.all([
                this.service.getProperties(),
                this.service.getTenants(),
                this.service.getBills(),
                this.service.getMaintenanceRequests()
            ]);

            const stats = {
                properties: properties.length,
                tenants: tenants.length,
                overdueBills: bills.filter(b => b.status === 'overdue').length,
                pendingRequests: maintenance.filter(m => m.status !== 'closed').length
            };

            window.updateDashboardStats(stats);
        } catch (error) {
            console.error('Error loading statistics:', error);
        } finally {
            window.setDashboardLoading('properties', false);
        }
    }

    /**
     * Load recent properties
     */
    async loadRecentProperties() {
        try {
            window.setDashboardLoading('properties', true);

            const properties = await this.service.getProperties();
            const recent = properties
                .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
                .slice(0, 5);

            window.displayPropertiesList(recent);
        } catch (error) {
            console.error('Error loading recent properties:', error);
        } finally {
            window.setDashboardLoading('properties', false);
        }
    }

    /**
     * Load recent activity
     */
    async loadRecentActivity() {
        try {
            window.setDashboardLoading('activity', true);

            // Load activities from the activities collection (same as activity log)
            const activities = [];
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const userId = this.currentUser?.id || this.currentUser?.uid || null;
            const isTenant = this.currentUser?.role === 'tenant';

            if (!userId) {
                console.warn('No user ID available for loading activities');
                return;
            }

            try {
                // Query activities collection for recent activities
                let activitiesQuery = window.firebaseDb.collection('activities')
                    .orderBy('timestamp', 'desc')
                    .limit(10);

                if (!isTenant) {
                    // Landlord: fetch activities where landlordId matches
                    activitiesQuery = activitiesQuery.where('landlordId', '==', userId);
                } else {
                    // Tenant: fetch activities where tenantId matches
                    activitiesQuery = activitiesQuery.where('tenantId', '==', userId);
                }

                const snapshot = await activitiesQuery.get();
                snapshot.forEach(doc => {
                    const act = doc.data();
                    const actDate = new Date(act.timestamp);
                    if (actDate >= thirtyDaysAgo && actDate <= now) {
                        activities.push({
                            type: act.type || 'custom',
                            title: act.title || 'Activity',
                            description: act.message || act.description || '',
                            timestamp: act.timestamp,
                            icon: act.icon || 'fas fa-info-circle',
                            color: act.color || 'var(--info)',
                            data: act,
                            source: 'activities',
                            isSeen: act.isSeen === 'seen' ? 'seen' : 'unseen',
                            activityId: doc.id
                        });
                    }
                });
            } catch (error) {
                console.error('Error fetching activities for dashboard:', error);
            }

            // Display activities in dashboard
            this.displayDashboardActivities(activities);
        } catch (error) {
            console.error('Error loading recent activity:', error);
        } finally {
            window.setDashboardLoading('activity', false);
        }
    }

    /**
     * Display activities in the dashboard
     */
    displayDashboardActivities(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) {
            console.warn('Dashboard activity list element not found');
            return;
        }

        if (!activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Take only the first 5 for dashboard
        const recentActivities = activities.slice(0, 5);

        const activitiesHTML = recentActivities.map(activity => {
            const entityId = (activity.data && (activity.data.apartmentId || activity.data.propertyId || activity.data.id)) || '';
            const entityPayload = encodeURIComponent(JSON.stringify(activity.data || {}));
            const statusClass = activity.source === 'activities' ? (activity.isSeen === 'unseen' ? 'unseen-activity' : 'seen-activity') : '';

            return `
                <div class="activity-item ${statusClass}" 
                    data-activity-type="${activity.type}" 
                    data-activity-id="${entityId}"
                    onclick="window.casaLink?.handleActivityClick && window.casaLink.handleActivityClick(0, '${activity.type}', '${entityId}', '${entityPayload}')">
                    <div class="activity-icon" style="background: ${activity.color}20; color: ${activity.color};">
                        <i class="${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">
                            ${activity.title}
                            ${activity.source === 'activities' && activity.isSeen === 'unseen' ? '<span class="activity-badge unseen-badge">New</span>' : ''}
                        </div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-time">${this.formatActivityTime(activity.timestamp)}</div>
                    </div>
                </div>
            `;
        }).join('');

        activityList.innerHTML = activitiesHTML;
    }

    /**
     * Format activity timestamp for display
     */
    formatActivityTime(timestamp) {
        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffMs = now - activityTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return activityTime.toLocaleDateString();
    }

    /**
     * Load maintenance requests
     */
    async loadMaintenanceRequests() {
        try {
            window.setDashboardLoading('maintenance', true);

            const requests = await this.service.getMaintenanceRequests();
            const pending = requests
                .filter(r => r.status !== 'closed')
                .sort((a, b) => {
                    const priorityMap = { urgent: 3, high: 2, medium: 1, low: 0 };
                    return priorityMap[b.priority] - priorityMap[a.priority];
                })
                .slice(0, 5);

            window.displayMaintenanceList(pending);
        } catch (error) {
            console.error('Error loading maintenance requests:', error);
        } finally {
            window.setDashboardLoading('maintenance', false);
        }
    }

    /**
     * Load upcoming lease expirations
     */
    async loadUpcomingLeases() {
        try {
            window.setDashboardLoading('leases', true);

            const leases = await this.service.getLeases();
            const today = new Date();
            const upcoming = leases
                .filter(l => {
                    const expDate = new Date(l.expirationDate);
                    const daysUntilExp = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
                    return daysUntilExp > 0 && daysUntilExp <= 90;
                })
                .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
                .slice(0, 5)
                .map(l => ({
                    ...l,
                    daysRemaining: Math.floor(
                        (new Date(l.expirationDate) - today) / (1000 * 60 * 60 * 24)
                    )
                }));

            window.displayLeasesList(upcoming);
        } catch (error) {
            console.error('Error loading upcoming leases:', error);
        } finally {
            window.setDashboardLoading('leases', false);
        }
    }

    /**
     * Navigate to properties
     */
    navigateToProperties() {
        window.location.hash = '#properties';
        if (window.propertiesController) {
            window.propertiesController.init();
        }
    }

    /**
     * Navigate to maintenance
     */
    navigateToMaintenance() {
        window.location.hash = '#maintenance';
        if (window.maintenanceController) {
            window.maintenanceController.init();
        }
    }

    /**
     * Navigate to leases
     */
    navigateToLeases() {
        window.location.hash = '#leases';
        // Load leases controller when created
    }

    /**
     * Get summary metrics
     */
    async getSummaryMetrics() {
        try {
            const [properties, tenants, bills, maintenance] = await Promise.all([
                this.service.getProperties(),
                this.service.getTenants(),
                this.service.getBills(),
                this.service.getMaintenanceRequests()
            ]);

            return {
                properties: properties.length,
                tenants: tenants.length,
                revenue: bills
                    .filter(b => b.status === 'paid')
                    .reduce((sum, b) => sum + b.amount, 0),
                pendingRevenue: bills
                    .filter(b => b.status !== 'paid')
                    .reduce((sum, b) => sum + b.amount, 0),
                maintenanceRequests: maintenance.length,
                completedMaintenance: maintenance.filter(m => m.status === 'closed').length
            };
        } catch (error) {
            console.error('Error getting summary metrics:', error);
            return null;
        }
    }

    /**
     * Get occupancy metrics
     */
    async getOccupancyMetrics() {
        try {
            const properties = await this.service.getProperties();
            const totalUnits = properties.reduce((sum, p) => sum + (p.units?.length || 0), 0);
            const occupiedUnits = properties.reduce((sum, p) => sum + (p.occupiedUnits || 0), 0);

            return {
                totalUnits,
                occupiedUnits,
                vacantUnits: totalUnits - occupiedUnits,
                occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0
            };
        } catch (error) {
            console.error('Error getting occupancy metrics:', error);
            return null;
        }
    }

    /**
     * Get revenue metrics
     */
    async getRevenueMetrics() {
        try {
            const bills = await this.service.getBills();
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            const thisMonthBills = bills.filter(b => new Date(b.createdDate) > lastMonth);

            return {
                totalRevenue: thisMonthBills.reduce((sum, b) => sum + b.amount, 0),
                paidRevenue: thisMonthBills
                    .filter(b => b.status === 'paid')
                    .reduce((sum, b) => sum + b.amount, 0),
                pendingRevenue: thisMonthBills
                    .filter(b => b.status === 'pending')
                    .reduce((sum, b) => sum + b.amount, 0),
                overdueRevenue: thisMonthBills
                    .filter(b => b.status === 'overdue')
                    .reduce((sum, b) => sum + b.amount, 0)
            };
        } catch (error) {
            console.error('Error getting revenue metrics:', error);
            return null;
        }
    }
}

// Initialize and expose to window
if (window.dataService) {
    window.dashboardController = new DashboardController(window.dataService);
}