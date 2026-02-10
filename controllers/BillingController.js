/**
 * BillingController
 * Handles all billing and payment interactions
 * Orchestrates between Billing views and DataService
 */

class BillingController {
    constructor(dataService) {
        this.service = dataService;
        this.currentFilter = '';
        this.statusFilter = '';
        this.allBills = [];
        this.setupEventListeners();
    }

    /**
     * Initialize controller
     */
    async init() {
        try {
            window.setBillingLoading(true);
            await this.loadBills();
            await this.updateStats();
            window.hideBillingError();
        } catch (error) {
            console.error('Error initializing billing:', error);
            window.showBillingError('Failed to load billing data');
        } finally {
            window.setBillingLoading(false);
        }
    }

    /**
     * Load all bills from service
     */
    async loadBills() {
        try {
            this.allBills = await this.service.getBills();
            this.displayFilteredBills();
        } catch (error) {
            throw new Error(`Failed to load bills: ${error.message}`);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event listeners handled in views
    }

    /**
     * Search bills
     */
    searchBills(query) {
        this.currentFilter = query.toLowerCase();
        this.displayFilteredBills();
    }

    /**
     * Filter bills by status
     */
    filterByStatus(status) {
        this.statusFilter = status;
        this.displayFilteredBills();
    }

    /**
     * Display filtered bills
     */
    displayFilteredBills() {
        let filtered = this.allBills;

        if (this.currentFilter) {
            filtered = filtered.filter(bill =>
                bill.tenantName.toLowerCase().includes(this.currentFilter) ||
                bill.propertyName.toLowerCase().includes(this.currentFilter) ||
                bill.billNumber.toLowerCase().includes(this.currentFilter)
            );
        }

        if (this.statusFilter) {
            filtered = filtered.filter(bill => bill.status === this.statusFilter);
        }

        window.displayBills(filtered);
    }

    /**
     * Update billing statistics
     */
    async updateStats() {
        try {
            const stats = {
                totalDue: this.allBills.reduce((sum, b) => sum + b.amount, 0),
                pendingAmount: this.allBills
                    .filter(b => b.status === 'pending')
                    .reduce((sum, b) => sum + b.amount, 0),
                overdueAmount: this.allBills
                    .filter(b => b.status === 'overdue')
                    .reduce((sum, b) => sum + b.amount, 0),
                collectedAmount: this.allBills
                    .filter(b => b.status === 'paid')
                    .reduce((sum, b) => sum + b.amount, 0)
            };
            window.updateBillingStats(stats);
        } catch (error) {
            console.error('Error updating billing stats:', error);
        }
    }

    /**
     * View bill details
     */
    viewBill(billId) {
        const bill = this.allBills.find(b => b.id === billId);
        if (bill) {
            window.location.hash = `#bill/${billId}`;
            console.log('Navigating to bill detail:', billId);
        }
    }

    /**
     * Open create bill modal
     */
    openCreateBillModal() {
        console.log('Opening create bill modal');
        if (window.modalManager) {
            window.modalManager.openModal('createBill');
        }
    }

    /**
     * Create new bill
     */
    async createBill(billData) {
        try {
            window.setBillingLoading(true);
            window.hideBillingError();

            const bill = new Bill(billData);
            if (!bill.isValid()) {
                const errors = bill.getValidationErrors();
                throw new Error(errors.join(', '));
            }

            await this.service.createBill(billData);
            await this.loadBills();
            await this.updateStats();

            if (window.modalManager) {
                window.modalManager.closeModal('createBill');
            }

            if (window.notificationManager) {
                window.notificationManager.success('Bill created successfully');
            }
        } catch (error) {
            console.error('Error creating bill:', error);
            window.showBillingError(error.message || 'Failed to create bill');
        } finally {
            window.setBillingLoading(false);
        }
    }

    /**
     * Mark bill as paid
     */
    async markBillPaid(billId) {
        try {
            window.setBillingLoading(true);
            window.hideBillingError();

            // Try to find bill details for creating a payment record
            const bill = this.allBills.find(b => b.id === billId) || {};

            // Create a payment record (landlord action - treated as verified/completed)
            try {
                if (typeof DataManager !== 'undefined' && DataManager.recordPayment) {
                    const paymentData = {
                        billId: billId,
                        tenantId: bill.tenantId,
                        landlordId: bill.landlordId,
                        tenantName: bill.tenantName,
                        roomNumber: bill.roomNumber,
                        amount: bill.amount || bill.totalAmount || 0,
                        paymentMethod: 'manual',
                        referenceNumber: '',
                        paymentDate: new Date().toISOString(),
                        notes: 'Marked paid by landlord',
                        status: 'completed',
                        createdAt: new Date().toISOString()
                    };

                    await DataManager.recordPayment(paymentData);
                }
            } catch (e) {
                console.warn('Failed to create payment record while marking bill paid:', e);
            }

            // Update bill to paid and mark verification
            await this.service.updateBill(billId, { status: 'paid', paidDate: new Date(), isPaymentVerified: true, paidAmount: bill.amount || bill.paidAmount || 0 });
            await this.loadBills();
            await this.updateStats();

            if (window.notificationManager) {
                window.notificationManager.success('Bill marked as paid');
            }
        } catch (error) {
            console.error('Error marking bill as paid:', error);
            window.showBillingError(error.message || 'Failed to update bill');
        } finally {
            window.setBillingLoading(false);
        }
    }

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(billId) {
        try {
            const bill = this.allBills.find(b => b.id === billId);
            if (!bill) throw new Error('Bill not found');

            await this.service.sendPaymentReminder(billId);

            if (window.notificationManager) {
                window.notificationManager.success('Reminder sent to tenant');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            window.showBillingError(error.message || 'Failed to send reminder');
        }
    }

    /**
     * Get overdue bills
     */
    getOverdueBills() {
        return this.allBills.filter(b => b.status === 'overdue');
    }

    /**
     * Generate billing report
     */
    async generateBillingReport(startDate, endDate) {
        try {
            const filtered = this.allBills.filter(b => {
                const billDate = new Date(b.createdDate);
                return billDate >= startDate && billDate <= endDate;
            });

            return {
                period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
                totalBills: filtered.length,
                totalAmount: filtered.reduce((sum, b) => sum + b.amount, 0),
                paidBills: filtered.filter(b => b.status === 'paid').length,
                pendingBills: filtered.filter(b => b.status === 'pending').length,
                overdueBills: filtered.filter(b => b.status === 'overdue').length
            };
        } catch (error) {
            console.error('Error generating report:', error);
            return null;
        }
    }
}

// Initialize and expose to window
if (window.dataService) {
    window.billingController = new BillingController(window.dataService);
}
