/**
 * DataService
 * Handles all data operations (CRUD) for models
 * Orchestrates between Models, Firebase, and validation
 */
class DataService {
  constructor(firebaseService) {
    this.firebaseService = firebaseService;
  }

  // ===== USER OPERATIONS =====

  /**
   * Get user by ID
   * @param {string} userId
   * @returns {Promise<User>}
   */
  async getUser(userId) {
    try {
      const doc = await this.firebaseService.read('users', userId);
      if (!doc) return null;
      return new User(doc.data());
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Get all users with filters
   * @param {object} filters - { role, status, search }
   * @returns {Promise<User[]>}
   */
  async getUsers(filters = {}) {
    try {
      const conditions = [];
      if (filters.role) conditions.push(['role', '==', filters.role]);
      if (filters.isActive !== undefined) conditions.push(['isActive', '==', filters.isActive]);

      const snapshot = await this.firebaseService.query('users', conditions);
      let users = snapshot.docs.map(doc => new User(doc.data()));

      // Client-side search filtering
      if (filters.search) {
        const search = filters.search.toLowerCase();
        users = users.filter(u => 
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search)
        );
      }

      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Create user
   * @param {User} user
   * @returns {Promise<string>} - User ID
   */
  async createUser(user) {
    try {
      if (!user.isValid()) {
        throw new Error('Invalid user: ' + user.getValidationErrors().join(', '));
      }
      return await this.firebaseService.create('users', user.toJSON());
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} userId
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateUser(userId, updates) {
    try {
      const user = new User(updates);
      const errors = user.getValidationErrors();
      if (errors.length > 0) {
        throw new Error('Invalid updates: ' + errors.join(', '));
      }
      await this.firebaseService.update('users', userId, updates);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async deleteUser(userId) {
    try {
      await this.firebaseService.delete('users', userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // ===== PROPERTY OPERATIONS =====

  /**
   * Get properties for landlord
   * @param {string} landlordId
   * @returns {Promise<Property[]>}
   */
  async getLandlordProperties(landlordId) {
    try {
      const conditions = [['landlordId', '==', landlordId]];
      const snapshot = await this.firebaseService.query('properties', conditions);
      return snapshot.docs.map(doc => new Property(doc.data()));
    } catch (error) {
      console.error('Error getting properties:', error);
      throw error;
    }
  }

  /**
   * Get property by ID
   * @param {string} propertyId
   * @returns {Promise<Property>}
   */
  async getProperty(propertyId) {
    try {
      const doc = await this.firebaseService.read('properties', propertyId);
      if (!doc) return null;
      return new Property(doc.data());
    } catch (error) {
      console.error('Error getting property:', error);
      throw error;
    }
  }

  /**
   * Create property
   * @param {Property} property
   * @returns {Promise<string>} - Property ID
   */
  async createProperty(property) {
    try {
      if (!property.isValid()) {
        throw new Error('Invalid property: ' + property.getValidationErrors().join(', '));
      }
      return await this.firebaseService.create('properties', property.toJSON());
    } catch (error) {
      console.error('Error creating property:', error);
      throw error;
    }
  }

  /**
   * Update property
   * @param {string} propertyId
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateProperty(propertyId, updates) {
    try {
      await this.firebaseService.update('properties', propertyId, updates);
    } catch (error) {
      console.error('Error updating property:', error);
      throw error;
    }
  }

  // ===== UNIT OPERATIONS =====

  /**
   * Get units for property
   * @param {string} propertyId
   * @returns {Promise<Unit[]>}
   */
  async getPropertyUnits(propertyId) {
    try {
      const conditions = [['propertyId', '==', propertyId]];
      const snapshot = await this.firebaseService.query('units', conditions);
      return snapshot.docs.map(doc => new Unit(doc.data()));
    } catch (error) {
      console.error('Error getting units:', error);
      throw error;
    }
  }

  /**
   * Get unit by ID
   * @param {string} unitId
   * @returns {Promise<Unit>}
   */
  async getUnit(unitId) {
    try {
      const doc = await this.firebaseService.read('units', unitId);
      if (!doc) return null;
      return new Unit(doc.data());
    } catch (error) {
      console.error('Error getting unit:', error);
      throw error;
    }
  }

  /**
   * Create unit
   * @param {Unit} unit
   * @returns {Promise<string>} - Unit ID
   */
  async createUnit(unit) {
    try {
      if (!unit.isValid()) {
        throw new Error('Invalid unit: ' + unit.getValidationErrors().join(', '));
      }
      return await this.firebaseService.create('units', unit.toJSON());
    } catch (error) {
      console.error('Error creating unit:', error);
      throw error;
    }
  }

  /**
   * Update unit
   * @param {string} unitId
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateUnit(unitId, updates) {
    try {
      await this.firebaseService.update('units', unitId, updates);
    } catch (error) {
      console.error('Error updating unit:', error);
      throw error;
    }
  }

  // ===== LEASE OPERATIONS =====

  /**
   * Get leases for unit
   * @param {string} unitId
   * @returns {Promise<Lease[]>}
   */
  async getUnitLeases(unitId) {
    try {
      const conditions = [['unitId', '==', unitId]];
      const snapshot = await this.firebaseService.query('leases', conditions);
      return snapshot.docs.map(doc => new Lease(doc.data()));
    } catch (error) {
      console.error('Error getting leases:', error);
      throw error;
    }
  }

  /**
   * Get active lease for unit
   * @param {string} unitId
   * @returns {Promise<Lease>}
   */
  async getActiveLeaseForUnit(unitId) {
    try {
      const conditions = [
        ['unitId', '==', unitId],
        ['status', '==', 'active']
      ];
      const snapshot = await this.firebaseService.query('leases', conditions);
      const docs = snapshot.docs;
      if (docs.length === 0) return null;
      return new Lease(docs[0].data());
    } catch (error) {
      console.error('Error getting active lease:', error);
      throw error;
    }
  }

  /**
   * Create lease
   * @param {Lease} lease
   * @returns {Promise<string>} - Lease ID
   */
  async createLease(lease) {
    try {
      if (!lease.isValid()) {
        throw new Error('Invalid lease: ' + lease.getValidationErrors().join(', '));
      }
      return await this.firebaseService.create('leases', lease.toJSON());
    } catch (error) {
      console.error('Error creating lease:', error);
      throw error;
    }
  }

  // ===== BILL OPERATIONS =====

  /**
   * Get bills for unit
   * @param {string} unitId
   * @param {object} filters
   * @returns {Promise<Bill[]>}
   */
  async getUnitBills(unitId, filters = {}) {
    try {
      const conditions = [['unitId', '==', unitId]];
      if (filters.status) conditions.push(['status', '==', filters.status]);

      const snapshot = await this.firebaseService.query('bills', conditions, {
        orderBy: { field: 'dueDate', direction: 'desc' }
      });
      return snapshot.docs.map(doc => new Bill(doc.data()));
    } catch (error) {
      console.error('Error getting bills:', error);
      throw error;
    }
  }

  /**
   * Get overdue bills
   * @param {string} landlordId
   * @returns {Promise<Bill[]>}
   */
  async getOverdueBills(landlordId) {
    try {
      const conditions = [
        ['landlordId', '==', landlordId],
        ['status', 'in', ['pending', 'partial', 'overdue']]
      ];
      const snapshot = await this.firebaseService.query('bills', conditions);
      const bills = snapshot.docs.map(doc => new Bill(doc.data()));
      return bills.filter(bill => bill.isOverdue());
    } catch (error) {
      console.error('Error getting overdue bills:', error);
      throw error;
    }
  }

  /**
   * Create bill
   * @param {Bill} bill
   * @returns {Promise<string>} - Bill ID
   */
  async createBill(bill) {
    try {
      if (!bill.isValid()) {
        throw new Error('Invalid bill: ' + bill.getValidationErrors().join(', '));
      }
      return await this.firebaseService.create('bills', bill.toJSON());
    } catch (error) {
      console.error('Error creating bill:', error);
      throw error;
    }
  }

  /**
   * Update bill
   * @param {string} billId
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateBill(billId, updates) {
    try {
      await this.firebaseService.update('bills', billId, updates);
    } catch (error) {
      console.error('Error updating bill:', error);
      throw error;
    }
  }

  // ===== MAINTENANCE REQUEST OPERATIONS =====

  /**
   * Get maintenance requests for unit
   * @param {string} unitId
   * @returns {Promise<MaintenanceRequest[]>}
   */
  async getUnitMaintenanceRequests(unitId) {
    try {
      const conditions = [['unitId', '==', unitId]];
      const snapshot = await this.firebaseService.query('maintenanceRequests', conditions, {
        orderBy: { field: 'createdAt', direction: 'desc' }
      });
      return snapshot.docs.map(doc => new MaintenanceRequest(doc.data()));
    } catch (error) {
      console.error('Error getting maintenance requests:', error);
      throw error;
    }
  }

  /**
   * Get open maintenance requests for property
   * @param {string} propertyId
   * @returns {Promise<MaintenanceRequest[]>}
   */
  async getPropertyOpenRequests(propertyId) {
    try {
      const conditions = [
        ['propertyId', '==', propertyId],
        ['status', 'in', ['open', 'assigned', 'in-progress']]
      ];
      const snapshot = await this.firebaseService.query('maintenanceRequests', conditions);
      return snapshot.docs.map(doc => new MaintenanceRequest(doc.data()));
    } catch (error) {
      console.error('Error getting open requests:', error);
      throw error;
    }
  }

  /**
   * Create maintenance request
   * @param {MaintenanceRequest} request
   * @returns {Promise<string>} - Request ID
   */
  async createMaintenanceRequest(request) {
    try {
      // Ensure caller is an authenticated tenant
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required to create maintenance requests');
      }
      if (user.role !== 'tenant') {
        throw new Error('Only tenants can create maintenance requests');
      }

      // Accept either a MaintenanceRequest instance or plain object
      let reqObj = request;
      if (!request || typeof request.isValid !== 'function') {
        reqObj = new MaintenanceRequest(Object.assign({}, request || {}));
      }

      // Ensure tenant identity is enforced server-side
      reqObj.tenantId = reqObj.tenantId || user.uid || user.id;
      reqObj.reportedBy = reqObj.reportedBy || user.name || user.email || '';
      reqObj.createdAt = reqObj.createdAt || new Date().toISOString();

      if (!reqObj.isValid()) {
        throw new Error('Invalid request: ' + reqObj.getValidationErrors().join(', '));
      }

      return await this.firebaseService.create('maintenanceRequests', reqObj.toJSON());
    } catch (error) {
      console.error('Error creating maintenance request:', error);
      throw error;
    }
  }

  /**
   * Update maintenance request
   * @param {string} requestId
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateMaintenanceRequest(requestId, updates) {
    try {
      await this.firebaseService.update('maintenanceRequests', requestId, updates);
    } catch (error) {
      console.error('Error updating maintenance request:', error);
      throw error;
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataService;
}

// Compatibility shims for older controllers expecting simpler method names
// These delegate to DataManager (if present) or to existing DataService methods
if (typeof window !== 'undefined') {
  // provide instance-level shims by patching prototype
  (function() {
    const proto = DataService.prototype;

    proto.getProperties = async function() {
      try {
        // Get user ID from multiple possible sources
        const userId = await this.getCurrentUserId();
        if (!userId) {
          console.warn('⚠️ No authenticated user for getProperties');
          return [];
        }

        if (typeof DataManager !== 'undefined' && typeof DataManager.getProperties === 'function') {
          return await DataManager.getProperties(userId);
        }
        return await this.getLandlordProperties(userId);
      } catch (e) {
        console.error('Compatibility shim getProperties error:', e);
        return [];
      }
    };

    proto.getTenants = async function() {
      try {
        // Get user to check if landlord
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn('⚠️ No authenticated user for getTenants');
          return [];
        }

        // If user is landlord, get their tenants
        if (user.role === 'landlord') {
          if (typeof DataManager !== 'undefined' && typeof DataManager.getTenants === 'function') {
            return await DataManager.getTenants(user.uid);
          }
          // Get tenants for this landlord
          const conditions = [['landlordId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('users', conditions);
          return snapshot.docs.map(doc => new User(doc.data()));
        }
        
        // For other roles, return empty or just their own data
        return [user];
      } catch (e) {
        console.error('Compatibility shim getTenants error:', e);
        return [];
      }
    };

    proto.getBills = async function() {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn('⚠️ No authenticated user for getBills');
          return [];
        }

        if (typeof DataManager !== 'undefined' && typeof DataManager.getBills === 'function') {
          return await DataManager.getBills(user.uid);
        }
        
        // Different query based on role
        if (user.role === 'landlord') {
          const conditions = [['landlordId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('bills', conditions);
          return snapshot.docs.map(doc => new Bill(doc.data()));
        } else if (user.role === 'tenant') {
          const conditions = [['tenantId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('bills', conditions);
          return snapshot.docs.map(doc => new Bill(doc.data()));
        }
        
        return [];
      } catch (e) {
        console.error('Compatibility shim getBills error:', e);
        return [];
      }
    };

    proto.getMaintenanceRequests = async function() {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn('⚠️ No authenticated user for getMaintenanceRequests');
          return [];
        }

        if (typeof DataManager !== 'undefined' && typeof DataManager.getMaintenanceRequests === 'function') {
          return await DataManager.getMaintenanceRequests(user.uid);
        }
        
        // Different query based on role
        if (user.role === 'landlord') {
          const conditions = [['landlordId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('maintenanceRequests', conditions);
          return snapshot.docs.map(doc => new MaintenanceRequest(doc.data()));
        } else if (user.role === 'tenant') {
          const conditions = [['tenantId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('maintenanceRequests', conditions);
          return snapshot.docs.map(doc => new MaintenanceRequest(doc.data()));
        }
        
        return [];
      } catch (e) {
        console.error('Compatibility shim getMaintenanceRequests error:', e);
        return [];
      }
    };

    proto.getLeases = async function() {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          console.warn('⚠️ No authenticated user for getLeases');
          return [];
        }

        if (typeof DataManager !== 'undefined' && typeof DataManager.getLeases === 'function') {
          return await DataManager.getLeases(user.uid);
        }
        
        if (user.role === 'landlord') {
          const conditions = [['landlordId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('leases', conditions);
          return snapshot.docs.map(doc => new Lease(doc.data()));
        } else if (user.role === 'tenant') {
          const conditions = [['tenantId', '==', user.uid]];
          const snapshot = await this.firebaseService.query('leases', conditions);
          return snapshot.docs.map(doc => new Lease(doc.data()));
        }
        
        return [];
      } catch (e) {
        console.error('Compatibility shim getLeases error:', e);
        return [];
      }
    };

    // Helper methods to get current user safely
    proto.getCurrentUserId = async function() {
      try {
        // Try multiple sources in order
        if (window.currentUser && window.currentUser.uid) {
          return window.currentUser.uid;
        }
        
        if (window.firebase && window.firebase.auth().currentUser) {
          return window.firebase.auth().currentUser.uid;
        }
        
        // Check AuthManager
        if (window.AuthManager) {
          const user = await AuthManager.getCurrentUserWithAdminStatus();
          if (user && user.uid) {
            return user.uid;
          }
        }
        
        // Check DataManager
        if (window.DataManager && window.DataManager.currentUser) {
          return window.DataManager.currentUser.uid;
        }
        
        return null;
      } catch (error) {
        console.warn('Error getting current user ID:', error);
        return null;
      }
    };

    proto.getCurrentUser = async function() {
      try {
        // Try multiple sources in order
        if (window.currentUser) {
          return window.currentUser;
        }
        
        // Check AuthManager
        if (window.AuthManager) {
          const user = await AuthManager.getCurrentUserWithAdminStatus();
          if (user) {
            window.currentUser = user; // Cache for future use
            return user;
          }
        }
        
        // Check Firebase auth
        if (window.firebase && window.firebase.auth().currentUser) {
          const firebaseUser = window.firebase.auth().currentUser;
          // Fetch full user data from Firestore
          const userDoc = await this.firebaseService.read('users', firebaseUser.uid);
          if (userDoc) {
            const user = new User(userDoc.data());
            user.uid = firebaseUser.uid;
            window.currentUser = user;
            return user;
          }
        }
        
        return null;
      } catch (error) {
        console.warn('Error getting current user:', error);
        return null;
      }
    };

    // Add dashboard stats method
    proto.getDashboardStats = async function() {
      try {
        const user = await this.getCurrentUser();
        if (!user) {
          return this.getEmptyStats();
        }

        const [properties, tenants, bills, maintenance] = await Promise.all([
          this.getProperties(),
          this.getTenants(),
          this.getBills(),
          this.getMaintenanceRequests()
        ]);

        return {
          properties: properties.length,
          tenants: tenants.length,
          overdueBills: bills.filter(b => b.status === 'overdue').length,
          pendingRequests: maintenance.filter(m => m.status !== 'closed').length
        };
      } catch (error) {
        console.error('Error getting dashboard stats:', error);
        return this.getEmptyStats();
      }
    };

    proto.getEmptyStats = function() {
      return {
        properties: 0,
        tenants: 0,
        overdueBills: 0,
        pendingRequests: 0
      };
    };

  })();
}