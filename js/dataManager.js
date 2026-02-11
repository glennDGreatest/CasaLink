// js/dataManager.js - CLEANED & ORGANIZED VERSION
class DataManager {
    static isOnline = navigator.onLine;

    static init() {
        // Listen for online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        console.log('✅ DataManager initialized');
    }

    static async getLandlordUnits(landlordId) {
        try {
            console.log('📡 Fetching units for landlord:', landlordId);
            
            // Query rooms collection and convert to unit format
            const query = firebaseDb.collection('rooms')
                .where('landlordId', '==', landlordId)
                .orderBy('floor')
                .orderBy('roomNumber');

            const querySnapshot = await query.get();
            
            console.log('📊 Query snapshot size:', querySnapshot.size);
            
            const units = querySnapshot.docs.map(doc => {
                const room = doc.data();
                const floor = parseInt(room.floor) || room.floor;
                
                return {
                    id: doc.id,
                    roomNumber: room.roomNumber,
                    unitNumber: room.roomNumber, // For compatibility
                    floor: floor,
                    apartmentId: room.apartmentId || null,
                    apartmentAddress: room.apartmentAddress || '', // ADDED: Include apartment address for filtering
                    status: room.isAvailable === false ? 'occupied' : 'vacant', // Map isAvailable to status
                    tenantName: room.occupiedBy ? 'Occupied' : 'Vacant',
                    occupiedBy: room.occupiedBy,
                    numberOfMembers: room.numberOfMembers || 0,
                    maxMembers: room.maxMembers || 0,
                    monthlyRent: room.monthlyRent || 0,
                    numberOfBedrooms: room.numberOfBedrooms || 0,
                    numberOfBathrooms: room.numberOfBathrooms || 0,
                    isAvailable: room.isAvailable,
                    securityDeposit: room.securityDeposit || 0,
                    occupiedAt: room.occupiedAt,
                    createdAt: room.createdAt,
                    updatedAt: room.updatedAt
                };
            });
            
            console.log('✅ Total units fetched:', units.length);
            return units;
        } catch (error) {
            console.error('❌ Error fetching landlord units:', error);
            return [];
        }
    }

    static async getUnitsWithRealtimeUpdates(landlordId, callback) {
        try {
            console.log('📡 Setting up real-time listener for units, landlord:', landlordId);
            
            if (!landlordId) {
                console.error('❌ No landlordId provided for real-time listener');
                return null;
            }
            
            // Set up the real-time listener for rooms collection
            const unsubscribe = firebaseDb
                .collection('rooms')
                .where('landlordId', '==', landlordId)
                .onSnapshot(
                    (snapshot) => {
                        console.log('📡 Firestore snapshot received');
                        console.log('   - Total docs:', snapshot.size);
                        console.log('   - Changes:', snapshot.docChanges().length);
                        
                        // Log change types
                        snapshot.docChanges().forEach(change => {
                            console.log(`   - ${change.type.toUpperCase()}: ${change.doc.id}`);
                        });
                        
                        const units = [];
                        snapshot.forEach(doc => {
                            const room = doc.data();
                            const floor = parseInt(room.floor) || room.floor;
                            
                            units.push({
                                id: doc.id,
                                roomNumber: room.roomNumber,
                                unitNumber: room.roomNumber, // For compatibility
                                floor: floor,
                                status: room.isAvailable ? 'vacant' : 'occupied',
                                tenantName: room.occupiedBy ? `Tenant` : '',
                                occupiedBy: room.occupiedBy,
                                numberOfMembers: room.numberOfMembers,
                                maxMembers: room.maxMembers,
                                monthlyRent: room.monthlyRent,
                                numberOfBedrooms: room.numberOfBedrooms,
                                numberOfBathrooms: room.numberOfBathrooms,
                                isAvailable: room.isAvailable,
                                occupiedAt: room.occupiedAt,
                                createdAt: room.createdAt,
                                updatedAt: room.updatedAt,
                                ...room
                            });
                        });
                        
                        // Validate units have required fields
                        const validUnits = units.filter(u => u.floor && u.roomNumber && u.status !== undefined);
                        if (validUnits.length !== units.length) {
                            console.warn(`⚠️ Filtered out ${units.length - validUnits.length} invalid units`);
                        }
                        
                        // Call the callback with updated units
                        if (callback && typeof callback === 'function') {
                            try {
                                console.log('✅ Calling callback with', validUnits.length, 'valid units');
                                callback(validUnits);
                            } catch (callbackError) {
                                console.error('❌ Error in callback function:', callbackError);
                            }
                        } else {
                            console.warn('⚠️ No callback function provided for real-time updates');
                        }
                    },
                    (error) => {
                        console.error('❌ Error in real-time listener:', error);
                        console.error('   - Error code:', error.code);
                        console.error('   - Error message:', error.message);
                        if (window.ToastManager) {
                            ToastManager.showToast('Error receiving real-time updates. Please refresh.', 'error');
                        }
                    }
                );
            
            console.log('✅ Real-time listener setup complete');
            return unsubscribe;
            
        } catch (error) {
            console.error('❌ Error setting up real-time listener:', error);
            if (window.ToastManager) {
                ToastManager.showToast('Error setting up real-time updates.', 'error');
            }
            return null;
        }
    }

    static async getUnitDetails(unitId) {
        try {
            const unitDoc = await firebaseDb.collection('room').doc(unitId).get();
            
            if (!unitDoc.exists) {
                return null;
            }
            
            const unitData = {
                id: unitDoc.id,
                ...unitDoc.data()
            };
            
            // Fetch current lease if unit is occupied
            if (unitData.status === 'occupied') {
                const leasesQuery = await firebaseDb.collection('leases')
                    .where('unitId', '==', unitId)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();
                
                if (!leasesQuery.empty) {
                    const lease = leasesQuery.docs[0];
                    unitData.currentLease = {
                        id: lease.id,
                        ...lease.data()
                    };
                    
                    // Fetch tenant information
                    if (unitData.currentLease.tenantId) {
                        const tenantDoc = await firebaseDb.collection('users')
                            .doc(unitData.currentLease.tenantId)
                            .get();
                        
                        if (tenantDoc.exists) {
                            unitData.currentTenant = {
                                id: tenantDoc.id,
                                ...tenantDoc.data()
                            };
                        }
                    }
                }
            }
            
            return unitData;
        } catch (error) {
            console.error('Error fetching unit details:', error);
            return null;
        }
    }

    async getTenants(landlordId) {
        // If called as instance method and no landlordId provided, check this.user
        if (!landlordId && this.user) {
            landlordId = this.user.uid;
        }
        // If still no landlordId, check window.currentUser or context
        if (!landlordId && typeof window !== 'undefined' && window.currentUser) {
            landlordId = window.currentUser.uid;
        }
        if (!landlordId) throw new Error('User not authenticated');
        
        try {
            const snapshot = await firebaseDb.collection('tenants')
                .where('landlordId', '==', landlordId)
                .get();
            
            const tenants = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Tenants loaded:', tenants.length);
            return tenants;
        } catch (error) {
            console.error('❌ Error getting tenants:', error);
            return [];
        }
    }

    static async getProperties(landlordId) {
        // If no landlordId provided, check window.currentUser
        if (!landlordId && typeof window !== 'undefined' && window.currentUser) {
            landlordId = window.currentUser.uid;
        }
        if (!landlordId) throw new Error('User not authenticated');
        
        try {
            const snapshot = await firebaseDb.collection('properties')
                .where('landlordId', '==', landlordId)
                .get();
            
            const properties = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Properties loaded:', properties.length);
            return properties;
        } catch (error) {
            console.error('❌ Error getting properties:', error);
            return [];
        }
    }

    static async getLandlordApartments(landlordId) {
        // If no landlordId provided, check window.currentUser
        if (!landlordId && typeof window !== 'undefined' && window.currentUser) {
            landlordId = window.currentUser.uid;
        }
        if (!landlordId) throw new Error('User not authenticated');
        
        try {
            console.log('🏢 Fetching apartments for landlord:', landlordId);
            
            const snapshot = await firebaseDb.collection('apartments')
                .where('landlordId', '==', landlordId)
                .where('isActive', '==', true)
                .orderBy('createdAt', 'desc')
                .get();
            
            const apartments = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Apartments loaded:', apartments.length);
            return apartments;
        } catch (error) {
            console.error('❌ Error getting apartments:', error);
            return [];
        }
    }

    static async createApartment(apartmentData) {
        if (!apartmentData) throw new Error('Missing apartment data');
        try {
            const landlordId = apartmentData.landlordId || (typeof window !== 'undefined' && window.currentUser ? window.currentUser.uid : null);
            if (!landlordId) throw new Error('User not authenticated');

            const payload = {
                landlordId,
                landlordName: apartmentData.landlordName || '',
                apartmentAddress: apartmentData.apartmentAddress || '',
                numberOfRooms: apartmentData.numberOfRooms || 0,
                description: apartmentData.description || '',
                isActive: apartmentData.isActive === undefined ? true : !!apartmentData.isActive,
                createdAt: apartmentData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = await firebaseDb.collection('apartments').add(payload);
            console.log('✅ Apartment created with ID:', docRef.id);
            return { id: docRef.id, ...payload };
        } catch (error) {
            console.error('❌ Error creating apartment:', error);
            throw error;
        }
    }

    static async createApartmentWithRooms(apartmentData, roomsData) {
        if (!apartmentData || !roomsData || roomsData.length === 0) {
            throw new Error('Missing apartment or rooms data');
        }

        try {
            const landlordId = apartmentData.landlordId || (typeof window !== 'undefined' && window.currentUser ? window.currentUser.uid : null);
            if (!landlordId) throw new Error('User not authenticated');

            const now = new Date().toISOString();

            // Create apartment
            const apartmentPayload = {
                landlordId,
                landlordName: apartmentData.landlordName || '',
                apartmentName: apartmentData.apartmentName || apartmentData.apartmentName || '',
                apartmentAddress: apartmentData.apartmentAddress || '',
                numberOfRooms: apartmentData.numberOfRooms || 0,
                numberOfFloors: apartmentData.numberOfFloors || 1,
                description: apartmentData.description || '',
                isActive: true,
                createdAt: now,
                updatedAt: now
            };

            const apartmentRef = await firebaseDb.collection('apartments').add(apartmentPayload);
            console.log('✅ Apartment created with ID:', apartmentRef.id);

            // Batch create rooms
            const batch = firebaseDb.batch();
            roomsData.forEach((room) => {
                const roomPayload = {
                    landlordId,
                    apartmentId: apartmentRef.id,
                    apartmentAddress: apartmentData.apartmentAddress,
                    apartmentName: apartmentPayload.apartmentName || '',
                    roomNumber: room.roomNumber || '',
                    floor: String(room.floor || '1'),
                    monthlyRent: parseFloat(room.monthlyRent) || 0,
                    securityDeposit: parseFloat(room.securityDeposit) || 0,
                    numberOfBedrooms: parseInt(room.numberOfBedrooms, 10) || 0,
                    numberOfBathrooms: parseFloat(room.numberOfBathrooms) || 0,
                    maxMembers: parseInt(room.maxMembers, 10) || 1,
                    numberOfMembers: 0,
                    isAvailable: true,
                    createdAt: now,
                    updatedAt: now
                };

                const roomRef = firebaseDb.collection('rooms').doc();
                batch.set(roomRef, roomPayload);
            });

            await batch.commit();
            console.log('✅ Batch created', roomsData.length, 'rooms');

            return {
                apartmentId: apartmentRef.id,
                apartmentData: { id: apartmentRef.id, ...apartmentPayload },
                roomsCreated: roomsData.length
            };
        } catch (error) {
            console.error('❌ Error creating apartment with rooms:', error);
            throw error;
        }
    }

    static async getLease(leaseId) {
        if (!leaseId) throw new Error('Missing leaseId');
        try {
            const doc = await firebaseDb.collection('leases').doc(leaseId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('❌ Error getting lease:', error);
            throw error;
        }
    }

    
    async updateLease(leaseId, updates) {
        // If no user context, check window.currentUser
        const userId = (this.user && this.user.uid) || (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid);
        if (!userId) throw new Error('User not authenticated');
        
        try {
            await firebaseDb.collection('leases').doc(leaseId).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error updating lease:', error);
            throw error;
        }
    }
    
    async deleteLease(leaseId) {
        // If no user context, check window.currentUser
        const userId = (this.user && this.user.uid) || (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid);
        if (!userId) throw new Error('User not authenticated');
        
        try {
            await firebaseDb.collection('leases').doc(leaseId).delete();
            console.log('✅ Lease deleted:', leaseId);
        } catch (error) {
            console.error('❌ Error deleting lease:', error);
            throw error;
        }
    }

    generateId() {
        return 'lease_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }


    async createLease(leaseData) {
        // If no user context, check window.currentUser
        const userId = (this.user && this.user.uid) || (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid);
        if (!userId) throw new Error('User not authenticated');
        
        try {
            const lease = {
                ...leaseData,
                id: this.generateId(),
                landlordId: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await firebaseDb.collection('leases').doc(lease.id).set(lease);
            console.log('✅ Lease created:', lease.id);
            return lease;
        } catch (error) {
            console.error('❌ Error creating lease:', error);
            throw error;
        }
    }

    static testDueDateCalculation() {
        const testLease = {
            paymentDueDay: 15, // 15th of each month
            monthlyRent: 5000,
            isActive: true
        };
        
        const testBills = [];
        
        const nextDueDate = this.calculateNextDueDate(testLease, testBills);
        console.log('🧪 Test due date calculation:', {
            paymentDay: testLease.paymentDueDay,
            calculatedDueDate: nextDueDate,
            formattedDate: nextDueDate ? nextDueDate.toLocaleDateString() : 'N/A'
        });
        
        return nextDueDate;
    }

    static async applyLateFees() {
        try {
            const settings = await this.getBillingSettings();
            if (!settings.autoLateFees) {
                console.log('⏸️ Auto late fees disabled');
                return { applied: 0 };
            }

            const today = new Date();
            const lateFeeDate = new Date();
            lateFeeDate.setDate(today.getDate() - settings.lateFeeAfterDays);

            // Find overdue bills without late fees
            const overdueBills = await firebaseDb.collection('bills')
                .where('status', '==', 'pending')
                .where('dueDate', '<=', lateFeeDate.toISOString())
                .where('lateFeeApplied', '==', false)
                .get();

            let appliedCount = 0;
            const batch = firebaseDb.batch();

            overdueBills.forEach(doc => {
                const bill = doc.data();
                const lateFeeItem = {
                    description: `Late Fee (${settings.lateFeeAfterDays} days overdue)`,
                    amount: settings.lateFeeAmount,
                    type: 'late_fee',
                    appliedDate: new Date().toISOString()
                };

                // Update bill with late fee
                const updatedItems = [...(bill.items || []), lateFeeItem];
                const updatedAmount = updatedItems.reduce((sum, item) => sum + item.amount, 0);

                batch.update(doc.ref, {
                    items: updatedItems,
                    totalAmount: updatedAmount,
                    lateFeeApplied: true,
                    lateFeeDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                appliedCount++;
            });

            if (appliedCount > 0) {
                await batch.commit();
                console.log(`✅ Applied late fees to ${appliedCount} bills`);
            }

            return { applied: appliedCount };
        } catch (error) {
            console.error('Error applying late fees:', error);
            throw error;
        }
    }

    static async createCustomBill(billData) {
        try {
            const billRef = await firebaseDb.collection('bills').add({
                ...billData,
                createdAt: new Date().toISOString(),
                status: 'pending',
                isAutoGenerated: false,
                isPaymentVerified: false
            });
            console.log('✅ Custom bill created:', billRef.id);
            return billRef.id;
        } catch (error) {
            console.error('Error creating custom bill:', error);
            throw error;
        }
    }
    
    static async updateBillingSettings(updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await firebaseDb.collection('billingSettings').doc('default').update(updates);
            console.log('✅ Billing settings updated');
            return true;
        } catch (error) {
            console.error('Error updating billing settings:', error);
            throw error;
        }
    }

    static getOrdinalSuffix(day) {
        if (!day || typeof day !== 'number') return '';
        
        if (day >= 11 && day <= 13) return 'th';
        
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    static async createMaintenanceRequest(requestData) {
        try {
            console.log('🔧 Creating maintenance request:', requestData);
            
            const requestRef = await firebaseDb.collection('maintenance').add({
                ...requestData,
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Maintenance request created:', requestRef.id);
            return requestRef.id;
        } catch (error) {
            console.error('❌ Error creating maintenance request:', error);
            throw error;
        }
    }

    static async getMaintenanceRequests(landlordId, filters = {}) {
        try {
            let query = firebaseDb.collection('maintenance')
                .where('landlordId', '==', landlordId)
                .orderBy('createdAt', 'desc');

            // Apply filters
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.priority) {
                query = query.where('priority', '==', filters.priority);
            }
            if (filters.type) {
                query = query.where('type', '==', filters.type);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance requests:', error);
            return [];
        }
    }

    static async getMaintenanceRequest(requestId) {
        try {
            const requestDoc = await firebaseDb.collection('maintenance').doc(requestId).get();
            if (requestDoc.exists) {
                return { id: requestDoc.id, ...requestDoc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting maintenance request:', error);
            throw error;
        }
    }

    static async updateMaintenanceRequest(requestId, updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await firebaseDb.collection('maintenance').doc(requestId).update(updates);
            console.log('✅ Maintenance request updated:', requestId);
            return true;
        } catch (error) {
            console.error('❌ Error updating maintenance request:', error);
            throw error;
        }
    }

    static async getMaintenancePriorities() {
        return [
            { id: 'low', name: 'Low', color: 'var(--success)', icon: 'fas fa-arrow-down' },
            { id: 'medium', name: 'Medium', color: 'var(--warning)', icon: 'fas fa-minus' },
            { id: 'high', name: 'High', color: 'var(--danger)', icon: 'fas fa-arrow-up' },
            { id: 'emergency', name: 'Emergency', color: 'var(--danger)', icon: 'fas fa-exclamation-triangle' }
        ];
    }

    static async getMaintenanceTypes() {
        return [
            { id: 'general', name: 'General Maintenance', icon: 'fas fa-tools' },
            { id: 'plumbing', name: 'Plumbing', icon: 'fas fa-faucet' },
            { id: 'electrical', name: 'Electrical', icon: 'fas fa-bolt' },
            { id: 'hvac', name: 'HVAC', icon: 'fas fa-wind' },
            { id: 'appliance', name: 'Appliance', icon: 'fas fa-blender' },
            { id: 'structural', name: 'Structural', icon: 'fas fa-home' },
            { id: 'pest_control', name: 'Pest Control', icon: 'fas fa-bug' },
            { id: 'other', name: 'Other', icon: 'fas fa-question-circle' }
        ];
    }

    static async getMaintenanceStats(landlordId) {
        try {
            const requests = await this.getMaintenanceRequests(landlordId);
            
            const now = new Date();
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
            
            return {
                total: requests.length,
                open: requests.filter(r => r.status === 'open').length,
                inProgress: requests.filter(r => r.status === 'in-progress').length,
                completed: requests.filter(r => r.status === 'completed').length,
                highPriority: requests.filter(r => r.priority === 'high' || r.priority === 'emergency').length,
                recent: requests.filter(r => new Date(r.createdAt) > thirtyDaysAgo).length,
                byType: this.groupBy(requests, 'type'),
                byStatus: this.groupBy(requests, 'status')
            };
        } catch (error) {
            console.error('Error getting maintenance stats:', error);
            return {};
        }
    }

    static async addMaintenanceStaff(staffData) {
        try {
            const staffWithMeta = {
                ...staffData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = await firebaseDb.collection('maintenanceStaff').add(staffWithMeta);
            console.log('✅ Maintenance staff added:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error adding maintenance staff:', error);
            throw error;
        }
    }

    static async getMaintenanceStaff(landlordId) {
        try {
            const snapshot = await firebaseDb.collection('maintenanceStaff')
                .where('landlordId', '==', landlordId)
                .where('isActive', '==', true)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance staff:', error);
            return [];
        }
    }

    // Helper method
    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const val = item[key];
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
        }, {});
    }

    static maintenanceRequestSchema = {
        id: '', // Firestore document ID
        title: '',
        description: '',
        unitId: '',
        propertyId: '',
        tenantId: '',
        landlordId: '',
        status: 'open', // open, assigned, in-progress, completed
        priority: 'medium', // low, medium, high, emergency
        createdAt: '',
        updatedAt: ''
    };

    static maintenanceStaffSchema = {
        id: '',
        name: '',
        email: '',
        phone: '',
        type: 'internal', // internal, external_contractor
        specialty: 'general', // general, plumbing, electrical, etc.
        hourlyRate: 0,
        isActive: true,
        createdAt: '',
        landlordId: ''
    };

    static async createDefaultBillingSettings() {
        const defaultSettings = {
            autoBillingEnabled: true,
            defaultPaymentDay: 5,
            lateFeeAmount: 500,
            gracePeriodDays: 3,
            autoLateFees: true,
            lateFeeAfterDays: 5,
            includeUtilities: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await firebaseDb.collection('billingSettings').doc('default').set(defaultSettings);
        console.log('✅ Created default billing settings');
        return defaultSettings;
    }

    

    static async getBillingSettings() {
        try {
            console.log('🔄 Loading billing settings...');
            const settingsDoc = await firebaseDb.collection('billingSettings').doc('default').get();
            
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                console.log('✅ Billing settings loaded:', settings);
                return settings;
            } else {
                console.log('📝 No billing settings found, creating defaults...');
                return await this.createDefaultBillingSettings();
            }
        } catch (error) {
            console.error('❌ Error getting billing settings:', error);
            // Return default settings even if there's an error
            return {
                autoBillingEnabled: true,
                defaultPaymentDay: 5,
                lateFeeAmount: 500,
                gracePeriodDays: 3,
                autoLateFees: true,
                lateFeeAfterDays: 5
            };
        }
    }


    static async getBillsWithTenants(landlordId) {
        try {
            console.log('💰 Fetching bills with tenant data for landlord:', landlordId);
            
            const billsSnapshot = await firebaseDb.collection('bills')
                .where('landlordId', '==', landlordId)
                .orderBy('dueDate', 'desc')
                .get();
                
            const bills = billsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ Found ${bills.length} bills for landlord`);
            return bills;
            
        } catch (error) {
            console.error('❌ Error getting bills with tenants:', error);
            return [];
        }
    }

    static async getActiveLeases() {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('isActive', '==', true)
                .get();
                
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting active leases:', error);
            return [];
        }
    }

    static async getPaymentStats(landlordId) {
        try {
            const payments = await this.getPayments(landlordId);
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            // Filter completed and verified payments (both are confirmed)
            const confirmedPayments = payments.filter(p => 
                p.status === 'completed' || p.status === 'verified'
            );
            
            // Payments still waiting verification
            const pendingVerificationPayments = payments.filter(p => 
                p.status === 'waiting_verification' || p.status === 'pending_verification'
            );

            // Total collected (only confirmed payments count)
            const totalCollected = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);

            // This month's collection
            const monthlyPayments = confirmedPayments.filter(payment => {
                const paymentDate = new Date(payment.paymentDate);
                return paymentDate.getMonth() === currentMonth && 
                    paymentDate.getFullYear() === currentYear;
            });
            const monthlyCollected = monthlyPayments.reduce((sum, payment) => sum + payment.amount, 0);

            // Payment methods count
            const methodCount = new Set(confirmedPayments.map(p => p.paymentMethod)).size;

            // Average payment
            const averagePayment = confirmedPayments.length > 0 ? totalCollected / confirmedPayments.length : 0;

            return {
                totalCollected,
                monthlyCollected,
                methodCount,
                averagePayment,
                totalTransactions: confirmedPayments.length,
                monthlyTransactions: monthlyPayments.length,
                pendingVerificationAmount: pendingVerificationPayments.reduce((sum, p) => sum + p.amount, 0),
                pendingVerificationCount: pendingVerificationPayments.length
            };
        } catch (error) {
            console.error('Error getting payment stats:', error);
            throw error;
        }
    }

    static async getPayments(landlordId, filters = {}) {
        try {
            let query = firebaseDb.collection('payments')
                .where('landlordId', '==', landlordId)
                .orderBy('paymentDate', 'desc');

            // Apply filters
            if (filters.method && filters.method !== 'all') {
                query = query.where('paymentMethod', '==', filters.method);
            }

            if (filters.status && filters.status !== 'all') {
                query = query.where('status', '==', filters.status);
            }

            if (filters.month) {
                const startDate = new Date(filters.month + '-01');
                const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                
                query = query.where('paymentDate', '>=', startDate.toISOString())
                            .where('paymentDate', '<=', endDate.toISOString());
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting payments:', error);
            throw error;
        }
    }

    // ===== REMOVED DUPLICATE - See single definition below =====

    static async getTenantPayments(tenantId) {
        try {
            console.log('💰 Fetching payments for tenant:', tenantId);
            
            const querySnapshot = await firebaseDb.collection('payments')
                .where('tenantId', '==', tenantId)
                .orderBy('paymentDate', 'desc')
                .get();
            
            const payments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('✅ Fetched', payments.length, 'payments for tenant');
            return payments;
            
        } catch (error) {
            console.error('❌ Error getting tenant payments:', error);
            return [];
        }
    }

    static async getPaymentMethods() {
        return [
            { id: 'cash', name: 'Cash', icon: 'fas fa-money-bill' },
            { id: 'gcash', name: 'GCash', icon: 'fas fa-mobile-alt' },
            { id: 'maya', name: 'Maya', icon: 'fas fa-wallet' },
            { id: 'bank_transfer', name: 'Bank Transfer', icon: 'fas fa-university' },
            { id: 'check', name: 'Check', icon: 'fas fa-money-check' }
        ];
    }

    static async generateMonthlyBills() {
        try {
            console.log('💰 Generating monthly bills for all active leases...');
            
            const leases = await this.getActiveLeases();
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const settings = await this.getBillingSettings();
            
            let generatedCount = 0;
            let skippedCount = 0;
            
            const billPromises = leases.map(async (lease) => {
                // Enhanced validation
                if (!lease.isActive) {
                    skippedCount++;
                    return;
                }
                
                if (!lease.monthlyRent || lease.monthlyRent <= 0) {
                    console.warn(`⚠️ Skipping ${lease.tenantName}: Invalid rent amount`);
                    skippedCount++;
                    return;
                }
                
                // Check for existing bill this month (ENHANCED DEDUPLICATION TO PREVENT RACE CONDITIONS)
                // First check: Look for any bill in this month's due date range
                const existingBill = await firebaseDb.collection('bills')
                    .where('tenantId', '==', lease.tenantId)
                    .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                    .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                    .limit(1)
                    .get();
                
                // Second check: Look for auto-generated bills to prevent race condition duplicates
                const autoGenBill = await firebaseDb.collection('bills')
                    .where('tenantId', '==', lease.tenantId)
                    .where('isAutoGenerated', '==', true)
                    .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                    .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                    .limit(1)
                    .get();
                    
                if (existingBill.empty && autoGenBill.empty) {
                    const paymentDay = lease.paymentDueDay || settings?.defaultPaymentDay || 5;
                    const dueDate = new Date(currentYear, currentMonth, paymentDay);
                    
                    // FIXED: Use consistent description format
                    const billData = {
                        tenantId: lease.tenantId,
                        landlordId: lease.landlordId,
                        tenantName: lease.tenantName,
                        roomNumber: lease.roomNumber,
                        type: 'rent',
                        description: `Rent - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                        totalAmount: lease.monthlyRent,
                        dueDate: dueDate.toISOString(),
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        isPaymentVerified: false,
                        isAutoGenerated: true,
                        apartment: lease.rentalAddress || 'N/A',
                        items: [
                            {
                                description: 'Monthly Rent',
                                amount: lease.monthlyRent,
                                type: 'rent'
                            }
                        ]
                    };
                    
                    await firebaseDb.collection('bills').add(billData);
                    generatedCount++;
                    console.log(`✅ Generated bill for ${lease.tenantName} (Due: ${paymentDay}${this.getOrdinalSuffix(paymentDay)})`);
                } else {
                    skippedCount++;
                    if (!existingBill.empty) {
                        console.log(`⏭️ Bill already exists for ${lease.tenantName} this month (dueDate check)`);
                    } else if (!autoGenBill.empty) {
                        console.log(`⏭️ Auto-generated bill already exists for ${lease.tenantName} this month (race condition protection)`);
                    }
                }
            });
            
            await Promise.all(billPromises);
            
            console.log(`✅ Monthly bills generation completed: ${generatedCount} generated, ${skippedCount} skipped`);
            return {
                generated: generatedCount,
                skipped: skippedCount,
                total: leases.length
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly bills:', error);
            throw error;
        }
    }

    static calculateLandlordStats(tenants, leases, bills, maintenance, totalUnits = 0) {
        console.log('🧮 Calculating landlord statistics...');
        
        // PROPERTY OVERVIEW
        // Use passed totalUnits (may be 0 when landlord has no units)
        const actualTotalUnits = (typeof totalUnits === 'number' && !isNaN(totalUnits)) ? totalUnits : 0;
        
        // Active leases (both isActive and status check)
        const activeLeases = leases.filter(lease => 
            lease.isActive !== false && 
            (lease.status === 'active' || lease.status === 'verified' || !lease.status)
        );
        
        const occupiedUnits = activeLeases.length;
        const vacantUnits = Math.max(0, actualTotalUnits - occupiedUnits);
        const occupancyRate = actualTotalUnits > 0 ? Math.round((occupiedUnits / actualTotalUnits) * 100) : 0;
        
        // Total occupied units (count of active leases, not unique tenants)
        // This represents how many units are rented
        const totalOccupiedUnits = occupiedUnits;
        
        // Total tenants (count of people) - sum of all occupants from active leases
        const activeTenants = activeLeases.reduce((sum, lease) => {
            return sum + (lease.totalOccupants || 1); // Default to 1 if totalOccupants not set
        }, 0);
        
        // Average monthly rent (only from active leases with rent amount)
        const leasesWithRent = activeLeases.filter(lease => lease.monthlyRent && lease.monthlyRent > 0);
        const totalRent = leasesWithRent.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
        const averageRent = leasesWithRent.length > 0 ? Math.round(totalRent / leasesWithRent.length) : 0;
        
        // FINANCIAL OVERVIEW
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Monthly revenue (paid bills this month)
        const monthlyRevenue = bills
            .filter(bill => {
                if (bill.status !== 'paid') return false;
                const billDate = new Date(bill.paidDate || bill.dueDate);
                return billDate.getMonth() === currentMonth && 
                    billDate.getFullYear() === currentYear;
            })
            .reduce((total, bill) => total + (bill.totalAmount || 0), 0);
        
        // Rent collection rate (percentage of expected rent collected this month)
        const expectedMonthlyRent = totalRent; // Total rent from all active leases
        const collectionRate = expectedMonthlyRent > 0 ? 
            Math.round((monthlyRevenue / expectedMonthlyRent) * 100) : 0;
        
        // Late payments (bills overdue)
        const latePayments = bills.filter(bill => 
            bill.status === 'pending' && 
            new Date(bill.dueDate) < today
        ).length;
        
        // Unpaid bills (all pending bills)
        const unpaidBills = bills.filter(bill => bill.status === 'pending').length;
        
        // OPERATIONS
        // Lease renewals (leases ending in next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const upcomingRenewals = leases.filter(lease => {
            if (!lease.leaseEnd || !lease.isActive) return false;
            const leaseEnd = new Date(lease.leaseEnd);
            return leaseEnd <= thirtyDaysFromNow && leaseEnd >= today;
        }).length;
        
        // Open maintenance (new requests)
        const openMaintenance = maintenance.filter(req => 
            req.status === 'open' || !req.status
        ).length;
        
        // Maintenance backlog (all pending maintenance)
        const maintenanceBacklog = maintenance.filter(req => 
            ['open', 'in-progress'].includes(req.status) || !req.status
        ).length;
        
        const stats = {
            // Property Overview
            totalTenants: activeTenants,  // Now represents total people count
            totalUnits: actualTotalUnits,
            occupiedUnits: occupiedUnits,
            vacantUnits: vacantUnits,
            occupancyRate: occupancyRate,
            averageRent: averageRent,
            
            // Financial Overview
            collectionRate: collectionRate,
            totalRevenue: monthlyRevenue,
            latePayments: latePayments,
            unpaidBills: unpaidBills,
            
            // Operations
            upcomingRenewals: upcomingRenewals,
            openMaintenance: openMaintenance,
            maintenanceBacklog: maintenanceBacklog
        };
        
        console.log('📊 Calculated landlord stats:', stats);
        return stats;
    }

    // ===== DASHBOARD STATISTICS METHODS =====
    static async getDashboardStats(userId, userRole, apartmentSelector = null) {
        // apartmentSelector may be: null | string (apartmentAddress) | { apartmentId, apartmentAddress }
        let apartmentId = null;
        let apartmentAddress = null;
        if (apartmentSelector) {
            if (typeof apartmentSelector === 'string') {
                apartmentAddress = apartmentSelector;
            } else if (typeof apartmentSelector === 'object') {
                apartmentId = apartmentSelector.apartmentId || null;
                apartmentAddress = apartmentSelector.apartmentAddress || null;
            }
        }

        console.log(`📊 Getting dashboard stats for ${userRole}: ${userId}${apartmentId ? ` (Apartment ID: ${apartmentId})` : apartmentAddress ? ` (Apartment: ${apartmentAddress})` : ' (All apartments)'}`);
        
        try {
            if (userRole === 'landlord') {
                // Fetch all necessary data in parallel
                let [tenants, leases, bills, maintenanceRequests, units] = await Promise.all([
                    this.getTenants(userId),
                    this.getLandlordLeases(userId),
                    this.getBills(userId),
                    this.getMaintenanceRequests(userId),
                    this.getLandlordUnits(userId)
                ]);

                // FILTER by apartment address if provided
                if (apartmentId || apartmentAddress) {
                    console.log(`🏢 Filtering stats for apartmentId: ${apartmentId} address: ${apartmentAddress}`);

                    // Filter units by apartmentId first, fall back to apartmentAddress
                    if (apartmentId) {
                        units = units.filter(u => u.apartmentId === apartmentId);
                    } else {
                        units = units.filter(u => u.apartmentAddress === apartmentAddress);
                    }
                    const filteredRoomNumbers = units.map(u => u.roomNumber);
                    const filteredRoomIds = units.map(u => u.id);

                    // Robust lease filtering: prefer explicit linkage (roomId, apartmentId/propertyId/rentalPropertyId or apartmentAddress/rentalAddress), then fallback to roomNumber within this apartment
                    leases = leases.filter(l => {
                        // Tier 1: explicit roomId
                        if (l.roomId && filteredRoomIds.includes(l.roomId)) return true;

                        // Tier 2: explicit apartment/property linkage (support rentalPropertyId)
                        if (apartmentId) {
                            if ((l.apartmentId && l.apartmentId === apartmentId) ||
                                (l.propertyId && l.propertyId === apartmentId) ||
                                (l.rentalPropertyId && l.rentalPropertyId === apartmentId)) return true;
                        } else {
                            if ((l.apartmentAddress && l.apartmentAddress === apartmentAddress) ||
                                (l.rentalAddress && l.rentalAddress === apartmentAddress)) return true;
                        }

                        // Tier 3: roomNumber within this apartment context (only accept if lease's apartment/rental fields match or are absent)
                        if (l.roomNumber && filteredRoomNumbers.includes(l.roomNumber)) {
                            if (l.apartmentId && apartmentId && l.apartmentId !== apartmentId) return false;
                            if (l.propertyId && apartmentId && l.propertyId !== apartmentId) return false;
                            if (l.rentalPropertyId && apartmentId && l.rentalPropertyId !== apartmentId) return false;
                            if (l.apartmentAddress && apartmentAddress && l.apartmentAddress !== apartmentAddress) return false;
                            if (l.rentalAddress && apartmentAddress && l.rentalAddress !== apartmentAddress) return false;
                            return true;
                        }

                        return false;
                    });

                    // Bills: match by roomId, apartmentId/propertyId/rentalPropertyId, apartmentAddress/rentalAddress, or roomNumber within this apartment
                    // IMPORTANT: roomNumber filtering requires apartment context to avoid mixing rooms with same number from different apartments
                    bills = bills.filter(b => {
                        if (b.roomId && filteredRoomIds.includes(b.roomId)) return true;

                        if (apartmentId) {
                            if ((b.apartmentId && b.apartmentId === apartmentId) ||
                                (b.propertyId && b.propertyId === apartmentId) ||
                                (b.rentalPropertyId && b.rentalPropertyId === apartmentId)) return true;
                        } else {
                            if ((b.apartmentAddress && b.apartmentAddress === apartmentAddress) ||
                                (b.rentalAddress && b.rentalAddress === apartmentAddress)) return true;
                        }

                        if (b.roomNumber && filteredRoomNumbers.includes(b.roomNumber)) {
                            // If bill has apartmentId/apartmentAddress/rental fields, verify it matches selected apartment
                            if (b.apartmentId && apartmentId && b.apartmentId !== apartmentId) return false;
                            if (b.propertyId && apartmentId && b.propertyId !== apartmentId) return false;
                            if (b.rentalPropertyId && apartmentId && b.rentalPropertyId !== apartmentId) return false;
                            if (b.apartmentAddress && apartmentAddress && b.apartmentAddress !== apartmentAddress) return false;
                            if (b.rentalAddress && apartmentAddress && b.rentalAddress !== apartmentAddress) return false;
                            return true;
                        }
                        return false;
                    });

                    // Maintenance: match by roomId, apartmentId/propertyId/rentalPropertyId, apartmentAddress/rentalAddress, or roomNumber within this apartment
                    // IMPORTANT: roomNumber filtering requires apartment context to avoid mixing rooms with same number from different apartments
                    maintenanceRequests = maintenanceRequests.filter(m => {
                        if (m.roomId && filteredRoomIds.includes(m.roomId)) return true;

                        if (apartmentId) {
                            if ((m.apartmentId && m.apartmentId === apartmentId) ||
                                (m.propertyId && m.propertyId === apartmentId) ||
                                (m.rentalPropertyId && m.rentalPropertyId === apartmentId)) return true;
                        } else {
                            if ((m.apartmentAddress && m.apartmentAddress === apartmentAddress) ||
                                (m.rentalAddress && m.rentalAddress === apartmentAddress)) return true;
                        }

                        if (m.roomNumber && filteredRoomNumbers.includes(m.roomNumber)) {
                            // If maintenance has apartmentId/apartmentAddress/rental fields, verify it matches selected apartment
                            if (m.apartmentId && apartmentId && m.apartmentId !== apartmentId) return false;
                            if (m.propertyId && apartmentId && m.propertyId !== apartmentId) return false;
                            if (m.rentalPropertyId && apartmentId && m.rentalPropertyId !== apartmentId) return false;
                            if (m.apartmentAddress && apartmentAddress && m.apartmentAddress !== apartmentAddress) return false;
                            if (m.rentalAddress && apartmentAddress && m.rentalAddress !== apartmentAddress) return false;
                            return true;
                        }
                        return false;
                    });

                    // Filter tenants to only those in selected apartment's leases
                    const tenantIds = leases.map(l => l.tenantId).filter(Boolean);
                    tenants = tenants.filter(t => tenantIds.includes(t.id));
                    
                    console.log(`📦 Filtered data counts for ${apartmentAddress}:`, {
                        units: units.length,
                        leases: leases.length,
                        bills: bills.length,
                        maintenance: maintenanceRequests.length,
                        tenants: tenants.length
                    });
                } else {
                    console.log('📦 Fetched data counts (all apartments):', {
                        units: units.length,
                        tenants: tenants.length,
                        leases: leases.length,
                        bills: bills.length,
                        maintenance: maintenanceRequests.length
                    });
                }

                // Calculate statistics (passing filtered units count now)
                const stats = this.calculateLandlordStats(tenants, leases, bills, maintenanceRequests, units.length);
                console.log('✅ Calculated dashboard stats:', stats);
                return stats;
                
            } else {
                // Tenant-specific stats (keep existing tenant logic)
                const [bills, maintenance, lease] = await Promise.all([
                    this.getTenantBills(userId),
                    this.getTenantMaintenanceRequests(userId),
                    this.getTenantLease(userId)
                ]);

                if (lease && lease.isActive) {
                    await this.generateMonthlyBillsForTenant(userId, lease);
                    const updatedBills = await this.getTenantBills(userId);
                    // Use updatedBills for calculations...
                }

                const unpaidBills = bills.filter(bill => bill.status === 'pending');
                const totalDue = unpaidBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
                
                const nextDueDate = this.calculateNextDueDate(lease, bills);
                const openMaintenance = maintenance.filter(req => 
                    ['open', 'in-progress'].includes(req.status)
                );

                return {
                    totalDue: totalDue,
                    nextDueDate: nextDueDate,
                    paymentStatus: unpaidBills.length > 0 ? 'pending' : 'current',
                    roomNumber: lease?.roomNumber || 'N/A',
                    monthlyRent: lease?.monthlyRent || 0,
                    unpaidBills: unpaidBills.length,
                    lastPaymentAmount: this.getLastPaymentAmount(bills),
                    lastPaymentDate: this.getLastPaymentDate(bills),
                    openMaintenance: openMaintenance.length,
                    recentUpdates: maintenance.filter(req => 
                        new Date(req.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    ).length,
                    lease: lease
                };
            }
            
        } catch (error) {
            console.error('❌ Dashboard stats error:', error);
            return this.getFallbackStats(userRole);
        }
    }


    static calculateNextDueDate(lease, bills) {
        if (!lease) return null;
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        // Get payment day from lease (e.g., 5th, 10th, 15th, etc.)
        const paymentDay = lease.paymentDueDay || 1; // Default to 1st if not specified
        
        // Calculate due date for current month
        const dueDateThisMonth = new Date(currentYear, currentMonth, paymentDay);
        
        // If today is after the due date this month, calculate for next month
        let nextDueDate = today <= dueDateThisMonth ? dueDateThisMonth : new Date(currentYear, currentMonth + 1, paymentDay);
        
        // Check if there are any unpaid bills that might affect the next due date
        const unpaidBills = bills.filter(bill => bill.status === 'pending');
        if (unpaidBills.length > 0) {
            // If there are unpaid bills, use the earliest unpaid bill's due date
            const earliestUnpaid = unpaidBills.reduce((earliest, bill) => {
                const billDate = new Date(bill.dueDate);
                return (!earliest || billDate < earliest) ? billDate : earliest;
            }, null);
            
            if (earliestUnpaid && earliestUnpaid < nextDueDate) {
                nextDueDate = earliestUnpaid;
            }
        }
        
        return nextDueDate;
    }



    static getFallbackStats(userRole) {
        if (userRole === 'tenant') {
            return {
                totalDue: 0,
                nextDueDate: null,
                paymentStatus: 'current',
                roomNumber: 'N/A',
                monthlyRent: 0,
                unpaidBills: 0,
                lastPaymentAmount: 0,
                lastPaymentDate: null,
                openMaintenance: 0,
                recentUpdates: 0
            };
        } else {
                return {
                totalTenants: 0,
                totalUnits: 0,
                occupiedUnits: 0,
                vacantUnits: 0,
                occupancyRate: 0,
                averageRent: 0,
                collectionRate: 0,
                latePayments: 0,
                upcomingRenewals: 0,
                maintenanceBacklog: 0,
                unpaidBills: 0,
                openMaintenance: 0,
                totalRevenue: 0
            };
        }
    }

    static getLastPaymentAmount(bills) {
        const paidBills = bills.filter(bill => bill.status === 'paid');
        return paidBills.length > 0 ? paidBills[0].totalAmount : 0;
    }

    static getLastPaymentDate(bills) {
        const paidBills = bills.filter(bill => bill.status === 'paid');
        return paidBills.length > 0 ? paidBills[0].paidDate : null;
    }

    static calculateMonthlyRevenue(bills) {
        try {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            const monthlyRevenue = bills
                .filter(bill => {
                    if (bill.status !== 'paid') return false;
                    const billDate = new Date(bill.paidDate || bill.dueDate);
                    return billDate.getMonth() === currentMonth && 
                           billDate.getFullYear() === currentYear;
                })
                .reduce((total, bill) => total + (bill.totalAmount || 0), 0);
                
            return monthlyRevenue;
        } catch (error) {
            console.error('Error calculating monthly revenue:', error);
            return 0;
        }
    }

    static calculateAverageRent(leases) {
        try {
            const activeLeases = leases.filter(lease => 
                lease.isActive && lease.status === 'active' && lease.monthlyRent
            );
            
            if (activeLeases.length === 0) return 0;
            
            const totalRent = activeLeases.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
            return totalRent / activeLeases.length;
        } catch (error) {
            console.error('Error calculating average rent:', error);
            return 0;
        }
    }

    static getFallbackStats() {
        console.log('🔄 Using fallback dashboard stats');
        return {
            totalTenants: 0,
            totalUnits: 0,
            occupiedUnits: 0,
            vacantUnits: 0,
            occupancyRate: 0,
            averageRent: 0,
            collectionRate: 0,
            latePayments: 0,
            upcomingRenewals: 0,
            maintenanceBacklog: 0,
            unpaidBills: 0,
            openMaintenance: 0,
            totalRevenue: 0
        };
    }

    // ===== DATABASE VALIDATION & SETUP =====
    static async validateAndSetupDatabase() {
        console.log('🔍 Validating Firestore database structure...');
        
        try {
            // First, migrate existing data
            await this.migrateExistingUsers();
            await this.migrateExistingLeases();
            
            const collections = ['users', 'leases', 'bills', 'maintenance'];
            const requiredFields = {
                users: ['isActive', 'status', 'leaseId', 'roomNumber'],
                leases: ['isActive', 'status', 'monthlyRent', 'leaseEnd', 'roomNumber'],
                bills: ['status', 'dueDate', 'type', 'totalAmount'],
                maintenance: ['status']
            };

            for (const collection of collections) {
                await this.validateCollection(collection, requiredFields[collection] || []);
            }
            
            console.log('✅ Database validation and migration completed');
            return true;
            
        } catch (error) {
            console.error('❌ Database validation failed:', error);
            return false;
        }
    }

    static async validateCollection(collectionName, requiredFields) {
        console.log(`📋 Validating ${collectionName} collection...`);
        
        try {
            const snapshot = await firebaseDb.collection(collectionName).limit(1).get();
            
            if (snapshot.empty) {
                console.log(`➡️ ${collectionName} collection is empty, creating sample document...`);
                await this.createSampleDocument(collectionName);
            } else {
                console.log(`✅ ${collectionName} collection exists, checking fields...`);
                const doc = snapshot.docs[0];
                const data = doc.data();
                await this.validateDocumentFields(collectionName, doc.id, data, requiredFields);
            }
            
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.log(`⚠️ Cannot access ${collectionName} collection (permission denied)`);
            } else {
                console.error(`❌ Error validating ${collectionName}:`, error);
            }
        }
    }

    static async validateDocumentFields(collectionName, docId, data, requiredFields) {
        const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            console.log(`➡️ Adding missing fields to ${collectionName}/${docId}:`, missingFields);
            
            const updates = {};
            missingFields.forEach(field => {
                updates[field] = this.getDefaultValue(collectionName, field);
            });
            
            try {
                await firebaseDb.collection(collectionName).doc(docId).update(updates);
                console.log(`✅ Added missing fields to ${collectionName}/${docId}`);
            } catch (updateError) {
                console.warn(`⚠️ Could not update ${collectionName}/${docId}:`, updateError);
            }
        } else {
            console.log(`✅ ${collectionName} has all required fields`);
        }
    }

    static getDefaultValue(collectionName, field) {
        const defaults = {
            users: {
                isActive: true,
                status: 'active',
                leaseId: null,
                roomNumber: 'N/A'
            },
            leases: {
                isActive: true,
                status: 'active',
                monthlyRent: 0,
                leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                roomNumber: 'N/A'
            },
            bills: {
                status: 'pending',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                type: 'rent',
                totalAmount: 0
            },
            maintenance: {
                status: 'open'
            }
        };
        
        return defaults[collectionName]?.[field] ?? null;
    }

    static async createSampleDocument(collectionName) {
        const sampleData = {
            users: {
                email: 'sample@example.com',
                name: 'Sample User',
                role: 'tenant',
                isActive: true,
                status: 'active',
                leaseId: null,
                roomNumber: '1A',
                createdAt: new Date().toISOString()
            },
            leases: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                monthlyRent: 5000,
                securityDeposit: 5000,
                leaseStart: new Date().toISOString(),
                leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                status: 'active',
                createdAt: new Date().toISOString()
            },
            bills: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                type: 'rent',
                totalAmount: 5000,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                description: 'Monthly Rent'
            },
            maintenance: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                type: 'repair',
                title: 'Sample Maintenance Request',
                description: 'This is a sample maintenance request',
                status: 'open',
                priority: 'medium',
                createdAt: new Date().toISOString()
            }
        };

        try {
            const docRef = await firebaseDb.collection(collectionName).add(sampleData[collectionName]);
            console.log(`✅ Created sample document in ${collectionName} with ID: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error(`❌ Failed to create sample document in ${collectionName}:`, error);
            throw error;
        }
    }

    static async migrateExistingUsers() {
        console.log('🔄 Migrating existing user documents...');
        
        try {
            const usersSnapshot = await firebaseDb.collection('users').get();
            const migrationPromises = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const updates = {};
                
                if (userData.isActive === undefined) updates.isActive = true;
                if (!userData.status) updates.status = 'active';
                if (!userData.leaseId) updates.leaseId = null;
                if (!userData.roomNumber) updates.roomNumber = 'N/A';
                
                if (Object.keys(updates).length > 0) {
                    migrationPromises.push(
                        firebaseDb.collection('users').doc(doc.id).update(updates)
                    );
                }
            });
            
            await Promise.all(migrationPromises);
            console.log(`✅ Migrated ${migrationPromises.length} user documents`);
            
        } catch (error) {
            console.error('❌ User migration failed:', error);
        }
    }

    static async migrateExistingLeases() {
        console.log('🔄 Migrating existing lease documents...');
        
        try {
            const leasesSnapshot = await firebaseDb.collection('leases').get();
            const migrationPromises = [];
            
            leasesSnapshot.forEach(doc => {
                const leaseData = doc.data();
                const updates = {};
                
                // Add missing fields with default values
                if (leaseData.isActive === undefined) updates.isActive = true;
                if (!leaseData.status) updates.status = 'active';
                if (!leaseData.monthlyRent) updates.monthlyRent = 0;
                if (!leaseData.leaseEnd) {
                    updates.leaseEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                }
                if (!leaseData.roomNumber) updates.roomNumber = 'N/A';
                
                // Ensure payment due day is set (default to 1st of month)
                if (!leaseData.paymentDueDay) updates.paymentDueDay = 1;
                
                if (Object.keys(updates).length > 0) {
                    migrationPromises.push(
                        firebaseDb.collection('leases').doc(doc.id).update(updates)
                    );
                }
            });
            
            await Promise.all(migrationPromises);
            console.log(`✅ Migrated ${migrationPromises.length} lease documents`);
            
        } catch (error) {
            console.error('❌ Lease migration failed:', error);
        }
    }

    static async generateMonthlyBillsForTenant(tenantId, lease) {
        try {
            if (!lease || !lease.isActive) return;
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const paymentDay = lease.paymentDueDay || 1;
            
            // Calculate due date for this month
            const dueDate = new Date(currentYear, currentMonth, paymentDay);
            
            // Check if bill already exists for this month
            const existingBill = await firebaseDb.collection('bills')
                .where('tenantId', '==', tenantId)
                .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                .limit(1)
                .get();
                
            if (existingBill.empty) {
                // Create new bill for this month
                const billData = {
                    tenantId: tenantId,
                    landlordId: lease.landlordId,
                    tenantName: lease.tenantName,
                    roomNumber: lease.roomNumber,
                    type: 'rent',
                    totalAmount: lease.monthlyRent,
                    dueDate: dueDate.toISOString(),
                    status: 'pending',
                    description: `Monthly Rent - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                    createdAt: new Date().toISOString(),
                    isPaymentVerified: false
                };
                
                await firebaseDb.collection('bills').add(billData);
                console.log(`✅ Generated monthly bill for ${lease.tenantName}`);
            }
            
        } catch (error) {
            console.error('Error generating monthly bill:', error);
        }
    }



    // ===== CORE DATA METHODS =====
    static async getTenants(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('users')
                .where('landlordId', '==', landlordId)
                .where('role', '==', 'tenant')
                .get();
            
            return querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
        } catch (error) {
            console.error('❌ DataManager.getTenants error:', error);
            return [];
        }
    }

    async getTenants() {
        // If no user context, check window.currentUser
        const userId = (this.user && this.user.uid) || (typeof window !== 'undefined' && window.currentUser && window.currentUser.uid);
        if (!userId) throw new Error('User not authenticated');
        
        try {
            // Query `users` collection for tenant records (role === 'tenant') to match current Firestore structure
            const snapshot = await firebaseDb.collection('users')
                .where('landlordId', '==', userId)
                .where('role', '==', 'tenant')
                .get();

            const tenants = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });

            console.log('✅ Tenants loaded from `users` collection:', tenants.length);
            return tenants;
        } catch (error) {
            console.error('❌ Error getting tenants from users collection:', error);
            return [];
        }
    }

    static async getLandlordLeases(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('landlordId', '==', landlordId)
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting landlord leases:', error);
            return [];
        }
    }

    static async getMaintenanceRequests(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('maintenance')
                .where('landlordId', '==', landlordId)
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance requests:', error);
            return [];
        }
    }

    static async getBills(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('bills')
                .where('landlordId', '==', landlordId)
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting bills:', error);
            return [];
        }
    }

    static async getTenantLease(tenantId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (querySnapshot.empty) return null;
            
            const leaseData = querySnapshot.docs[0].data();
            
            // RETURN ALL FIELDS including occupants and totalOccupants
            return {
                id: querySnapshot.docs[0].id,
                // Basic lease info
                tenantId: leaseData.tenantId,
                landlordId: leaseData.landlordId,
                tenantName: leaseData.tenantName,
                
                // Property info
                roomNumber: leaseData.roomNumber,
                rentalAddress: leaseData.rentalAddress,
                
                // Financial terms
                monthlyRent: leaseData.monthlyRent,
                securityDeposit: leaseData.securityDeposit,
                paymentMethod: leaseData.paymentMethod,
                paymentDueDay: leaseData.paymentDueDay,
                
                // Lease period
                leaseStart: leaseData.leaseStart,
                leaseEnd: leaseData.leaseEnd,
                leaseDuration: leaseData.leaseDuration,
                
                // Occupancy information - MAKE SURE THESE ARE INCLUDED
                maxOccupants: leaseData.maxOccupants,
                occupants: leaseData.occupants, // THIS WAS MISSING
                totalOccupants: leaseData.totalOccupants, // THIS WAS MISSING
                
                // Status
                status: leaseData.status,
                isActive: leaseData.isActive,
                
                // Agreement tracking
                agreementViewed: leaseData.agreementViewed,
                agreementAccepted: leaseData.agreementAccepted,
                agreementAcceptedDate: leaseData.agreementAcceptedDate,
                
                // Additional terms
                maxOccupants: leaseData.maxOccupants,
                additionalOccupantFee: leaseData.additionalOccupantFee,
                
                // Dates
                createdAt: leaseData.createdAt,
                updatedAt: leaseData.updatedAt
            };
        } catch (error) {
            console.error('Error getting tenant lease:', error);
            return null;
        }
    }

    // ===== CRUD OPERATIONS =====
    static async addTenant(tenantData) {
        if (!this.isOnline) {
            const pendingOp = {
                type: 'addTenant',
                data: tenantData,
                timestamp: new Date().toISOString()
            };
            this.storePendingOperation(pendingOp);
            throw new Error('Operation queued for sync when online');
        }

        try {
            const docRef = await firebaseDb.collection('tenants').add({
                ...tenantData,
                createdAt: new Date().toISOString(),
                isActive: true
            });
            return docRef.id;
        } catch (error) {
            if (error.code === 'failed-precondition') {
                const pendingOp = {
                    type: 'addTenant',
                    data: tenantData,
                    timestamp: new Date().toISOString()
                };
                this.storePendingOperation(pendingOp);
                return 'queued';
            }
            throw error;
        }
    }

    static async createBill(billData) {
        const docRef = await firebaseDb.collection('bills').add({
            ...billData,
            createdAt: new Date().toISOString(),
            status: 'pending',
            isPaymentVerified: false
        });
        // Create activity for bill generation
        try {
            await firebaseDb.collection('activities').add({
                type: 'bill_created',
                billId: docRef.id,
                tenantId: billData.tenantId || null,
                landlordId: billData.landlordId || billData.createdBy || null,
                amount: billData.totalAmount || billData.amount || null,
                title: billData.isAutoGenerated ? 'Auto-generated Bill' : 'Bill Created',
                message: billData.description || 'New bill created',
                createdAt: new Date().toISOString()
            });
        } catch (actErr) {
            console.warn('Could not create activity for bill creation:', actErr);
        }

        return docRef.id;
    }

    static async submitMaintenanceRequest(requestData) {
        const docRef = await firebaseDb.collection('maintenance').add({
            ...requestData,
            status: 'open',
            priority: 'medium',
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    }

    /**
     * Record a payment to the database
     * @param {object} paymentData - Payment details including status
     * @returns {Promise<string>} - Payment document ID
     * 
     * IMPORTANT: This function respects the status passed in paymentData.
     * The caller is responsible for updating the bill status based on payment status:
     * - If status is 'waiting_verification': Bill should be 'payment_pending', isPaymentVerified = false
     * - If status is 'verified' or 'completed': Bill should be 'paid', isPaymentVerified = true
     */
    static async recordPayment(paymentData) {
        try {
            console.log('💳 Recording payment:', paymentData);
            
            // Ensure we have the status from the payment data
            const toSave = {
                ...paymentData,
                processedAt: new Date().toISOString(),
                status: paymentData.status || 'waiting_verification'  // Default to waiting verification for safety
            };

            const paymentRef = await firebaseDb.collection('payments').add(toSave);

            console.log('✅ Payment recorded successfully (id:', paymentRef.id, ') with status:', toSave.status);
            
            // NOTE: Do NOT automatically update the bill here!
            // The caller (tenant flow vs landlord flow in app.js) is responsible for:
            // 1. Updating the bill status (payment_pending vs paid)
            // 2. Setting isPaymentVerified flag appropriately
            // 3. Recording paidAmount and paidDate
            
            // Create an activity entry for this payment
            try {
                await firebaseDb.collection('activities').add({
                    type: 'payment_recorded',
                    paymentId: paymentRef.id,
                    billId: toSave.billId || null,
                    tenantId: toSave.tenantId || null,
                    landlordId: toSave.landlordId || null,
                    amount: toSave.amount || toSave.paymentAmount || null,
                    status: toSave.status,
                    title: 'Payment Recorded',
                    message: `Payment recorded (status: ${toSave.status})`,
                    createdAt: new Date().toISOString()
                });
            } catch (actErr) {
                console.warn('Could not create activity for payment:', actErr);
            }

            return paymentRef.id;
            
        } catch (error) {
            console.error('❌ Error recording payment:', error);
            throw error;
        }
    }

    // ===== OFFLINE SUPPORT =====
    static storePendingOperation(operation) {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        pendingOps.push(operation);
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOps));
        this.updateSyncStatus();
    }

    static async processPendingOperations() {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        
        for (const op of pendingOps) {
            try {
                switch (op.type) {
                    case 'addTenant':
                        await this.addTenant(op.data);
                        break;
                    case 'createBill':
                        await this.createBill(op.data);
                        break;
                    case 'submitMaintenance':
                        await this.submitMaintenanceRequest(op.data);
                        break;
                    case 'recordPayment':
                        await this.recordPayment(op.data);
                        break;
                }
                
                this.removePendingOperation(op);
            } catch (error) {
                console.error('Failed to process pending operation:', op, error);
            }
        }
    }

    static removePendingOperation(operation) {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        const index = pendingOps.findIndex(op => 
            op.timestamp === operation.timestamp && op.type === operation.type
        );
        
        if (index > -1) {
            pendingOps.splice(index, 1);
            localStorage.setItem('pendingOperations', JSON.stringify(pendingOps));
        }
        
        this.updateSyncStatus();
    }

    static updateSyncStatus() {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        const syncIndicator = document.getElementById('syncStatus');
        
        if (syncIndicator) {
            if (pendingOps.length > 0) {
                syncIndicator.innerHTML = `<i class="fas fa-sync-alt"></i> ${pendingOps.length} pending`;
                syncIndicator.style.display = 'block';
            } else {
                syncIndicator.style.display = 'none';
            }
        }
    }

    // ===== REAL-TIME LISTENERS =====
    static listenToBills(landlordId, callback) {
        return firebaseDb.collection('bills')
            .where('landlordId', '==', landlordId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(bills);
            });
    }

    static listenToTenantBills(tenantId, callback) {
        return firebaseDb.collection('bills')
            .where('tenantId', '==', tenantId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(bills);
            });
    }

    static listenToTenantMaintenance(tenantId, callback) {
        return firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(requests);
            });
    }

    // ===== LEGACY METHODS (Keep for compatibility) =====
    static async updateTenant(tenantId, updates) {
        await firebaseDb.doc(`tenants/${tenantId}`).update(updates);
    }

    static async deleteTenant(tenantId) {
        await firebaseDb.doc(`tenants/${tenantId}`).delete();
    }

    // ===== DATA MIGRATIONS =====
    /**
     * Backfill lease documents so they explicitly reference the room (roomId), apartmentAddress, and propertyId
     * This helps avoid cross-apartment collisions when multiple apartments reuse room labels like '1A'.
     *
     * Returns a summary: { totalChecked, updated, skippedNoMatch, skippedAmbiguous, errors: [] }
     */
    static async backfillLeaseApartmentLinks(landlordId) {
        if (!landlordId) throw new Error('landlordId is required');

        const summary = {
            totalChecked: 0,
            updated: 0,
            skippedNoMatch: 0,
            skippedAmbiguous: 0,
            errors: []
        };

        try {
            // Load all leases for this landlord
            const leasesSnap = await firebaseDb.collection('leases').where('landlordId', '==', landlordId).get();
            const leases = leasesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Load rooms for this landlord
            const roomsSnap = await firebaseDb.collection('rooms').where('landlordId', '==', landlordId).get();
            const rooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Load apartments for this landlord (to resolve propertyId)
            const apartmentsSnap = await firebaseDb.collection('apartments').where('landlordId', '==', landlordId).get();
            const apartments = apartmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Index rooms by roomNumber and by id
            const roomsByNumber = new Map();
            const roomsById = new Map();
            for (const r of rooms) {
                if (!roomsByNumber.has(r.roomNumber)) roomsByNumber.set(r.roomNumber, []);
                roomsByNumber.get(r.roomNumber).push(r);
                roomsById.set(r.id, r);
            }

            // Index apartments by address
            const apartmentsByAddress = new Map();
            for (const a of apartments) {
                if (a.apartmentAddress) apartmentsByAddress.set(a.apartmentAddress, a);
            }

            const batch = firebaseDb.batch();

            for (const lease of leases) {
                summary.totalChecked++;

                try {
                    // Skip leases that already have both apartmentAddress and roomId/propertyId set
                    if ((lease.apartmentAddress || lease.rentalAddress) && (lease.roomId || lease.propertyId)) {
                        continue;
                    }

                    let matchedRoom = null;

                    // Prefer explicit roomId on lease
                    if (lease.roomId && roomsById.has(lease.roomId)) {
                        matchedRoom = roomsById.get(lease.roomId);
                    }

                    // If no roomId, attempt to match by roomNumber but only when unique
                    if (!matchedRoom && lease.roomNumber) {
                        const candidates = roomsByNumber.get(lease.roomNumber) || [];
                        if (candidates.length === 1) {
                            matchedRoom = candidates[0];
                        } else if (candidates.length > 1) {
                            // Ambiguous: multiple rooms with same label for this landlord
                            summary.skippedAmbiguous++;
                            continue;
                        }
                    }

                    if (!matchedRoom) {
                        summary.skippedNoMatch++;
                        continue;
                    }

                    const updates = {};
                    if (matchedRoom.apartmentAddress && !lease.apartmentAddress) {
                        updates.apartmentAddress = matchedRoom.apartmentAddress;
                    }
                    if (!lease.roomId) updates.roomId = matchedRoom.id;

                    // Resolve property/apartment id if possible
                    if (matchedRoom.apartmentAddress && !lease.propertyId) {
                        const apt = apartmentsByAddress.get(matchedRoom.apartmentAddress);
                        if (apt) updates.propertyId = apt.id;
                    }

                    if (Object.keys(updates).length > 0) {
                        updates.updatedAt = new Date().toISOString();
                        const leaseRef = firebaseDb.collection('leases').doc(lease.id);
                        batch.update(leaseRef, updates);
                        summary.updated++;
                    }

                } catch (err) {
                    summary.errors.push({ leaseId: lease.id, message: err.message });
                }
            }

            // Commit batch if any updates
            if (summary.updated > 0) await batch.commit();

            return summary;

        } catch (error) {
            console.error('❌ Error running backfillLeaseApartmentLinks:', error);
            throw error;
        }
    }

    // ===== Activity Logging =====
    /**
     * Log a custom activity for landlord or tenant
     * activity: { type, title, description, icon, color, data }
     */
    static async logActivity(landlordId, activity) {
        if (!landlordId) throw new Error('landlordId is required');
        const payload = {
            landlordId,
            type: activity.type || 'custom',
            title: activity.title || 'Activity',
            description: activity.description || '',
            icon: activity.icon || 'fas fa-info-circle',
            color: activity.color || 'var(--info)',
            data: activity.data || {},
            timestamp: activity.timestamp || new Date().toISOString()
        };

        const docRef = await firebaseDb.collection('activities').add(payload);
        return { id: docRef.id, ...payload };
    }

    static async updateBill(billId, updates) {
        await firebaseDb.doc(`bills/${billId}`).update(updates);
    }

    static async deleteBill(billId) {
        await firebaseDb.doc(`bills/${billId}`).delete();
    }

    static async updateMaintenance(requestId, updates) {
        await firebaseDb.doc(`maintenance/${requestId}`).update(updates);
    }


    static async addProperty(propertyData) {
        const docRef = await firebaseDb.collection('properties').add({
            ...propertyData,
            createdAt: new Date().toISOString(),
            isActive: true
        });
        return docRef.id;
    }

    static async updateProperty(propertyId, updates) {
        await firebaseDb.doc(`properties/${propertyId}`).update(updates);
    }

    static async getTenantBills(tenantId) {
        try {
            console.log('💰 Fetching bills for tenant:', tenantId);
            
            const querySnapshot = await firebaseDb.collection('bills')
                .where('tenantId', '==', tenantId)
                .orderBy('dueDate', 'desc')
                .get();
            
            const bills = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('✅ Fetched', bills.length, 'bills for tenant');
            return bills;
            
        } catch (error) {
            console.error('❌ Error getting tenant bills:', error);
            return [];
        }
    }

    static async getTenantMaintenanceRequests(tenantId) {
        const querySnapshot = await firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async getTenantProfile(tenantId) {
        try {
            console.log('📋 Fetching tenant profile:', tenantId);
            
            const userDoc = await firebaseDb.collection('users').doc(tenantId).get();
            
            if (!userDoc.exists) {
                console.warn('⚠️ Tenant profile not found');
                return null;
            }

            const profileData = userDoc.data();
            console.log('✅ Tenant profile loaded');
            
            return {
                id: userDoc.id,
                ...profileData
            };

        } catch (error) {
            console.error('❌ Error fetching tenant profile:', error);
            throw error;
        }
    }

    static async updateTenantProfile(tenantId, updates) {
        try {
            console.log('💾 Updating tenant profile:', tenantId);
            
            await firebaseDb.collection('users').doc(tenantId).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Tenant profile updated');
            return true;

        } catch (error) {
            console.error('❌ Error updating tenant profile:', error);
            throw error;
        }
    }

    /**
     * CLEANUP: Remove duplicate bills (typically caused by race conditions)
     * Keeps the first (oldest) bill and removes duplicates in the same month
     */
    static async removeDuplicateBills() {
        try {
            console.log('🧹 Scanning for duplicate bills...');
            
            const billsSnapshot = await firebaseDb.collection('bills').get();
            const billsMap = {};
            
            // Group bills by tenantId + dueDate month
            billsSnapshot.forEach(doc => {
                const bill = doc.data();
                const dueDate = new Date(bill.dueDate);
                const monthKey = `${bill.tenantId}_${dueDate.getFullYear()}_${dueDate.getMonth()}`;
                
                if (!billsMap[monthKey]) {
                    billsMap[monthKey] = [];
                }
                
                billsMap[monthKey].push({
                    id: doc.id,
                    createdAt: bill.createdAt,
                    ...bill
                });
            });
            
            // Find and remove duplicates (keep oldest, delete newer ones)
            let duplicatesRemoved = 0;
            const batch = firebaseDb.batch();
            
            for (const [monthKey, bills] of Object.entries(billsMap)) {
                if (bills.length > 1) {
                    // Sort by createdAt to find the oldest
                    const sorted = bills.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    const keepBill = sorted[0];
                    
                    console.log(`🔍 Found ${bills.length} duplicate bills for month ${monthKey}`);
                    console.log(`   Keeping: ${keepBill.id} (created: ${keepBill.createdAt})`);
                    console.log(`   Tenant: ${keepBill.tenantName}, Room: ${keepBill.roomNumber}, Amount: ${keepBill.totalAmount}`);
                    
                    // Delete all duplicates except the first one
                    for (let i = 1; i < sorted.length; i++) {
                        const duplicateBill = sorted[i];
                        console.log(`   Deleting: ${duplicateBill.id} (created: ${duplicateBill.createdAt})`);
                        batch.delete(firebaseDb.collection('bills').doc(duplicateBill.id));
                        duplicatesRemoved++;
                    }
                }
            }
            
            if (duplicatesRemoved > 0) {
                await batch.commit();
                console.log(`✅ Removed ${duplicatesRemoved} duplicate bills`);
            } else {
                console.log('✅ No duplicate bills found');
            }
            
            return {
                duplicatesFound: duplicatesRemoved,
                status: duplicatesRemoved > 0 ? 'cleaned' : 'clean'
            };
            
        } catch (error) {
            console.error('❌ Error removing duplicate bills:', error);
            throw error;
        }
    }
}

const dataManager = new DataManager();
if (typeof dataManager.init === 'function') dataManager.init();
window.DataManager = dataManager;