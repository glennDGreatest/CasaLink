// Reports Manager for Analytics Data
class ReportsManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentUser = null;
        this.realTimeUnsubscribers = [];
        this._refreshTimeout = null;
        this.realTimeActive = false;
    }

    async init(user) {
        this.currentUser = user;
        // Ensure dataManager has the current user for predictive helpers
        if (this.dataManager) this.dataManager.currentUser = user;
        console.log('✅ Reports Manager initialized for:', user.role);

        // attach predictive analytics helper
        if (window.PredictiveAnalytics) {
            this.predictiveAnalytics = new PredictiveAnalytics(this.dataManager);
            await this.predictiveAnalytics.init();
        }

        // Start listening for real-time updates so the reports view stays fresh
        this.setupRealTimeListeners();

        return this;
    }

    async getPredictiveData(financialReports = {}, maintenanceReports = {}) {
        // If PredictiveAnalytics is not initialized, return basic placeholders
        if (!this.predictiveAnalytics) {
            return {
                revenueForecast: {},
                occupancyForecast: {},
                maintenanceForecast: {},
                tenantChurn: [],
                rentOptimization: [],
                latePaymentRisk: [],
                maintenanceTriage: [],
                tenantSentiment: { label: 'neutral', confidence: 0, score: 0 },
                anomalies: ['None detected'],
                recommendations: [{ text: 'Predictive analytics not available.', priority: 'low' }]
            };
        }

        // fetch base forecasts
        const [revenueForecast, occupancyForecast, maintenanceForecast] = await Promise.all([
            this.predictiveAnalytics.predictRevenueForecast(6),
            this.predictiveAnalytics.predictOccupancyTrend(6),
            this.predictiveAnalytics.predictMaintenanceCosts(6)
        ]);

        // Logistic regression predictions
        let tenantChurn = [];
        let rentOptimization = [];
        let latePaymentRisk = [];
        let maintenanceTriage = [];
        let tenantSentiment = { label: 'neutral', confidence: 0, score: 0 };

        if (this.predictiveAnalytics) {
            if (typeof this.predictiveAnalytics.predictTenantChurn === 'function') {
                tenantChurn = await this.predictiveAnalytics.predictTenantChurn();
            }
            if (typeof this.predictiveAnalytics.predictRentUnderMarket === 'function') {
                rentOptimization = await this.predictiveAnalytics.predictRentUnderMarket();
            }
            if (typeof this.predictiveAnalytics.predictLatePaymentRisk === 'function') {
                latePaymentRisk = await this.predictiveAnalytics.predictLatePaymentRisk();
            }
            if (typeof this.predictiveAnalytics.predictMaintenanceTriage === 'function') {
                maintenanceTriage = await this.predictiveAnalytics.predictMaintenanceTriage();
            }
            if (typeof this.predictiveAnalytics.predictTenantSentiment === 'function') {
                tenantSentiment = await this.predictiveAnalytics.predictTenantSentiment();
            }
        }

        // If no ML results are available, keep empty arrays so the UI can display a no-data state.
        if (!tenantChurn || tenantChurn.length === 0) {
            tenantChurn = [];
        }
        if (!rentOptimization || rentOptimization.length === 0) {
            rentOptimization = [];
        }
        if (!latePaymentRisk || latePaymentRisk.length === 0) {
            latePaymentRisk = [];
        }
        if (!maintenanceTriage || maintenanceTriage.length === 0) {
            maintenanceTriage = [];
        }
        if (!tenantSentiment) {
            tenantSentiment = { label: 'neutral', confidence: 50, score: 0 };
        }

        // anomaly detection
        let anomalies = [];
        if (this.predictiveAnalytics && typeof this.predictiveAnalytics.detectAnomalies === 'function') {
            anomalies = await this.predictiveAnalytics.detectAnomalies(financialReports, (maintenanceReports && maintenanceReports.maintenance) || {});
        }
        if (!anomalies || !anomalies.length) {
            anomalies = ['None detected'];
        }

        const hasData = !!(
            (financialReports && financialReports.hasData) ||
            (maintenanceReports && maintenanceReports.hasData)
        );

        // Build actionable recommendations based on ML outputs
        // Pre-fetch landlord units/apartments so recommendation text can show readable names instead of IDs
        let unitsById = {};
        let unitsByNumber = {};
        let apartmentsById = {};
        try {
            const landlordId = this.currentUser?.uid || this.currentUser?.id || null;
            if (landlordId && this.dataManager) {
                const [units, apartments] = await Promise.all([
                    (typeof this.dataManager.getLandlordUnits === 'function') ? this.dataManager.getLandlordUnits(landlordId).catch(() => []) : [],
                    (typeof this.dataManager.getLandlordApartments === 'function') ? this.dataManager.getLandlordApartments(landlordId).catch(() => []) : []
                ]);
                (units || []).forEach(u => {
                    if (u.id) unitsById[String(u.id)] = u;
                    if (u.unitNumber) unitsByNumber[String(u.unitNumber).toLowerCase()] = u;
                    if (u.roomNumber) unitsByNumber[String(u.roomNumber).toLowerCase()] = u;
                });
                (apartments || []).forEach(a => {
                    const id = a.id || a.apartmentId || a._id;
                    if (id) apartmentsById[String(id)] = a;
                });
            }
        } catch (e) {
            console.warn('Could not prefetch units/apartments for recommendations', e);
        }

        const recommendations = [];

        const resolveUnitDisplay = (unitVal) => {
            if (!unitVal) return unitVal || '';
            try {
                if (unitsById[unitVal]) return unitsById[unitVal].unitNumber || unitsById[unitVal].roomNumber || String(unitsById[unitVal].id).slice(0,8);
                const low = String(unitVal).toLowerCase();
                if (unitsByNumber[low]) return unitsByNumber[low].unitNumber || unitsByNumber[low].roomNumber || unitsByNumber[low].id;
            } catch (e) { /* ignore */ }
            return unitVal;
        };

        const resolveApartmentFromUnit = (unitVal) => {
            try {
                const u = unitsById[unitVal] || unitsByNumber[String(unitVal).toLowerCase()];
                if (u && u.apartmentId && apartmentsById[u.apartmentId]) {
                    const a = apartmentsById[u.apartmentId];
                    return a.apartmentName || a.apartmentAddress || a.name || '';
                }
            } catch (e) { }
            return '';
        };

        tenantChurn.forEach(c => {
            if (c.probability > 70) {
                recommendations.push({
                    text: `Proactively reach out to ${c.tenant || 'tenant'} in ${c.unit} (${c.probability}% churn risk)`,
                    priority: 'high',
                    explanation: `Predicted churn probability ${c.probability}% from recent missed payments, maintenance frequency, and lease duration.`
                });
            }
        });

        rentOptimization.forEach(r => {
            if (r.probability > 60 && r.suggestedIncrease) {
                const unitLabel = resolveUnitDisplay(r.unit || r.unitNumber || '');
                const aptFromUnit = resolveApartmentFromUnit(r.unit || '');
                const aptLabel = aptFromUnit || (r.apartmentName || r.address || r.apartmentAddress || '');
                const place = aptLabel ? `${unitLabel} • ${aptLabel}` : unitLabel;
                recommendations.push({
                    text: `Rent for unit ${place} appears under market; consider increasing by ₱${r.suggestedIncrease}`,
                    priority: 'medium',
                    explanation: `Model compared current rent to local market median and demand; suggested increase = ₱${r.suggestedIncrease}.`
                });
            }
        });

        latePaymentRisk.forEach(r => {
            if (r.probability > 40) {
                recommendations.push({
                    text: `Monitor payments from ${r.tenant || 'tenant'} (${r.probability}% late payment risk)`,
                    priority: 'medium',
                    explanation: `Late payment risk ${r.probability}% derived from recent on-time rate, outstanding balance and payment history.`
                });
            }
        });

        if (maintenanceTriage.some(m => m.priority === 'EMERGENCY')) {
            recommendations.push({ text: 'Address emergency maintenance request(s) immediately.', priority: 'high', explanation: 'One or more maintenance requests flagged as EMERGENCY based on reported severity and age.' });
        }

        if (tenantSentiment.label === 'negative') {
            recommendations.push({ text: 'Follow up with tenants showing negative sentiment to prevent churn.', priority: 'high', explanation: 'Aggregated tenant feedback shows negative sentiment which correlates with higher churn risk.' });
        }

        if (recommendations.length === 0) {
            if (!hasData) {
                recommendations.push({ text: 'Not enough data available to generate recommendations.', priority: 'low', explanation: 'Collect more rent, payment, and maintenance history so the system can analyze trends and identify issues.' });
            } else {
                recommendations.push({ text: 'No urgent actions detected; continue monitoring.', priority: 'low', explanation: 'No models produced high-confidence risk signals based on available data.' });
            }
        }

        return {
            revenueForecast,
            occupancyForecast,
            maintenanceForecast,
            tenantChurn,
            rentOptimization,
            latePaymentRisk,
            maintenanceTriage,
            tenantSentiment,
            anomalies,
            recommendations
            ,hasData
        };
    }

    // Financial Reports
    async getFinancialReports(period = 'last6months') {
        console.log('💰 Generating financial reports for:', period);

        // attempt to use live data if available
        const landlordId = this.currentUser?.uid || this.currentUser?.id;
        if (landlordId && this.dataManager && typeof this.dataManager.getBills === 'function') {
            try {
                const bills = await this.dataManager.getBills(landlordId);
                const months = this.getMonthsForPeriod(period);

                const labels = months.slice();
                const currentYear = labels.map(() => 0);
                const lateData = labels.map(() => 0);
                const paymentMethodsCount = {};
                const revenueByUnit = {};
                let paidCount = 0;

                bills.forEach(b => {
                    const status = b.status || '';
                    if (status.toLowerCase() === 'paid') {
                        paidCount++;
                        const paidDate = new Date(b.paidDate || b.dueDate || Date.now());
                        const mon = labels[paidDate.getMonth()];
                        const idx = labels.indexOf(mon);
                        if (idx > -1) {
                            currentYear[idx] += (b.amount || 0);
                            if (b.paidDate && b.dueDate && new Date(b.paidDate) > new Date(b.dueDate)) {
                                lateData[idx]++;
                            }
                        }

                        // revenue by unit
                        const u = b.unitId || b.propertyId || 'Other';
                        revenueByUnit[u] = (revenueByUnit[u] || 0) + (b.amount || 0);

                        // payment methods
                        const pm = b.paymentMethod || 'Unknown';
                        paymentMethodsCount[pm] = (paymentMethodsCount[pm] || 0) + 1;
                    }
                });

                const collectionRate = bills.length ? Math.round((paidCount / bills.length) * 100) : 0;

                return {
                    monthlyRevenue: { labels, currentYear, previousYear: currentYear.slice() },
                    collectionRate: { collected: collectionRate, pending: 100 - collectionRate },
                    latePayments: { labels, data: lateData },
                    paymentMethods: { labels: Object.keys(paymentMethodsCount), data: Object.values(paymentMethodsCount) },
                    revenueByUnit: { labels: Object.keys(revenueByUnit), data: Object.values(revenueByUnit) },
                    hasData: bills.length > 0
                };
            } catch (err) {
                console.warn('Unable to build financial reports from live data', err);
            }
        }

        return {
            monthlyRevenue: { labels: this.getMonthsForPeriod(period), currentYear: [], previousYear: [] },
            collectionRate: { collected: 0, pending: 100 },
            latePayments: { labels: this.getMonthsForPeriod(period), data: [] },
            paymentMethods: { labels: [], data: [] },
            revenueByUnit: { labels: [], data: [] },
            hasData: false
        };
    }

    // Property Performance Reports
    async getPropertyReports() {
        console.log('🏠 Generating property performance reports');

        const landlordId = this.currentUser?.uid || this.currentUser?.id;
        if (landlordId && this.dataManager && typeof this.dataManager.getLandlordUnits === 'function') {
            try {
                const units = await this.dataManager.getLandlordUnits(landlordId);
                const occupied = units.filter(u => u.status === 'occupied' || !u.isAvailable).length;
                const vacant = units.length - occupied;
                const occupancy = { occupied, vacant };

                // rent comparison still mock market data
                const rentComparison = this.generateRentComparisonData();
                const vacancyRate = this.generateVacancyData();

                return { occupancy, rentComparison, vacancyRate, hasData: occupied + vacant > 0 };
            } catch (err) {
                console.warn('Unable to fetch units for property reports', err);
            }
        }

        return {
            occupancy: { occupied: 0, vacant: 0 },
            rentComparison: { labels: [], yourRent: [], marketAverage: [] },
            vacancyRate: { rate: 0, totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, lostIncome: 0 },
            hasData: false
        };
    }

    // Tenant Management Reports
    async getTenantReports() {
        console.log('👥 Generating tenant management reports');

        const landlordId = this.currentUser?.uid || this.currentUser?.id;
        if (landlordId && this.dataManager) {
            try {
                // retention based on leases
                let renewed = 0, movedOut = 0;
                if (typeof this.dataManager.getLandlordLeases === 'function') {
                    const leases = await this.dataManager.getLandlordLeases(landlordId);
                    leases.forEach(l => {
                        if (l.status === 'renewed') renewed++;
                        else if (l.status === 'ended' || l.status === 'moved_out' || l.status === 'terminated') movedOut++;
                    });
                }
                const total = renewed + movedOut;
                const retention = { renewed: total ? Math.round((renewed / total) * 100) : 0, movedOut: total ? Math.round((movedOut / total) * 100) : 0 };

                // maintenance costs from requests
                let maintenance = { labels: [], emergency: [], planned: [], total: [] };
                if (typeof this.dataManager.getMaintenanceRequests === 'function') {
                    const reqs = await this.dataManager.getMaintenanceRequests(landlordId);
                    // group by month
                    const months = this.getMonthsForPeriod('last6months');
                    maintenance.labels = months;
                    months.forEach(() => {
                        maintenance.emergency.push(0);
                        maintenance.planned.push(0);
                        maintenance.total.push(0);
                    });
                    reqs.forEach(r => {
                        const date = new Date(r.reportedDate || r.createdAt);
                        const mon = months[date.getMonth()];
                        const idx = months.indexOf(mon);
                        if (idx > -1) {
                            const cost = r.cost || r.estimatedCost || 0;
                            maintenance.total[idx] += cost;
                            if (r.type === 'emergency' || r.priority === 'high') {
                                maintenance.emergency[idx] += cost;
                            } else {
                                maintenance.planned[idx] += cost;
                            }
                        }
                    });
                }

                // turnover remains mock
                const turnover = this.generateTurnoverData();

                return { retention, maintenance, turnover, hasData: total > 0 || (maintenance && maintenance.total && maintenance.total.some(v => v > 0)) };
            } catch (err) {
                console.warn('Unable to generate tenant reports from live data', err);
            }
        }

        return {
            retention: { renewed: 0, movedOut: 0 },
            maintenance: { labels: this.getMonthsForPeriod('last6months'), emergency: [], planned: [], total: [] },
            turnover: { labels: [], turnovers: [], avgVacancyDays: [], turnoverCosts: [] },
            hasData: false
        };
    }

    // Quick Glance Metrics
    async getQuickMetrics() {
        console.log('📊 Generating quick glance metrics');
        const landlordId = this.currentUser?.uid || this.currentUser?.id;
        if (landlordId && this.dataManager) {
            try {
                const fr = await this.getFinancialReports('last6months');
                const pr = await this.getPropertyReports();
                const tr = await this.getTenantReports();
                const revenueSeries = (fr.monthlyRevenue && fr.monthlyRevenue.currentYear) || [];
                const lastRevenue = revenueSeries.slice(-1)[0] || 0;
                const priorRevenue = revenueSeries.slice(-2, -1)[0] || lastRevenue;
                const revenueGrowth = priorRevenue ? ((lastRevenue - priorRevenue) / priorRevenue) * 100 : 0;

                const maintenanceSeries = (tr.maintenance && tr.maintenance.total) || [];
                const lastMaintenance = maintenanceSeries.slice(-1)[0] || 0;
                const priorMaintenance = maintenanceSeries.slice(-2, -1)[0] || lastMaintenance;
                const maintenanceTrend = priorMaintenance ? ((lastMaintenance - priorMaintenance) / priorMaintenance) * 100 : 0;

                return {
                    monthlyRevenue: revenueSeries.reduce((a, b) => a + b, 0),
                    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
                    occupancyRate: pr.occupancy && (pr.occupancy.occupied + pr.occupancy.vacant) ? Math.round((pr.occupancy.occupied / (pr.occupancy.occupied + pr.occupancy.vacant)) * 100) : 0,
                    occupancyTrend: 0,
                    collectionRate: (fr.collectionRate && fr.collectionRate.collected) || 0,
                    collectionTrend: 0,
                    maintenanceCost: lastMaintenance,
                    maintenanceTrend: Math.round(maintenanceTrend * 10) / 10,
                    renewalRate: (tr.retention && tr.retention.renewed) || 0,
                    renewalTrend: 0,
                    vacantUnits: pr.occupancy ? pr.occupancy.vacant : 0,
                    totalUnits: pr.occupancy ? (pr.occupancy.occupied + pr.occupancy.vacant) : 0,
                    hasData: !!(fr.hasData || pr.hasData || tr.hasData)
                };
            } catch(err) {
                console.warn('quick metrics live failure', err);
            }
        }

        return {
            monthlyRevenue: 0,
            revenueGrowth: 0,
            occupancyRate: 0,
            occupancyTrend: 0,
            collectionRate: 0,
            collectionTrend: 0,
            maintenanceCost: 0,
            maintenanceTrend: 0,
            renewalRate: 0,
            renewalTrend: 0,
            vacantUnits: 0,
            totalUnits: 0,
            hasData: false
        };
    }

    generateCollectionRateData() {
        return {
            collected: 97,
            pending: 3
        };
    }

    generateLatePaymentsData(period) {
        const months = this.getMonthsForPeriod(period);
        
        return {
            labels: months,
            data: [3, 5, 2, 4, 6, 2, 3, 1, 4, 2, 3, 1].slice(0, months.length)
        };
    }

    generatePaymentMethodsData() {
        return {
            labels: ['GCash', 'Bank Transfer', 'Cash', 'Maya', 'Check'],
            data: [45, 25, 15, 10, 5]
        };
    }

    generateRevenueByUnitData() {
        return {
            labels: ['Unit 101', 'Unit 102', 'Unit 201', 'Unit 202', 'Unit 301', 'Unit 302', 'Unit 303', 'Unit 304'],
            data: [12500, 11800, 13200, 12700, 14000, 13500, 12800, 14200]
        };
    }

    generateOccupancyData() {
        return {
            occupied: 94,
            vacant: 6
        };
    }

    generateRentComparisonData() {
        return {
            labels: ['Studio', '1BR', '2BR', '3BR'],
            yourRent: [12000, 15000, 18000, 22000],
            marketAverage: [11500, 14500, 17500, 21000]
        };
    }

    generateVacancyData() {
        return {
            rate: 6,
            totalUnits: 20,
            occupiedUnits: 18,
            vacantUnits: 2,
            lostIncome: 28000 // 2 units * average rent
        };
    }

    generateRetentionData() {
        return {
            renewed: 78,
            movedOut: 22
        };
    }

    generateMaintenanceData() {
        const months = this.getMonthsForPeriod('last6months');
        
        return {
            labels: months,
            emergency: [800, 1200, 400, 900, 1100, 950],
            planned: [1000, 1000, 1100, 1000, 1000, 1200],
            total: [1800, 2200, 1500, 1900, 2100, 2150]
        };
    }

    generateTurnoverData() {
        return {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            turnovers: [2, 1, 3, 1],
            avgVacancyDays: [12, 8, 18, 10],
            turnoverCosts: [24000, 12000, 36000, 12000]
        };
    }

    // Utility Methods
    getMonthsForPeriod(period) {
        const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        switch (period) {
            case 'last30days':
                // approximate by last 1 month
                return allMonths.slice(-1);
            case 'lastQuarter':
                return allMonths.slice(-3);
            case 'last3months':
                return allMonths.slice(-3);
            case 'last6months':
                return allMonths.slice(-6);
            case 'yeartodate':
                return allMonths.slice(0, new Date().getMonth() + 1);
            case 'last12months':
                return allMonths;
            default:
                // try to detect custom range pattern and ignore
                if (typeof period === 'string' && period.includes('-')) {
                    return allMonths.slice(-6);
                }
                return allMonths.slice(-6);
        }
    }

    // Data Export Methods
    async exportToCSV(reportType, data) {
        console.log('📤 Exporting report to CSV:', reportType);
        
        try {
            const csvContent = this.generateCSVContent(reportType, data);
            const currentDate = new Date();
            const filename = `CasaLink-${reportType}-${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}.csv`;
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            return { success: true, filename, format: 'CSV' };
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            return { success: false, error: error.message };
        }
    }

    async exportToPDF(reportType, data) {
        console.log('📤 Exporting report to PDF:', reportType);
        
        try {
            // Note: This is a placeholder. In a real implementation, you would use a library like jsPDF or pdfkit
            // For now, we'll trigger the browser's print-to-PDF functionality
            const currentDate = new Date();
            const filename = `CasaLink-${reportType}-${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}.pdf`;
            
            // This would be implemented with a PDF library
            window.print();
            
            return { success: true, filename, format: 'PDF' };
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            return { success: false, error: error.message };
        }
    }

    async exportToExcel(reportType, data) {
        console.log('📤 Exporting report to Excel (dummy):', reportType);
        try {
            // Placeholder - would use SheetJS or similar
            const filename = `CasaLink-${reportType}.xlsx`;
            // simulate download
            this.showNotification('Excel export not implemented; returning dummy', 'info');
            return { success: true, filename, format: 'Excel' };
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            return { success: false, error: error.message };
        }
    }

    generateCSVContent(reportType, data) {
        let csv = `CASALINK - ${reportType.toUpperCase()} REPORT\n`;
        csv += `Generated: ${new Date().toLocaleString('en-US')}\n\n`;
        
        // Generate CSV based on report type
        if (Array.isArray(data)) {
            if (data.length > 0) {
                // Get headers from first object
                const headers = Object.keys(data[0]);
                csv += headers.map(h => `"${h}"`).join(',') + '\n';
                
                // Add data rows
                data.forEach(row => {
                    csv += headers.map(h => {
                        const value = row[h];
                        return `"${value !== null && value !== undefined ? value : ''}"`;
                    }).join(',') + '\n';
                });
            }
        } else if (typeof data === 'object') {
            // Handle object data
            Object.entries(data).forEach(([key, value]) => {
                csv += `${key},${value}\n`;
            });
        }
        
        return csv;
    }

    // Data Refresh Methods
    async refreshAllData() {
        console.log('🔄 Refreshing all reports data...');
        // In real app, this would fetch fresh data from Firebase
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, timestamp: new Date().toISOString() };
    }

    // Real-time Data Updates
    setupRealTimeListeners() {
        console.log('📡 Setting up real-time reports listeners');

        this.realTimeActive = false;

        const landlordId = this.currentUser?.uid || this.currentUser?.id;
        if (!landlordId || typeof firebaseDb === 'undefined') {
            console.warn('⚠️ Real-time listeners not initialized (missing landlordId or firebaseDb)');
            if (window.casaLink && typeof window.casaLink.setLiveUpdateStatus === 'function') {
                window.casaLink.setLiveUpdateStatus(false);
            }
            return;
        }

        // Helper to debounce refresh to avoid rapid rerenders
        const scheduleRefresh = () => {
            if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
            this._refreshTimeout = setTimeout(() => {
                if (window.casaLink && typeof window.casaLink.refreshReportsData === 'function') {
                    // Trigger refresh with an indicator that it came from a live update.
                    window.casaLink.refreshReportsData(undefined, true);
                }
            }, 800);
        };

        const updateLiveIndicator = (enabled) => {
            this.realTimeActive = enabled;
            if (window.casaLink && typeof window.casaLink.setLiveUpdateStatus === 'function') {
                window.casaLink.setLiveUpdateStatus(enabled);
            }
        };

        const attachListener = (collection, queryFn) => {
            try {
                const query = queryFn(firebaseDb.collection(collection));
                const unsubscribe = query.onSnapshot(snapshot => {
                    console.log(`📡 Real-time update detected for ${collection} (${snapshot.size} docs)`);
                    updateLiveIndicator(true);
                    scheduleRefresh();
                }, err => {
                    console.warn(`⚠️ Real-time listener error for ${collection}:`, err);
                });
                this.realTimeUnsubscribers.push(unsubscribe);
            } catch (err) {
                console.warn('⚠️ Failed to attach real-time listener for', collection, err);
            }
        };

        // Collections that affect reports data
        attachListener('bills', col => col.where('landlordId', '==', landlordId));
        attachListener('leases', col => col.where('landlordId', '==', landlordId));
        attachListener('payments', col => col.where('landlordId', '==', landlordId));
        attachListener('maintenance', col => col.where('landlordId', '==', landlordId));
        attachListener('rooms', col => col.where('landlordId', '==', landlordId));

        // If listeners were successfully attached, consider live updates enabled
        if (this.realTimeUnsubscribers.length > 0) {
            updateLiveIndicator(true);
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up reports manager');
        if (window.casaLink && typeof window.casaLink.setLiveUpdateStatus === 'function') {
            window.casaLink.setLiveUpdateStatus(false);
        }
        this.realTimeActive = false;

        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        this.realTimeUnsubscribers.forEach(unsub => {
            try { unsub(); } catch (e) { /* ignore */ }
        });
        this.realTimeUnsubscribers = [];
    }
}

// Make it available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsManager;
}