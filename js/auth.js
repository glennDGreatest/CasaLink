// js/auth.js - FIXED VERSION
class AuthManager {
    static currentAuthUnsubscribe = null;
    static creatingUserDoc = false; // Used to avoid logout while user document is still being created

    static adminEmails = [
        'admin@casalink.com',
        'superadmin@casalink.com'
        // Add more admin emails as needed
    ];
    

    static async login(email, password, role) {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase Auth not initialized');
            }
            
            console.log('🔄 Login process started...', { email, role });
            
            // Clear any existing session first
            await firebaseAuth.signOut();
            
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Firebase auth success, user:', user.uid);
            
            // Check if user exists in Firestore
            const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                // Existing user - normal login
                const userData = { 
                    id: userDoc.id,
                    ...userDoc.data(), 
                    uid: user.uid 
                };
                
                console.log('📊 User login stats:', { 
                    loginCount: userData.loginCount, 
                    hasTemporaryPassword: userData.hasTemporaryPassword,
                    passwordChanged: userData.passwordChanged 
                });

                // Prevent archived/deactivated accounts from logging in
                if (userData.archived || userData.isActive === false) {
                    await firebaseAuth.signOut();
                    throw new Error('This account has been deactivated. Please contact your landlord.');
                }
                
                // Role verification
                if (userData.role !== role) {
                    await firebaseAuth.signOut();
                    throw new Error(`This account is registered as a ${userData.role}. Please select "${userData.role}" when logging in.`);
                }
                
                // CHECK FOR PASSWORD CHANGE REQUIREMENT BEFORE INCREMENTING
                let requiresPasswordChange = false;
                if (userData.role === 'tenant' && userData.hasTemporaryPassword && !userData.passwordChanged) {
                    // Check if this is the FIRST real login (loginCount = 0)
                    if (userData.loginCount === 0) {
                        requiresPasswordChange = true;
                        console.log('🔐 FIRST real tenant login - password change REQUIRED');
                    } else {
                        console.log('✅ Subsequent login - no password change required');
                    }
                }
                
                // UPDATE LOGIN COUNT (increment after checking)
                const newLoginCount = (userData.loginCount || 0) + 1;
                const updates = {
                    loginCount: newLoginCount,
                    lastLogin: new Date().toISOString()
                };
                
                console.log('🔄 Updated login count:', newLoginCount);
                
                // Update the user document with new login count
                await firebaseDb.collection('users').doc(user.uid).update(updates);
                
                // SYNC TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager({
                    ...userData,
                    requiresPasswordChange: requiresPasswordChange
                });
                
                // Return user data with password change requirement
                return {
                    ...userData,
                    requiresPasswordChange: requiresPasswordChange
                };
                
            } else {
                // NEW USER - Auto-create tenant account
                console.log('New user detected, auto-creating tenant account...');
                
                // For now, create a basic tenant profile
                const newUserData = {
                    email: email,
                    name: email.split('@')[0], // Default name from email
                    role: 'tenant',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    hasTemporaryPassword: true,
                    loginCount: 1, // First login
                    passwordChanged: false,
                    lastLogin: new Date().toISOString()
                };
                
                await firebaseDb.collection('users').doc(user.uid).set(newUserData);
                
                console.log('Auto-created tenant account with first login');
                
                const userResponse = {
                    id: user.uid,
                    ...newUserData,
                    uid: user.uid,
                    requiresPasswordChange: true // Require password change on first login
                };
                
                // SYNC TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager(userResponse);
                
                return userResponse;
            }
            
        } catch (error) {
            console.error('Login error details:', error);
            // SYNC NULL TO DATA MANAGER ON ERROR - ADD THIS LINE
            this.syncUserToDataManager(null);
            await firebaseAuth.signOut();
            throw error;
        }
    }

     static async checkAdminStatus(userId) {
        try {
            if (!userId) return false;
            
            console.log('🛡️ Checking admin status for user:', userId);
            
            // First check against hardcoded admin emails (for development)
            const currentUser = firebaseAuth.currentUser;
            if (currentUser && currentUser.email) {
                const userEmail = currentUser.email.toLowerCase();
                if (this.adminEmails.includes(userEmail)) {
                    console.log('✅ User is admin (email in admin list):', userEmail);
                    return true;
                }
            }
            
            // Then check Firestore admin_users collection
            try {
                const adminDoc = await firebaseDb
                    .collection('admin_users')
                    .doc(userId)
                    .get();
                
                if (adminDoc.exists) {
                    const adminData = adminDoc.data();
                    if (adminData.is_active !== false) {
                        console.log('✅ User is admin (Firestore record):', userId);
                        return true;
                    }
                }
            } catch (firestoreError) {
                console.warn('⚠️ Could not check Firestore admin status:', firestoreError);
                // Continue with email check only
            }
            
            console.log('❌ User is not admin:', userId);
            return false;
            
        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            return false;
        }
    }

    static async getUserWithAdminStatus(firebaseUser) {
        try {
            if (!firebaseUser) return null;
            
            // First get the user document
            const userDoc = await firebaseDb
                .collection('users')
                .doc(firebaseUser.uid)
                .get();
            
            if (!userDoc.exists) {
                return null;
            }
            
            const userData = userDoc.data();
            
            // Check admin status
            const isAdmin = await this.checkAdminStatus(firebaseUser.uid);
            
            // Enhanced user data with admin status
            const enhancedUserData = {
                id: userDoc.id,
                uid: firebaseUser.uid,
                email: userData.email,
                name: userData.name || userData.email.split('@')[0],
                role: userData.role,
                isActive: userData.isActive !== false,
                hasTemporaryPassword: userData.hasTemporaryPassword || false,
                passwordChanged: userData.passwordChanged || false,
                requiresPasswordChange: userData.requiresPasswordChange || false,
                status: userData.status || 'active',
                loginCount: userData.loginCount || 0,
                lastLogin: userData.lastLogin,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                // Tenant specific fields
                landlordId: userData.landlordId,
                roomNumber: userData.roomNumber,
                // Landlord specific fields
                properties: userData.properties || [],
                // NEW: Admin status
                isAdmin: isAdmin,
                adminRole: isAdmin ? 'admin' : null
            };
            
            console.log('👤 User with admin status:', {
                email: enhancedUserData.email,
                role: enhancedUserData.role,
                isAdmin: enhancedUserData.isAdmin
            });
            
            return enhancedUserData;
            
        } catch (error) {
            console.error('❌ Error getting user with admin status:', error);
            return null;
        }
    }

     static toggleAdminLink(user) {
        const adminLink = document.getElementById('adminFloatingBtn');
        if (!adminLink) return;
        
        if (user && user.isAdmin) {
            console.log('🔓 Showing admin link for:', user.email);
            adminLink.style.display = 'block';
        } else {
            console.log('🔒 Hiding admin link');
            adminLink.style.display = 'none';
        }
    }

     static async getCurrentUserWithAdminStatus() {
        try {
            const currentUser = firebaseAuth.currentUser;
            if (!currentUser) return null;
            
            return await this.getUserWithAdminStatus(currentUser);
        } catch (error) {
            console.error('❌ Error getting current user with admin status:', error);
            return null;
        }
    }

     static onAuthChange(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available for auth state listener');
            return () => {};
        }
        
        // Enhanced auth state listener with admin status
        return firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            console.log('🔄 Firebase auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            
            if (firebaseUser) {
                try {
                    // Use the new method that includes admin status
                    const userData = await this.getUserWithAdminStatus(firebaseUser);
                    
                    if (userData) {
                        console.log('✅ User data with admin status loaded:', {
                            email: userData.email,
                            role: userData.role,
                            isAdmin: userData.isAdmin
                        });

                        // Prevent archived or deactivated users from remaining logged in
                        if (userData.archived || userData.isActive === false) {
                            console.warn('🚫 Archived/deactivated user detected; signing out');
                            this.syncUserToDataManager(null);
                            this.toggleAdminLink(null);
                            await this.logout();
                            callback(null);
                            return;
                        }
                        
                        // Sync to DataManager
                        this.syncUserToDataManager(userData);
                        
                        // Toggle admin link visibility
                        this.toggleAdminLink(userData);
                        
                        callback(userData);
                    } else {
                        console.error('❌ User document not found in Firestore');
                        this.syncUserToDataManager(null);
                        this.toggleAdminLink(null);
                        await this.logout();
                        callback(null);
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data in auth listener:', error);
                    this.syncUserToDataManager(null);
                    this.toggleAdminLink(null);
                    callback(null);
                }
            } else {
                console.log('👤 No Firebase user');
                this.syncUserToDataManager(null);
                this.toggleAdminLink(null);
                callback(null);
            }
        });
    }

     setUser(user) {        this.user = user;
        console.log('👤 DataManager user set:', user ? user.email : 'null');
        
        if (user) {
            // User is logged in - initialize Firestore
            this.db = firebase.firestore();
            console.log('✅ Firestore initialized for user:', user.email);
        } else {
            // User is logged out
            this.db = null;
            console.log('❌ Firestore disconnected - user logged out');
        }
    }

    static async syncUserToDataManager(userData) {
        // Ensure we have a uid for compatibility with other modules
        if (userData && !userData.uid && userData.id) {
            userData.uid = userData.id;
        }

        // Set window.currentUser FIRST
        window.currentUser = userData;
        console.log('✅ window.currentUser set:', userData ? userData.email : 'null');
        
        // DataManager sync is informational only - auth doesn't depend on it
        let dm = window.DataManager || window.dataManager || (typeof DataManager !== 'undefined' ? DataManager : null);
        if (!dm) {
            console.warn('⚠️ DataManager not yet available (non-critical) - waiting briefly');
            dm = await this.waitForDataManager(3000, 100);
        }
        if (dm) {
            console.log('✅ User data available in DataManager context:', userData ? userData.email : 'null');
            // Store user info in DataManager currentUser and user if available
            try {
                if (typeof dm.currentUser !== 'undefined') {
                    dm.currentUser = userData;
                }
                // Some older DataManager methods expect `DataManager.user` and `DataManager.db`
                dm.user = userData;
                if (userData) {
                    if (!dm.db) {
                        dm.db = firebase.firestore();
                    }
                } else {
                    dm.db = null;
                }
            } catch (e) {
                console.warn('⚠️ Failed to sync user to DataManager internals:', e);
            }
        } else {
            console.warn('⚠️ DataManager still not available after waiting - skipping DataManager sync');
        }
    }

    static async waitForDataManager(timeout = 3000, interval = 100) {
        return new Promise(resolve => {
            let elapsed = 0;

            const attempt = () => {
                const dm = window.DataManager || window.dataManager || (typeof DataManager !== 'undefined' ? DataManager : null);
                if (dm) {
                    console.log('✅ DataManager became available');
                    return resolve(dm);
                }

                elapsed += interval;
                if (elapsed >= timeout) {
                    console.warn('⚠️ DataManager wait timed out after', timeout, 'ms');
                    return resolve(null);
                }

                setTimeout(attempt, interval);
            };

            attempt();
        });
    }

    static onAuthChange(callback) {
        if (!window.firebaseAuth) {
            console.error('Firebase Auth not available for auth state listener');
            return () => {};
    }
    
    // Enhanced auth state listener for page refreshes
    return firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            console.log('🔄 Firebase auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            
            if (firebaseUser) {
                try {
                    const userDoc = await firebaseDb.collection('users').doc(firebaseUser.uid).get();
                    
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        console.log('📊 User document found:', userData.email);
                        
                        // Enhanced user data with proper refresh handling
                        const enhancedUserData = {
                            id: userDoc.id,
                            uid: firebaseUser.uid,
                            email: userData.email,
                            name: userData.name || userData.email.split('@')[0],
                            role: userData.role,
                            isActive: userData.isActive !== false, // Default to true
                            hasTemporaryPassword: userData.hasTemporaryPassword || false,
                            passwordChanged: userData.passwordChanged || false,
                            requiresPasswordChange: userData.requiresPasswordChange || false,
                            status: userData.status || 'active',
                            loginCount: userData.loginCount || 0,
                            lastLogin: userData.lastLogin,
                            createdAt: userData.createdAt,
                            updatedAt: userData.updatedAt,
                            // Tenant specific fields
                            landlordId: userData.landlordId,
                            roomNumber: userData.roomNumber,
                            // Landlord specific fields
                            properties: userData.properties || []
                        };
                        
                        console.log('✅ Enhanced user data for session:', {
                            email: enhancedUserData.email,
                            role: enhancedUserData.role,
                            requiresPasswordChange: enhancedUserData.requiresPasswordChange
                        });
                        
                        // SYNC TO DATA MANAGER - ADD THIS LINE
                        this.syncUserToDataManager(enhancedUserData);
                        
                        callback(enhancedUserData);
                    } else {
                        console.error('❌ User document not found in Firestore');

                        if (this.creatingUserDoc) {
                            console.log('⏳ Waiting briefly for user document to be created...');
                            // Wait briefly and then retry once before logging out.
                            setTimeout(async () => {
                                try {
                                    const retryDoc = await firebaseDb.collection('users').doc(firebaseUser.uid).get();
                                    if (retryDoc.exists) {
                                        const userData = retryDoc.data();
                                        const enhancedUserData = {
                                            id: retryDoc.id,
                                            uid: firebaseUser.uid,
                                            email: userData.email,
                                            name: userData.name || userData.email.split('@')[0],
                                            role: userData.role,
                                            isActive: userData.isActive !== false,
                                            hasTemporaryPassword: userData.hasTemporaryPassword || false,
                                            passwordChanged: userData.passwordChanged || false,
                                            requiresPasswordChange: userData.requiresPasswordChange || false,
                                            status: userData.status || 'active',
                                            loginCount: userData.loginCount || 0,
                                            lastLogin: userData.lastLogin,
                                            createdAt: userData.createdAt,
                                            updatedAt: userData.updatedAt,
                                            landlordId: userData.landlordId,
                                            roomNumber: userData.roomNumber,
                                            properties: userData.properties || []
                                        };
                                        this.syncUserToDataManager(enhancedUserData);
                                        callback(enhancedUserData);
                                        return;
                                    }
                                } catch (retryError) {
                                    console.warn('⚠️ Retry fetch for user document failed:', retryError);
                                }

                                console.error('❌ User document still missing after retry, logging out');
                                this.syncUserToDataManager(null);
                                await this.logout();
                                callback(null);
                            }, 1500);
                        } else {
                            // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                            this.syncUserToDataManager(null);
                            await this.logout();
                            callback(null);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data in auth listener:', error);
                    // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                    this.syncUserToDataManager(null);
                    callback(null);
                }
            } else {
                console.log('👤 No Firebase user - calling callback with null');
                // SYNC NULL TO DATA MANAGER - ADD THIS LINE
                this.syncUserToDataManager(null);
                callback(null);
            }
        });
    }


    static async changePassword(currentPassword, newPassword) {
        try {
            const user = firebaseAuth.currentUser;
            if (!user) {
                throw new Error('No user logged in');
            }

            console.log('Changing password for user:', user.email);

            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email, 
                currentPassword
            );
            
            await user.reauthenticateWithCredential(credential);
            console.log('Re-authentication successful');
            
            await user.updatePassword(newPassword);
            console.log('Password updated successfully');
            
            // UPDATE: Store current password in Firestore
            await firebaseDb.collection('users').doc(user.uid).update({
                hasTemporaryPassword: false,
                passwordChanged: true,
                passwordChangedAt: new Date().toISOString(),
                currentPassword: newPassword, // Store the new current password
                lastLogin: new Date().toISOString()
            });
            
            console.log('User record updated in Firestore with current password');
            return true;
            
        } catch (error) {
            console.error('Password change error:', error);
            throw new Error(this.getAuthErrorMessage(error.code) || 'Failed to change password');
        }
    }

    static async createTenantAccount(tenantData, temporaryPassword, landlordPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔐 Creating tenant Firebase Auth account...', tenantData.email);

                const currentUser = firebaseAuth.currentUser;
                if (!currentUser) {
                    reject(new Error('Landlord must be logged in to create tenants'));
                    return;
                }

                // Store landlord info
                const landlordEmail = currentUser.email;
                const landlordId = currentUser.uid;

                // Use the provided landlordPassword directly (no modal needed)
                if (!landlordPassword) {
                    reject(new Error('Landlord password is required'));
                    return;
                }

                // Process tenant creation directly with the provided password
                await this.processTenantCreation(tenantData, temporaryPassword, landlordPassword, null, resolve, reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    static async processTenantCreation(tenantData, temporaryPassword, landlordPassword, modal, resolve, reject) {
        try {
            const errorElement = document.getElementById('passwordConfirmError');
            const submitBtn = document.querySelector('#modalSubmit');

            if (!landlordPassword) {
                this.showPasswordError('Please enter your password');
                return;
            }

            // Show loading state
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;
            }

            const currentUser = firebaseAuth.currentUser;
            if (!currentUser) {
                throw new Error('Landlord must be logged in to create tenants');
            }

            const landlordEmail = currentUser.email;
            const landlordId = currentUser.uid;

            // Verify landlord password by trying to re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(landlordEmail, landlordPassword);
            await currentUser.reauthenticateWithCredential(credential);
            
            console.log('✅ Landlord password verified');

            // Step 1: Create tenant account (this will log out landlord)
            const tenantCredential = await firebaseAuth.createUserWithEmailAndPassword(
                tenantData.email, 
                temporaryPassword
            );
            const tenantUser = tenantCredential.user;
            
            console.log('✅ Tenant Firebase Auth account created:', tenantUser.uid);

            // Step 2: Create tenant document in Firestore - FIXED DATA STRUCTURE
            const userProfile = {
                // Basic Info
                email: tenantData.email,
                name: tenantData.name,
                role: 'tenant',

                // Contact Info
                phone: tenantData.phone || '',
                occupation: tenantData.occupation || '',
                age: tenantData.age || 0,

                // Landlord Relationship
                landlordId: landlordId,
                createdBy: landlordEmail,

                // Property Information
                roomNumber: tenantData.roomNumber || '',
                apartmentAddress: tenantData.rentalAddress || 'Lot 22 Zarate Compound Purok 4, Bakakent Norte, Baguio City',
                apartmentId: tenantData.apartmentId || null,
                apartmentName: tenantData.apartmentName || (tenantData.apartment || ''),

                // Room occupancy
                roomMembers: [tenantData.name],
                totalRoomMembers: 1,

                // Lease pointers (will be populated when lease is created)
                leaseId: null,
                currentLease: null,

                // Archived / restore metadata
                archived: false,
                archivedAt: null,
                archivedBy: null,
                restoredAt: null,
                restoredBy: null,

                // Authentication & Security
                hasTemporaryPassword: true,
                temporaryPassword: temporaryPassword,
                passwordCreatedAt: new Date().toISOString(),

                // Login Tracking
                loginCount: 0,
                passwordChanged: false,
                requiresPasswordChange: true,
                lastLogin: null,

                // Timestamps
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),

                // Status
                isActive: true,
                status: 'unverified'
            };

            console.log('📝 Creating tenant profile with data:', userProfile);

            // Remove any undefined fields to prevent Firestore errors
            Object.keys(userProfile).forEach(key => {
                if (userProfile[key] === undefined) {
                    console.log(`⚠️ Removing undefined field: ${key}`);
                    delete userProfile[key];
                }
            });

            await firebaseDb.collection('users').doc(tenantUser.uid).set(userProfile);
            console.log('✅ Tenant profile created in Firestore');

            // Step 3: Immediately restore landlord session
            console.log('🔄 Restoring landlord session...');
            await firebaseAuth.signOut();
            
            // Re-login as landlord - use the SAME password that was verified
            await firebaseAuth.signInWithEmailAndPassword(landlordEmail, landlordPassword);
            
            console.log('✅ Landlord session restored successfully');

            // Close modal and return success
            if (modal) {
                ModalManager.closeModal(modal);
            }
            
            resolve({
                success: true,
                email: tenantData.email,
                name: tenantData.name,
                temporaryPassword: temporaryPassword,
                tenantId: tenantUser.uid,
                note: 'Tenant account created successfully!'
            });

        } catch (error) {
            console.error('Error during tenant creation:', error);
            
            // Reset button
            const submitBtn = document.querySelector('#modalSubmit');
            if (submitBtn) {
                submitBtn.innerHTML = 'Create Tenant Account';
                submitBtn.disabled = false;
            }

            if (error.code === 'auth/wrong-password') {
                this.showPasswordError('Incorrect password. Please try again.');
            } else if (error.code === 'auth/email-already-in-use') {
                // Close the confirm modal (if present) and re-open the Add Tenant
                // form with previously entered values, highlighting the email field
                // and showing a user-friendly message.
                if (modal) {
                    try {
                        ModalManager.closeModal(modal);
                    } catch (e) {
                        console.warn('Could not close modal:', e);
                    }
                }

                // Build a context object for pre-filling the Add Tenant form
                const context = {
                    apartmentAddress: tenantData.apartmentAddress || tenantData.rentalAddress || '',
                    apartmentName: tenantData.apartmentName || tenantData.apartment || '',
                    prefill: {
                        name: tenantData.name || '',
                        occupation: tenantData.occupation || '',
                        age: tenantData.age || '',
                        phoneLocal: (tenantData.phone || '').replace(/^\+63/, ''),
                        email: tenantData.email || '',
                        rentalAmount: tenantData.rentalAmount || '',
                        securityDeposit: tenantData.securityDeposit || '',
                        dateOfEntry: tenantData.dateOfEntry || '',
                        firstPaymentDate: tenantData.firstPaymentDate || ''
                    },
                    emailError: 'This email address is currently in use by another user, please enter a unique email address.'
                };

                try {
                    // First, try to simulate pressing the Back button on the Confirm (password) modal
                    const tryClickBackInModal = async (modalElem) => {
                        if (!modalElem) return false;
                        // Prefer the generated extra button id, otherwise match by text
                        const btnById = modalElem.querySelector('#modalExtraBtn_0');
                        let backBtn = btnById;
                        if (!backBtn) {
                            backBtn = Array.from(modalElem.querySelectorAll('.modal-footer button'))
                                .find(b => b.textContent && b.textContent.trim().toLowerCase() === 'back');
                        }
                        if (backBtn) {
                            try {
                                backBtn.click();
                                return true;
                            } catch (e) {
                                console.warn('Back button click failed:', e);
                                return false;
                            }
                        }
                        return false;
                    };

                    let clickedConfirmBack = false;
                    // If app stores the password confirmation modal reference, use it
                    const pwModal = (window.app && window.app.passwordConfirmationModal) || document.querySelector('.modal-overlay.active');
                    if (pwModal) {
                        clickedConfirmBack = await tryClickBackInModal(pwModal);
                    }

                    // If we clicked the Confirm Back, wait shortly for the Lease Agreement modal to open
                    if (clickedConfirmBack) {
                        await new Promise(res => setTimeout(res, 140));
                        const leaseModal = (window.app && window.app.leaseAgreementModal) || document.querySelector('.modal-overlay.active');
                        const clickedLeaseBack = await tryClickBackInModal(leaseModal);

                        // After clicking Lease Back, wait for Add Tenant modal to appear
                        if (clickedLeaseBack) {
                            await new Promise(res => setTimeout(res, 200));
                            // Ensure Add Tenant modal is present and highlight email
                            const addModal = document.querySelector('.modal-overlay.active');
                            const emailInput = addModal?.querySelector('#tenantEmail');
                            if (emailInput) {
                                emailInput.style.border = '1px solid var(--danger)';
                                emailInput.style.boxShadow = '0 0 0 3px rgba(234,67,53,0.06)';
                                let emailErrElem = addModal.querySelector('#tenantEmailErrorInline');
                                if (!emailErrElem) {
                                    emailErrElem = document.createElement('div');
                                    emailErrElem.id = 'tenantEmailErrorInline';
                                    emailErrElem.style.color = 'var(--danger)';
                                    emailErrElem.style.marginTop = '6px';
                                    emailErrElem.style.fontSize = '0.95rem';
                                    emailInput.parentNode && emailInput.parentNode.appendChild(emailErrElem);
                                }
                                emailErrElem.textContent = 'This email address is currently in use by another user, please enter a unique email address.';
                                try { emailInput.focus(); } catch (e) {}
                            }

                            // reject so caller knows creation failed
                            reject(new Error('Email already in use'));
                            return;
                        }
                    }

                    // Fallback: directly reopen the Add Tenant form with prefill + emailError
                    if (window.app && typeof window.app.showAddTenantForm === 'function') {
                        const preRoom = tenantData.roomNumber || null;
                        await new Promise(res => setTimeout(res, 80));
                        await window.app.showAddTenantForm(preRoom, context);
                    } else if (window.modalManager) {
                        window.modalManager.openModal('addTenant');
                    }
                } catch (e) {
                    console.error('Failed to re-open Add Tenant form:', e);
                }

                // Reject so caller knows creation failed
                reject(new Error('Email already in use'));
            } else {
                this.showPasswordError('Failed to create account: ' + error.message);
                
                // Try to restore landlord session on other errors
                try {
                    const currentUser = firebaseAuth.currentUser;
                    if (currentUser) {
                        await firebaseAuth.signOut();
                    }
                    // Use the original landlord email and the provided password
                    await firebaseAuth.signInWithEmailAndPassword(this.currentUser?.email || 'landlord@example.com', landlordPassword);
                    console.log('✅ Landlord session restored after error');
                } catch (restoreError) {
                    console.error('Failed to restore landlord session:', restoreError);
                }
                
                reject(error);
            }
        }
    }

    static showPasswordError(message) {
        const errorElement = document.getElementById('passwordConfirmError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Create a landlord account and store relevant profile information in Firestore.
     * This includes payment QR codes and bank details used by tenants.
     *
     * @param {object} options
     * @param {string} options.email
     * @param {string} options.password
     * @param {string} options.name
     * @param {string} [options.phone]
     * @param {string} [options.bankName]
     * @param {File|null} [options.gcashQrFile]
     * @param {File|null} [options.mayaQrFile]
     * @param {string} [options.bankAccountName]
     * @param {string} [options.bankAccountNumber]
     * @returns {Promise<object>} Landlord user profile data
     */
    static async createLandlordAccount({
        email,
        password,
        name,
        phone = '',
        bankName = '',
        gcashQrFile = null,
        mayaQrFile = null,
        bankAccountName = '',
        bankAccountNumber = '',
        maintenanceStaff = []
    }) {
        try {
            console.log('🛠️ Creating landlord account for:', email);

            // Mark that we are creating a user doc so auth listener doesn't logout too early
            this.creatingUserDoc = true;

            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            const userId = user.uid;
            const now = new Date().toISOString();

            // Helper to convert a file into a base64 data URL
            const fileToBase64 = (file) => {
                if (!file) return Promise.resolve(null);
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read file for base64 conversion'));
                    reader.readAsDataURL(file);
                });
            };

            const uploadResults = {};
            if (gcashQrFile) {
                try {
                    uploadResults.gcashQrBase64 = await fileToBase64(gcashQrFile);
                } catch (e) {
                    console.warn('⚠️ Failed to convert GCash QR to base64, skipping:', e);
                    uploadResults.gcashQrBase64 = null;
                }
            }
            if (mayaQrFile) {
                try {
                    uploadResults.mayaQrBase64 = await fileToBase64(mayaQrFile);
                } catch (e) {
                    console.warn('⚠️ Failed to convert Maya QR to base64, skipping:', e);
                    uploadResults.mayaQrBase64 = null;
                }
            }

            const userDoc = {
                id: userId,
                uid: userId,
                email,
                name: name || email.split('@')[0],
                role: 'landlord',
                phone: phone || '',
                bankName: bankName || '',
                profileImage: null,
                createdAt: now,
                updatedAt: now,
                isActive: true,
                metadata: {},
                loginCount: 0,
                lastLogin: null,
                bankAccountName: bankAccountName || '',
                bankAccountNumber: bankAccountNumber || '',
                // Store QR codes as base64 to avoid storage/CORS issues
                gcashQrBase64: uploadResults.gcashQrBase64 || null,
                mayaQrBase64: uploadResults.mayaQrBase64 || null,
                maintenanceStaff: maintenanceStaff || []
            };

            // Remove undefined fields to avoid Firestore issues
            Object.keys(userDoc).forEach(key => {
                if (userDoc[key] === undefined) {
                    delete userDoc[key];
                }
            });

            await firebaseDb.collection('users').doc(userId).set(userDoc);
            console.log('✅ Landlord account created in Firestore:', email);

            // In case auth listener logged out because the doc wasn't present yet, re-sign-in
            try {
                if (!firebaseAuth.currentUser || firebaseAuth.currentUser.uid !== userId) {
                    await firebaseAuth.signInWithEmailAndPassword(email, password);
                }
            } catch (reloginError) {
                console.warn('⚠️ Failed to re-login after creating user doc:', reloginError);
            }

            // Sync user state for the application
            this.syncUserToDataManager({
                id: userId,
                ...userDoc
            });
            this.toggleAdminLink(null);

            return {
                id: userId,
                ...userDoc
            };
        } catch (error) {
            console.error('❌ Landlord account creation failed:', error);
            throw error;
        } finally {
            // Mark creation complete so auth listener can act normally
            this.creatingUserDoc = false;
        }
    }

    static getAuthErrorMessage(errorCode) {
        const errorMessages = {
            'auth/invalid-email': 'Invalid email address format',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later',
            'auth/network-request-failed': 'Network error. Please check your connection',
            'auth/email-already-in-use': 'An account with this email already exists',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled',
            'auth/requires-recent-login': 'Please log in again to change your password'
        };
        
        return errorMessages[errorCode] || 'Authentication failed. Please try again.';
    }

    static async logout() {
        try {
            // Hide admin link
            this.toggleAdminLink(null);
            
            // Sync null to DataManager
            this.syncUserToDataManager(null);
            
            if (window.firebaseAuth) {
                await firebaseAuth.signOut();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

     static async createAdminAccount(adminData) {
        try {
            console.log('🛡️ Creating admin account...', adminData.email);
            
            // Create Firebase Auth account
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
                adminData.email,
                adminData.password
            );
            
            const user = userCredential.user;
            
            // Create user document
            const userDoc = {
                email: adminData.email,
                name: adminData.name || 'System Administrator',
                role: 'admin',
                createdAt: new Date().toISOString(),
                isActive: true,
                hasTemporaryPassword: false,
                loginCount: 0,
                passwordChanged: true,
                lastLogin: null,
                isAdmin: true
            };
            
            await firebaseDb.collection('users').doc(user.uid).set(userDoc);
            
            // Create admin_users document
            const adminDoc = {
                email: adminData.email,
                name: adminData.name || 'System Administrator',
                role: 'super_admin',
                created_at: new Date().toISOString(),
                last_login: null,
                is_active: true
            };
            
            await firebaseDb.collection('admin_users').doc(user.uid).set(adminDoc);
            
            console.log('✅ Admin account created successfully:', adminData.email);
            
            // Sign out admin (since we're probably running as landlord)
            await firebaseAuth.signOut();
            
            return {
                success: true,
                email: adminData.email,
                userId: user.uid
            };
            
        } catch (error) {
            console.error('❌ Error creating admin account:', error);
            throw error;
        }
    }
}

window.AuthManager = AuthManager;