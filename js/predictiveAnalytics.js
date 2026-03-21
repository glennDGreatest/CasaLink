class PredictiveAnalytics {
    constructor(dataManager) {
        this.dataManager = dataManager;

        // Logistic regression classifiers
        this.tenantChurnModel = null;
        this.rentUnderMarketModel = null;
        this.latePaymentModel = null;
        this.maintenanceTriageModel = null;
        this.sentimentModel = null;

        // simple sentiment lexicon used if no BERT available
        this.sentimentLexicon = {
            positive: ['good', 'excellent', 'happy', 'satisfied', 'great', 'positive'],
            negative: ['bad', 'poor', 'angry', 'upset', 'terrible', 'negative']
        };
    }

    async init() {
        console.log('🔮 Predictive Analytics initialized');
        // train classifiers in the background if tfjs is present
        if (window.tf && this.dataManager) {
            // Intentionally not awaiting so the app can render quickly
            this.trainTenantChurnModel();
            this.trainRentUnderMarketModel();
            this.trainLatePaymentModel();
            this.trainMaintenanceTriageModel();
            this.trainSentimentModel();
        }
        return this;
    }

    // ===== LOGISTIC REGRESSION HELPERS =====
    async trainLogisticRegression(features, labels, options = {}) {
        if (!window.tf || !features || !features.length) return null;
        const { outputUnits = 1, epochs = 20 } = options;
        try {
            const xs = tf.tensor2d(features);
            const ys = outputUnits === 1
                ? tf.tensor2d(labels, [labels.length, 1])
                : tf.tensor2d(labels);

            const model = tf.sequential();
            model.add(tf.layers.dense({
                units: outputUnits,
                activation: outputUnits === 1 ? 'sigmoid' : 'softmax',
                inputShape: [features[0].length]
            }));

            const loss = outputUnits === 1 ? 'binaryCrossentropy' : 'categoricalCrossentropy';
            model.compile({ optimizer: tf.train.adam(0.1), loss });

            await model.fit(xs, ys, {
                epochs,
                batchSize: Math.min(32, features.length),
                verbose: 0
            });

            xs.dispose();
            ys.dispose();
            return model;
        } catch (err) {
            console.warn('⚠️ Logistic regression training error:', err);
            return null;
        }
    }

    getLandlordId() {
        return (this.dataManager && this.dataManager.currentUser && this.dataManager.currentUser.uid) ||
               (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid) ||
               null;
    }

    getRiskLabel(prob) {
        if (prob >= 0.7) return 'HIGH';
        if (prob >= 0.4) return 'MEDIUM';
        return 'LOW';
    }

    // ===== REVENUE FORECASTING =====
    async predictRevenueForecast(months = 6) {
        try {
            const historicalData = await this.getHistoricalRevenueData();
            if (historicalData.length < 3) {
                return this.getFallbackRevenueForecast(months);
            }

            // Heuristic forecast using weighted moving average (transparent and easy to explain)
            const predictions = this.calculateRevenueForecast(historicalData, months);
            const trend = this.calculateTrend(historicalData);
            const confidence = this.calculateConfidence(historicalData, months);

            return {
                predictions,
                confidence,
                trend,
                accuracy: this.calculateModelAccuracy(historicalData),
                nextMonthPrediction: predictions[0],
                growthRate: ((predictions[0] - historicalData[historicalData.length - 1].revenue) / historicalData[historicalData.length - 1].revenue * 100).toFixed(1)
            };
        } catch (error) {
            console.error('Error predicting revenue:', error);
            return this.getFallbackRevenueForecast(months);
        }
    }

    // ===== OCCUPANCY PREDICTION =====
    async predictOccupancyTrend(months = 6) {
        try {
            const leases = await this.dataManager.getLandlordLeases(this.dataManager.currentUser.uid);
            const currentOccupancy = await this.calculateCurrentOccupancy(leases);

            // Heuristic forecast based on lease expirations
            const predictions = this.calculateOccupancyPredictions(leases, currentOccupancy, months);
            const riskFactors = this.identifyOccupancyRisks(leases);
            return {
                predictions,
                currentOccupancy,
                riskFactors,
                atRiskUnits: riskFactors.length,
                recommendation: this.generateOccupancyRecommendation(predictions, riskFactors)
            };
        } catch (error) {
            console.error('Error predicting occupancy:', error);
            return this.getFallbackOccupancyPredictions(months);
        }
    }

    // ===== CHURN PREDICTION =====
    async predictTenantChurn() {
        const landlordId = this.getLandlordId();
        if (!landlordId || !this.dataManager) return [];

        const leases = await this.dataManager.getLandlordLeases(landlordId) || [];
        if (!leases.length) return [];

        // Ensure model is trained or train on the fly
        if (!this.tenantChurnModel) {
            await this.trainTenantChurnModel();
        }

        // Fallback to simple heuristic if model is missing
        if (!this.tenantChurnModel) {
            return leases.slice(0, 5).map(l => {
                return {
                    unit: l.unit || l.roomNumber || l.id,
                    tenant: l.tenantName || l.tenantId || 'Unknown',
                    probability: 20,
                    riskLevel: 'LOW',
                    reason: 'Insufficient historical data'
                };
            });
        }

        // Build feature matrix for prediction
        const payments = await this.dataManager.getPayments(landlordId);
        const maintenance = await this.dataManager.getMaintenanceRequests(landlordId);

        const paymentsByTenant = (payments || []).reduce((acc, p) => {
            const key = p.tenantId || p.tenant || 'unknown';
            acc[key] = acc[key] || [];
            acc[key].push(p);
            return acc;
        }, {});

        const maintenanceByTenant = (maintenance || []).reduce((acc, r) => {
            const key = r.tenantId || r.tenant || 'unknown';
            acc[key] = acc[key] || [];
            acc[key].push(r);
            return acc;
        }, {});

        const features = [];
        const meta = [];

        leases.forEach(lease => {
            const tenantKey = lease.tenantId || lease.tenant || 'unknown';
            const tenantPayments = paymentsByTenant[tenantKey] || [];
            const tenantMaintenance = maintenanceByTenant[tenantKey] || [];

            const leaseStart = new Date(lease.leaseStart || lease.startDate || Date.now());
            const leaseEnd = new Date(lease.leaseEnd || lease.endDate || leaseStart);
            const leaseLengthMonths = Math.max(1, Math.round((leaseEnd - leaseStart) / (1000 * 60 * 60 * 24 * 30)));

            const lateCount = tenantPayments.filter(p => {
                if (!p.paidDate || !p.dueDate) return false;
                try {
                    return new Date(p.paidDate) > new Date(p.dueDate);
                } catch { return false; }
            }).length;

            const paymentHistory = tenantPayments.length;
            const maintenanceCount = tenantMaintenance.length;
            const rentAmount = lease.rent || lease.monthlyRent || 0;

            features.push([leaseLengthMonths, paymentHistory, lateCount, maintenanceCount, rentAmount]);
            meta.push({
                unit: lease.unit || lease.roomNumber || lease.id,
                tenant: lease.tenantName || tenantKey,
                leaseStatus: (lease.status || '').toLowerCase()
            });
        });

        const input = tf.tensor2d(features);
        const output = this.tenantChurnModel.predict(input);
        const probs = Array.from(await output.data());
        input.dispose(); output.dispose();

        return meta.map((m, idx) => {
            const prob = Math.min(1, Math.max(0, probs[idx] || 0));
            return {
                unit: m.unit,
                tenant: m.tenant,
                probability: Math.round(prob * 100),
                riskLevel: this.getRiskLabel(prob),
                reason: m.leaseStatus.includes('ended') ? 'Lease recently ended' : 'Predicted churn risk'
            };
        }).sort((a, b) => b.probability - a.probability);
    }

    // ===== RENT OPTIMIZATION =====
    async suggestRentAdjustments() {
        // Uses the rent-under-market logistic regression classifier
        const suggestions = await this.predictRentUnderMarket();
        return suggestions.map(s => ({
            unit: s.unit,
            probability: s.probability,
            recommendation: s.suggestedIncrease > 0 ? `Suggest increase by ₱${s.suggestedIncrease}` : 'Rent is at market rate',
            suggestedIncrease: s.suggestedIncrease
        }));
    }

    // ===== ANOMALY DETECTION =====
    async detectAnomalies(financialReports, maintenanceReports) {
        const anomalies = [];
        if (financialReports && financialReports.monthlyRevenue) {
            const data = financialReports.monthlyRevenue.currentYear || [];
            const mean = data.reduce((a,b)=>a+b,0)/data.length;
            const sd = Math.sqrt(data.map(x=>Math.pow(x-mean,2)).reduce((a,b)=>a+b,0)/data.length);
            data.forEach((val, idx) => {
                if (sd && Math.abs(val - mean)/sd > 2) {
                    anomalies.push(`Revenue anomaly in ${financialReports.monthlyRevenue.labels[idx]}`);
                }
            });
        }
        if (maintenanceReports && maintenanceReports.total) {
            maintenanceReports.total.forEach((cost, idx) => {
                if (cost > 3000) anomalies.push(`High maintenance cost ${cost} at index ${idx}`);
            });
        }
        return anomalies;
    }

    // ===== SENTIMENT ANALYSIS =====
    analyzeSentiment(text) {
        if (!text || typeof text !== 'string') return { score: 0, label: 'neutral' };
        text = text.toLowerCase();
        let score = 0;
        this.sentimentLexicon.positive.forEach(w=> { if (text.includes(w)) score++; });
        this.sentimentLexicon.negative.forEach(w=> { if (text.includes(w)) score--; });
        return { score, label: score>0?'positive':score<0?'negative':'neutral' };
    }

    // Analyze seasonality for maintenance costs: returns monthly averages and simple trend
    analyzeMaintenanceSeasonality(maintenanceData) {
        try {
            if (!maintenanceData || !Array.isArray(maintenanceData) || maintenanceData.length === 0) {
                return { monthlyAverages: [], peakMonthIndex: -1, peakMonthName: null };
            }

            // maintenanceData expected as array of { month: <0-11> or label, cost: number }
            const months = new Array(12).fill(0);
            const counts = new Array(12).fill(0);

            maintenanceData.forEach(item => {
                let m = null;
                if (typeof item.month === 'number') m = item.month % 12;
                else if (item.reportedDate) m = new Date(item.reportedDate).getMonth();
                else if (item.createdAt) m = new Date(item.createdAt).getMonth();
                if (m === null || isNaN(m)) return;
                months[m] += Number(item.cost || item.amount || 0);
                counts[m] += 1;
            });

            const monthlyAverages = months.map((sum, i) => counts[i] ? Math.round((sum / counts[i]) * 100) / 100 : 0);
            const peakMonthIndex = monthlyAverages.indexOf(Math.max(...monthlyAverages));
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

            return { monthlyAverages, peakMonthIndex, peakMonthName: monthNames[peakMonthIndex] || null };
        } catch (e) {
            console.warn('⚠️ analyzeMaintenanceSeasonality failed:', e);
            return { monthlyAverages: [], peakMonthIndex: -1, peakMonthName: null };
        }
    }


    // ===== MAINTENANCE FORECASTING =====
    async predictMaintenanceCosts(months = 6) {
        try {
            const maintenanceData = await this.getHistoricalMaintenanceData();
            const predictions = this.calculateMaintenanceForecast(maintenanceData, months);
            
            return {
                monthlyPredictions: predictions,
                seasonalTrend: this.analyzeMaintenanceSeasonality(maintenanceData),
                budgetRecommendation: this.calculateOptimalMaintenanceBudget(predictions),
                highRiskPeriods: this.identifyHighRiskPeriods(predictions)
            };
        } catch (error) {
            console.error('Error predicting maintenance:', error);
            return this.getFallbackMaintenancePredictions(months);
        }
    }

    // ===== CLASSIFIER TRAINING =====
    async trainTenantChurnModel() {
        if (!window.tf || !this.dataManager) return;
        try {
            const landlordId = this.getLandlordId();
            if (!landlordId) return;

            const leases = await this.dataManager.getLandlordLeases(landlordId);
            const payments = await this.dataManager.getPayments(landlordId);
            const maintenance = await this.dataManager.getMaintenanceRequests(landlordId);

            const paymentsByTenant = (payments || []).reduce((acc, p) => {
                const key = p.tenantId || p.tenant || 'unknown';
                acc[key] = acc[key] || [];
                acc[key].push(p);
                return acc;
            }, {});

            const maintenanceByTenant = (maintenance || []).reduce((acc, r) => {
                const key = r.tenantId || r.tenant || 'unknown';
                acc[key] = acc[key] || [];
                acc[key].push(r);
                return acc;
            }, {});

            const features = [];
            const labels = [];

            leases.forEach(lease => {
                const tenantKey = lease.tenantId || lease.tenant || 'unknown';
                const tenantPayments = paymentsByTenant[tenantKey] || [];

                const leaseStart = new Date(lease.leaseStart || lease.startDate || Date.now());
                const leaseEnd = new Date(lease.leaseEnd || lease.endDate || leaseStart);
                const leaseLengthMonths = Math.max(1, Math.round((leaseEnd - leaseStart) / (1000 * 60 * 60 * 24 * 30)));

                const lateCount = tenantPayments.filter(p => {
                    if (!p.paidDate || !p.dueDate) return false;
                    try {
                        return new Date(p.paidDate) > new Date(p.dueDate);
                    } catch {
                        return false;
                    }
                }).length;

                const paymentHistory = tenantPayments.length;
                const maintenanceCount = (maintenanceByTenant[tenantKey] || []).length;
                const rentAmount = lease.rent || lease.monthlyRent || 0;

                features.push([leaseLengthMonths, paymentHistory, lateCount, maintenanceCount, rentAmount]);
                labels.push(['ended', 'moved_out', 'terminated'].includes((lease.status || '').toLowerCase()) ? 1 : 0);
            });

            if (features.length < 5) return;
            this.tenantChurnModel = await this.trainLogisticRegression(features, labels, { outputUnits: 1, epochs: 25 });
        } catch (err) {
            console.warn('⚠️ Tenant churn model training failed:', err);
        }
    }

    async trainRentUnderMarketModel() {
        if (!window.tf || !this.dataManager) return;
        try {
            const landlordId = this.getLandlordId();
            if (!landlordId) return;

            const units = await this.dataManager.getLandlordUnits(landlordId);
            if (!units || !units.length) return;

            // Compute market averages by bedroom count
            const marketByBedrooms = {};
            units.forEach(u => {
                const beds = u.numberOfBedrooms || 0;
                const key = String(beds);
                marketByBedrooms[key] = marketByBedrooms[key] || { total: 0, count: 0 };
                marketByBedrooms[key].total += u.monthlyRent || 0;
                marketByBedrooms[key].count += 1;
            });

            const marketAvg = {};
            Object.entries(marketByBedrooms).forEach(([bed, data]) => {
                marketAvg[bed] = data.count ? data.total / data.count : 0;
            });

            const features = [];
            const labels = [];
            units.forEach(u => {
                const beds = u.numberOfBedrooms || 0;
                const rent = u.monthlyRent || 0;
                const market = marketAvg[String(beds)] || rent;

                // Feature vector: [rent, beds, market]
                features.push([rent, beds, market]);
                labels.push(rent < market * 0.95 ? 1 : 0);
            });

            if (features.length < 5) return;
            this.rentUnderMarketModel = await this.trainLogisticRegression(features, labels, { outputUnits: 1, epochs: 20 });
        } catch (err) {
            console.warn('⚠️ Rent under-market model training failed:', err);
        }
    }

    async trainLatePaymentModel() {
        if (!window.tf || !this.dataManager) return;
        try {
            const landlordId = this.getLandlordId();
            if (!landlordId) return;

            const leases = await this.dataManager.getLandlordLeases(landlordId);
            const payments = await this.dataManager.getPayments(landlordId);

            const paymentsByTenant = (payments || []).reduce((acc, p) => {
                const key = p.tenantId || p.tenant || 'unknown';
                acc[key] = acc[key] || [];
                acc[key].push(p);
                return acc;
            }, {});

            const features = [];
            const labels = [];

            leases.forEach(lease => {
                const tenantKey = lease.tenantId || lease.tenant || 'unknown';
                const tenantPayments = paymentsByTenant[tenantKey] || [];
                const total = tenantPayments.length;
                if (!total) return;

                const late = tenantPayments.filter(p => {
                    if (!p.paidDate || !p.dueDate) return false;
                    try {
                        return new Date(p.paidDate) > new Date(p.dueDate);
                    } catch {
                        return false;
                    }
                }).length;

                const lateRatio = late / total;
                const avgDay = tenantPayments.reduce((sum, p) => {
                    const d = p.paymentDate ? new Date(p.paymentDate) : null;
                    return sum + (d ? d.getDate() : 15);
                }, 0) / total;

                const leaseStart = new Date(lease.leaseStart || lease.startDate || Date.now());
                const leaseEnd = new Date(lease.leaseEnd || lease.endDate || leaseStart);
                const leaseLengthMonths = Math.max(1, Math.round((leaseEnd - leaseStart) / (1000 * 60 * 60 * 24 * 30)));

                const rentAmount = lease.rent || lease.monthlyRent || 0;

                features.push([late, avgDay, leaseLengthMonths, rentAmount]);
                labels.push(lateRatio > 0.4 ? 1 : 0);
            });

            if (features.length < 5) return;
            this.latePaymentModel = await this.trainLogisticRegression(features, labels, { outputUnits: 1, epochs: 25 });
        } catch (err) {
            console.warn('⚠️ Late payment model training failed:', err);
        }
    }

    async trainMaintenanceTriageModel() {
        if (!window.tf || !this.dataManager) return;
        try {
            const landlordId = this.getLandlordId();
            if (!landlordId) return;

            const requests = await this.dataManager.getMaintenanceRequests(landlordId);
            if (!requests || !requests.length) return;

            const tenantRequestCount = requests.reduce((acc, r) => {
                const key = r.tenantId || r.tenant || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            const typeMap = {};
            let nextTypeId = 0;
            const getTypeId = (type) => {
                const key = (type || 'other').toString().toLowerCase();
                if (!typeMap[key]) {
                    typeMap[key] = nextTypeId++;
                }
                return typeMap[key];
            };

            const features = [];
            const labels = [];

            requests.forEach(req => {
                const tenantKey = req.tenantId || req.tenant || 'unknown';
                const typeId = getTypeId(req.type);
                const urgencyWords = ['fire', 'flood', 'electrical', 'leak', 'gas', 'no power', 'broken', 'urgent', 'emergency'];
                const text = (req.notes || req.description || '').toString().toLowerCase();
                const keywordScore = urgencyWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
                const pastRequests = tenantRequestCount[tenantKey] || 1;

                features.push([typeId, keywordScore, pastRequests]);

                const priority = (req.priority || 'medium').toString().toLowerCase();
                // Emergency -> [1,0,0], High -> [0,1,0], Medium/Low -> [0,0,1]
                if (priority === 'emergency') labels.push([1, 0, 0]);
                else if (priority === 'high') labels.push([0, 1, 0]);
                else labels.push([0, 0, 1]);
            });

            if (features.length < 5) return;
            this.maintenanceTriageModel = await this.trainLogisticRegression(features, labels, { outputUnits: 3, epochs: 25 });
        } catch (err) {
            console.warn('⚠️ Maintenance triage model training failed:', err);
        }
    }

    async trainSentimentModel() {
        if (!window.tf) return;
        try {
            // Generate a small synthetic dataset based on lexicon
            const samples = [];
            const labels = [];

            const makeSample = (words, label) => {
                const text = words.join(' ');
                const feat = this.extractSentimentFeatures(text);
                samples.push(feat);
                if (label === 'positive') labels.push([1, 0, 0]);
                else if (label === 'negative') labels.push([0, 1, 0]);
                else labels.push([0, 0, 1]);
            };

            // Positive samples
            this.sentimentLexicon.positive.forEach(word => makeSample([word, 'service', 'great'], 'positive'));
            // Negative samples
            this.sentimentLexicon.negative.forEach(word => makeSample([word, 'service', 'issue'], 'negative'));
            // Neutral samples
            makeSample(['payment', 'update', 'schedule'], 'neutral');
            makeSample(['maintenance', 'request', 'received'], 'neutral');

            if (samples.length < 3) return;
            this.sentimentModel = await this.trainLogisticRegression(samples, labels, { outputUnits: 3, epochs: 25 });
        } catch (err) {
            console.warn('⚠️ Sentiment model training failed:', err);
        }
    }

    extractSentimentFeatures(text = '') {
        const lower = text.toString().toLowerCase();
        const positiveCount = this.sentimentLexicon.positive.reduce((c, w) => c + (lower.includes(w) ? 1 : 0), 0);
        const negativeCount = this.sentimentLexicon.negative.reduce((c, w) => c + (lower.includes(w) ? 1 : 0), 0);
        const length = Math.min(30, lower.split(/\s+/).length);
        return [positiveCount, negativeCount, length];
    }

    async predictRentUnderMarket() {
        const landlordId = this.getLandlordId();
        if (!landlordId || !this.dataManager) return [];

        const units = await this.dataManager.getLandlordUnits(landlordId);
        if (!units.length) return [];

        if (!this.rentUnderMarketModel) {
            await this.trainRentUnderMarketModel();
        }

        if (!this.rentUnderMarketModel) {
            return [];
        }

        const marketByBedrooms = {};
        units.forEach(u => {
            const beds = u.numberOfBedrooms || 0;
            const key = String(beds);
            if (!marketByBedrooms[key]) marketByBedrooms[key] = { total: 0, count: 0 };
            marketByBedrooms[key].total += u.monthlyRent || 0;
            marketByBedrooms[key].count += 1;
        });
        Object.entries(marketByBedrooms).forEach(([k, v]) => { marketByBedrooms[k].avg = v.count ? v.total / v.count : 0; });

        const features = [];
        const meta = [];

        units.forEach(u => {
            const beds = u.numberOfBedrooms || 0;
            const rent = u.monthlyRent || 0;
            const market = marketByBedrooms[String(beds)]?.avg || rent;
            features.push([rent, beds, market]);
            meta.push({ unit: u.id || u.roomNumber, address: u.apartmentAddress || u.apartmentName || '' , currentRent: rent, marketRent: market });
        });

        // If model isn't available (e.g. too few units or training failed), use a simple heuristic
        if (!this.rentUnderMarketModel) {
            try {
                const fallback = meta.map(m => {
                    const market = Number(m.marketRent || 0) || 0;
                    const current = Number(m.currentRent || 0) || 0;
                    const diff = market - current;
                    const probNorm = market > 0 ? Math.min(1, Math.max(0, diff / market)) : 0;
                    return {
                        unit: m.unit,
                        address: m.address || '',
                        probability: Math.round(probNorm * 100),
                        suggestedIncrease: Math.max(0, Math.round(diff)),
                        riskLevel: this.getRiskLabel(probNorm)
                    };
                }).filter(r => r.probability > 20).sort((a, b) => b.probability - a.probability);
                return fallback;
            } catch (e) {
                console.warn('Fallback rent heuristic failed', e);
                return [];
            }
        }

        const input = tf.tensor2d(features);
        const output = this.rentUnderMarketModel.predict(input);
        const probs = Array.from(await output.data());
        input.dispose(); output.dispose();

        return meta.map((m, i) => {
            const prob = Math.min(1, Math.max(0, probs[i] || 0));
            return {
                unit: m.unit,
                address: m.address,
                probability: Math.round(prob * 100),
                suggestedIncrease: Math.max(0, Math.round(m.marketRent - m.currentRent)),
                riskLevel: this.getRiskLabel(prob)
            };
        }).filter(r => r.probability > 20).sort((a, b) => b.probability - a.probability);
    }

    async predictLatePaymentRisk() {
        const landlordId = this.getLandlordId();
        if (!landlordId || !this.dataManager) return [];

        const leases = await this.dataManager.getLandlordLeases(landlordId);
        const payments = await this.dataManager.getPayments(landlordId);

        const paymentsByTenant = (payments || []).reduce((acc, p) => {
            const key = p.tenantId || p.tenant || 'unknown';
            acc[key] = acc[key] || [];
            acc[key].push(p);
            return acc;
        }, {});

        const features = [];
        const meta = [];

        leases.forEach(lease => {
            const tenantKey = lease.tenantId || lease.tenant || 'unknown';
            const tenantPayments = paymentsByTenant[tenantKey] || [];
            const total = tenantPayments.length;
            if (!total) return;

            const late = tenantPayments.filter(p => {
                if (!p.paidDate || !p.dueDate) return false;
                try {
                    return new Date(p.paidDate) > new Date(p.dueDate);
                } catch {
                    return false;
                }
            }).length;

            const daySum = tenantPayments.reduce((sum, p) => {
                const d = p.paymentDate ? new Date(p.paymentDate) : null;
                return sum + (d ? d.getDate() : 15);
            }, 0);

            const avgDay = daySum / total;
            const leaseStart = new Date(lease.leaseStart || lease.startDate || Date.now());
            const leaseEnd = new Date(lease.leaseEnd || lease.endDate || leaseStart);
            const leaseLengthMonths = Math.max(1, Math.round((leaseEnd - leaseStart) / (1000 * 60 * 60 * 24 * 30)));
            const rentAmount = lease.rent || lease.monthlyRent || 0;

            features.push([late, avgDay, leaseLengthMonths, rentAmount]);
            meta.push({ tenant: lease.tenantName || tenantKey, leaseId: lease.id, unit: lease.unit || lease.roomNumber });
        });

        if (!features.length) return [];

        if (!this.latePaymentModel) {
            await this.trainLatePaymentModel();
        }

        if (!this.latePaymentModel) {
            return [];
        }

        const input = tf.tensor2d(features);
        const output = this.latePaymentModel.predict(input);
        const probs = Array.from(await output.data());
        input.dispose(); output.dispose();

        return meta.map((m, i) => {
            const prob = Math.min(1, Math.max(0, probs[i] || 0));
            return {
                tenant: m.tenant,
                unit: m.unit,
                probability: Math.round(prob * 100),
                riskLevel: this.getRiskLabel(prob)
            };
        }).filter(r => r.probability > 40).sort((a,b)=>b.probability-a.probability);
    }

    async predictMaintenanceTriage() {
        const landlordId = this.getLandlordId();
        if (!landlordId || !this.dataManager) return [];

        const requests = await this.dataManager.getMaintenanceRequests(landlordId);
        if (!requests.length) return [];

        if (!this.maintenanceTriageModel) {
            await this.trainMaintenanceTriageModel();
        }

        if (!this.maintenanceTriageModel) {
            return requests.slice(0, 5).map(r => ({
                id: r.id,
                title: r.title || r.description || 'Request',
                priority: (r.priority || 'medium').toUpperCase(),
                recommendedResponse: 'Review within 48 hours',
                confidence: 0.5
            }));
        }

        const urgentWords = ['fire', 'flood', 'electrical', 'leak', 'gas', 'no power', 'broken', 'urgent'];
        const features = [];
        const meta = [];
        const typeMap = {};
        let nextTypeId = 0;

        const getTypeId = (type) => {
            const key = (type || 'other').toString().toLowerCase();
            if (!typeMap[key]) typeMap[key] = nextTypeId++;
            return typeMap[key];
        };

        const tenantRequestCount = requests.reduce((acc, r) => {
            const key = r.tenantId || r.tenant || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        requests.forEach(r => {
            const typeId = getTypeId(r.type);
            const text = (r.notes || r.description || '').toString().toLowerCase();
            const keywordScore = urgentWords.reduce((count, w) => count + (text.includes(w) ? 1 : 0), 0);
            const past = tenantRequestCount[(r.tenantId || r.tenant || 'unknown')] || 1;

            features.push([typeId, keywordScore, past]);
            meta.push({
                id: r.id,
                title: r.title || r.description || 'Maintenance request',
                requestedBy: r.tenantName || r.tenant || 'Unknown'
            });
        });

        const input = tf.tensor2d(features);
        const output = this.maintenanceTriageModel.predict(input);
        const probs = await output.array();
        input.dispose(); output.dispose();

        return meta.map((m, i) => {
            const soft = probs[i] || [0, 0, 0];
            const maxIdx = soft.indexOf(Math.max(...soft));
            const labels = ['EMERGENCY', 'URGENT', 'ROUTINE'];
            return {
                id: m.id,
                title: m.title,
                requestedBy: m.requestedBy,
                priority: labels[maxIdx],
                confidence: Math.round((soft[maxIdx] || 0) * 100),
                responseTime: labels[maxIdx] === 'EMERGENCY' ? 'Within 1 hour' : (labels[maxIdx] === 'URGENT' ? 'Within 24 hours' : 'Within 72 hours')
            };
        }).sort((a, b) => b.confidence - a.confidence);
    }

    async predictTenantSentiment() {
        const landlordId = this.getLandlordId();
        if (!landlordId || !this.dataManager) return { label: 'neutral', confidence: 0, score: 0 };

        const maintenance = await this.dataManager.getMaintenanceRequests(landlordId);
        const sampleText = (maintenance || []).slice(-5).map(r => (r.notes || r.description || '')).join(' ');
        const text = sampleText || 'No recent messages';

        if (!this.sentimentModel) {
            await this.trainSentimentModel();
        }

        const features = this.extractSentimentFeatures(text);
        if (!this.sentimentModel) {
            const score = this.sentimentLexicon.positive.reduce((c, w) => c + (text.toLowerCase().includes(w) ? 1 : 0), 0) -
                          this.sentimentLexicon.negative.reduce((c, w) => c + (text.toLowerCase().includes(w) ? 1 : 0), 0);
            const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
            return { label, confidence: 0.6, score };
        }

        const input = tf.tensor2d([features]);
        const output = this.sentimentModel.predict(input);
        const probs = Array.from(await output.data());
        input.dispose(); output.dispose();

        const maxIdx = probs.indexOf(Math.max(...probs));
        const labels = ['positive', 'negative', 'neutral'];
        const label = labels[maxIdx] || 'neutral';
        const confidence = Math.round((probs[maxIdx] || 0) * 100);
        const score = (probs[0] - probs[1]) * 100;

        return { label, confidence, score, sampleText: text };    }

    // ===== CORE ALGORITHMS =====
    calculateRevenueForecast(historicalData, months) {
        const weights = [0.1, 0.2, 0.3, 0.4]; // Weighted moving average
        const predictions = [];
        
        for (let i = 0; i < months; i++) {
            let prediction = 0;
            let totalWeight = 0;
            
            for (let j = 0; j < weights.length; j++) {
                const dataIndex = historicalData.length - weights.length + j;
                if (dataIndex >= 0 && dataIndex < historicalData.length) {
                    prediction += historicalData[dataIndex].revenue * weights[j];
                    totalWeight += weights[j];
                }
            }
            
            // Apply trend
            const trend = this.calculateTrend(historicalData);
            prediction = (prediction / totalWeight) * (1 + trend * (i + 1) * 0.1);
            predictions.push(Math.round(prediction));
        }
        
        return predictions;
    }

    calculateOccupancyPredictions(leases, currentOccupancy, months) {
        const today = new Date();
        const predictions = [];
        
        for (let i = 0; i < months; i++) {
            const futureDate = new Date();
            futureDate.setMonth(today.getMonth() + i + 1);
            
            // Count leases ending in this period
            const endingLeases = leases.filter(lease => {
                const leaseEnd = new Date(lease.leaseEnd);
                const monthDiff = (futureDate.getFullYear() - leaseEnd.getFullYear()) * 12 + 
                                (futureDate.getMonth() - leaseEnd.getMonth());
                return Math.abs(monthDiff) <= 1;
            }).length;
            
            const predictedOccupancy = Math.max(0, currentOccupancy - (endingLeases / leases.length * 100));
            predictions.push(Math.round(predictedOccupancy * 100) / 100);
        }
        
        return predictions;
    }

    calculateMaintenanceForecast(maintenanceData, months) {
        const baseCost = maintenanceData.length > 0 ? 
            maintenanceData.reduce((sum, item) => sum + item.cost, 0) / maintenanceData.length : 2150;
        
        const predictions = [];
        const currentMonth = new Date().getMonth();
        
        for (let i = 0; i < months; i++) {
            const seasonalFactor = this.getSeasonalFactor((currentMonth + i) % 12);
            const predictedCost = baseCost * seasonalFactor * (1 + (i * 0.02));
            predictions.push(Math.round(predictedCost));
        }
        
        return predictions;
    }

    // ===== DATA COLLECTION =====
    async getHistoricalRevenueData() {
        try {
            const payments = await this.dataManager.getPayments(this.dataManager.currentUser.uid);
            const monthlyRevenue = {};
            
            payments.forEach(payment => {
                if (payment.status === 'completed' && payment.paymentDate) {
                    const date = new Date(payment.paymentDate);
                    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                    
                    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (payment.amount || 0);
                }
            });
            
            return Object.entries(monthlyRevenue)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, revenue], index) => ({
                    month,
                    revenue,
                    period: index + 1
                }));
        } catch (error) {
            console.error('Error getting historical revenue data:', error);
            return this.generateSampleRevenueData();
        }
    }

    async getHistoricalMaintenanceData() {
        try {
            const maintenance = await this.dataManager.getMaintenanceRequests(this.dataManager.currentUser.uid);
            const monthlyCosts = {};
            
            maintenance.forEach(request => {
                if (request.actualCost && request.completedDate) {
                    const date = new Date(request.completedDate);
                    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                    monthlyCosts[monthKey] = (monthlyCosts[monthKey] || 0) + request.actualCost;
                }
            });
            
            return Object.entries(monthlyCosts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, cost]) => ({ month, cost }));
        } catch (error) {
            console.error('Error getting maintenance data:', error);
            return this.generateSampleMaintenanceData();
        }
    }

    async calculateCurrentOccupancy(leases) {
        const activeLeases = leases.filter(lease => lease.isActive && lease.status === 'active');
        const totalUnits = 20; // As per your dashboard
        return (activeLeases.length / totalUnits) * 100;
    }

    // ===== UTILITY METHODS =====
    calculateTrend(data) {
        if (data.length < 2) return 0;
        const first = data[0].revenue;
        const last = data[data.length - 1].revenue;
        return (last - first) / first;
    }

    calculateConfidence(data, monthsAhead) {
        const baseConfidence = 0.85;
        const dataQuality = Math.min(1, data.length / 6);
        const timePenalty = monthsAhead * 0.1;
        return Math.max(0.3, baseConfidence * dataQuality - timePenalty);
    }

    calculateModelAccuracy(data) {
        if (data.length < 6) return 0.7;
        return 0.6 + (Math.min(1, data.length / 12) * 0.3);
    }

    getSeasonalFactor(month) {
        // Higher maintenance in certain months
        const seasonalFactors = {
            0: 1.1,  // Jan - post-holiday issues
            1: 1.0,  // Feb
            2: 0.9,  // Mar
            3: 0.9,  // Apr
            4: 1.0,  // May
            5: 1.2,  // Jun - summer, AC issues
            6: 1.3,  // Jul - peak summer
            7: 1.1,  // Aug
            8: 1.0,  // Sep
            9: 0.9,  // Oct
            10: 0.8, // Nov
            11: 1.1  // Dec - winter issues
        };
        return seasonalFactors[month] || 1.0;
    }

    identifyOccupancyRisks(leases) {
        const today = new Date();
        const ninetyDaysFromNow = new Date(today);
        ninetyDaysFromNow.setDate(today.getDate() + 90);
        
        return leases.filter(lease => {
            const leaseEnd = new Date(lease.leaseEnd);
            return leaseEnd <= ninetyDaysFromNow && leaseEnd >= today;
        }).map(lease => ({
            unit: lease.roomNumber,
            tenant: lease.tenantName,
            endDate: lease.leaseEnd,
            daysUntilEnd: Math.ceil((new Date(lease.leaseEnd) - today) / (1000 * 60 * 60 * 24))
        }));
    }

    generateOccupancyRecommendation(predictions, riskFactors) {
        const avgFutureOccupancy = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        
        if (avgFutureOccupancy < 85) return 'High vacancy risk - consider marketing campaigns';
        if (riskFactors.length > 2) return 'Multiple leases ending soon - focus on renewals';
        if (avgFutureOccupancy > 95) return 'Strong occupancy - maintain current strategy';
        return 'Stable occupancy - monitor lease expirations';
    }

    calculateOptimalMaintenanceBudget(predictions) {
        const avgPredicted = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        return Math.round(avgPredicted * 1.2); // 20% buffer
    }

    identifyHighRiskPeriods(predictions) {
        const highThreshold = 2500;
        return predictions
            .map((cost, index) => ({ month: index + 1, cost, isHighRisk: cost > highThreshold }))
            .filter(period => period.isHighRisk);
    }

    // ===== FALLBACK METHODS =====
    getFallbackRevenueForecast(months) {
        const baseRevenue = 84500;
        const predictions = Array(months).fill(0).map((_, i) => 
            Math.round(baseRevenue * (1 + (i * 0.02)))
        );
        
        return {
            predictions,
            confidence: Array(months).fill(0.7),
            trend: 0.02,
            accuracy: 0.75,
            nextMonthPrediction: predictions[0],
            growthRate: '2.0'
        };
    }

    getFallbackOccupancyPredictions(months) {
        return {
            predictions: Array(months).fill(94),
            currentOccupancy: 94,
            riskFactors: [],
            atRiskUnits: 0,
            recommendation: 'Insufficient data for detailed analysis'
        };
    }

    getFallbackMaintenancePredictions(months) {
        return {
            monthlyPredictions: Array(months).fill(2150),
            seasonalTrend: 'stable',
            budgetRecommendation: 2580,
            highRiskPeriods: []
        };
    }

    // ===== SAMPLE DATA GENERATORS =====
    generateSampleRevenueData() {
        const baseRevenue = 72000;
        return Array(6).fill(0).map((_, i) => ({
            month: `2024-${i}`,
            revenue: baseRevenue + (i * 1500) + (Math.random() * 3000 - 1500),
            period: i + 1
        }));
    }

    generateSampleMaintenanceData() {
        const baseCost = 1800;
        return Array(6).fill(0).map((_, i) => ({
            month: `2024-${i}`,
            cost: baseCost + (Math.random() * 800 - 400)
        }));
    }
}

window.PredictiveAnalytics = PredictiveAnalytics;

