class ModalManager {
    static openModal(content, options = {}) {
        const modal = document.createElement('div');
        // include "active" class for CSS rules that hide by default (e.g. properties.css)
        modal.className = 'modal-overlay active';
        
        // Build footer
        let footerContent = '';
        if (options.showFooter !== false) {
            let extraButtonsHTML = '';
            if (options.extraButtons && options.extraButtons.length > 0) {
                extraButtonsHTML = options.extraButtons.map((btn, index) => 
                    `<button class="${btn.className}" id="modalExtraBtn_${index}">${btn.text}</button>`
                ).join('');
            }
            
            footerContent = `
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modalCancel">${options.cancelText || 'Cancel'}</button>
                    ${extraButtonsHTML}
                    <button class="btn btn-primary" id="modalSubmit">${options.submitText || 'Save'}</button>
                </div>
            `;
        }
        
        // ⬇️ Updated modal-content with width & maxWidth
        modal.innerHTML = `
            <div class="modal-content" style="${options.width ? `width: ${options.width};` : ''} ${options.maxWidth ? `max-width: ${options.maxWidth};` : ''}">
                <div class="modal-header">
                    <h3>${options.title || 'Form'}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footerContent}
            </div>
        `;

        document.body.appendChild(modal);

        // Keep all your existing event handlers
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('#modalCancel')?.addEventListener('click', () => this.closeModal(modal));

        modal.querySelector('#modalSubmit')?.addEventListener('click', () => {
            if (options.onSubmit) options.onSubmit();
            else this.closeModal(modal);
        });

        // Extra buttons
        if (options.extraButtons && options.extraButtons.length > 0) {
            options.extraButtons.forEach((btn, index) => {
                const extraBtn = modal.querySelector(`#modalExtraBtn_${index}`);
                if (extraBtn && btn.onClick) {
                    extraBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        btn.onClick();
                    });
                }
            });
        }

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        return modal;
    }

    showTenantPaymentModal(billId) {
        // Get the bill data from Firestore
        const db = window.firebaseDb || (typeof firebaseDb !== 'undefined' && firebaseDb);
        if (!db) {
            showNotification('Database not available', 'error');
            return;
        }

        db.collection('bills').doc(billId).get().then(billDoc => {
            if (!billDoc.exists) {
                showNotification('Bill not found', 'error');
                return;
            }
            
            const bill = { id: billDoc.id, ...billDoc.data() };
            
            // Get tenant data (assuming current user is tenant)
            const tenant = { name: 'Current Tenant' }; // Placeholder
            
            // Create modal HTML
            const modalHTML = `
                <div class="modal-overlay active" id="paymentModal">
                    <div class="modal">
                        <div class="modal-header">
                            <h2>Record Payment</h2>
                            <button class="close-btn" onclick="closeModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="payment-info">
                                <h3>Record payment for ${tenant ? tenant.name : 'Tenant'}</h3>
                                
                                <!-- Bill Details -->
                                <div class="bill-details-section">
                                    <h4>Bill Details</h4>
                                    <div class="bill-detail-item">
                                        <span class="label">Amount Due:</span>
                                        <span class="value">₱${this.formatCurrency(bill.totalAmount || bill.amount || 0)}</span>
                                    </div>
                                    <div class="bill-detail-item">
                                        <span class="label">Due Date:</span>
                                        <span class="value">${this.formatDate(bill.dueDate)}</span>
                                    </div>
                                    <div class="bill-detail-item">
                                        <span class="label">Room:</span>
                                        <span class="value">${bill.roomNumber || 'N/A'}</span>
                                    </div>
                                    <div class="bill-detail-item">
                                        <span class="label">Description:</span>
                                        <span class="value">${bill.description || 'Monthly Rent'}</span>
                                    </div>
                                </div>
                                
                                <!-- Payment Form -->
                                <form id="paymentForm" class="payment-form">
                                    <!-- Payment Method -->
                                    <div class="form-group">
                                        <label for="paymentMethod">Payment Method *</label>
                                        <select id="paymentMethod" name="paymentMethod" required>
                                            <option value="">-- Select Payment Method --</option>
                                            <option value="cash">Cash</option>
                                            <option value="gcash">GCash</option>
                                            <option value="maya">Maya</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="check">Check</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Reference Number (Conditional) -->
                                    <div class="form-group" id="referenceNumberGroup" style="display: none;">
                                        <label for="referenceNumber">Reference Number</label>
                                        <input type="text" id="referenceNumber" name="referenceNumber" 
                                            placeholder="Transaction ID, receipt number, etc.">
                                        <small class="field-note">Required for GCash, Maya, and Bank Transfer</small>
                                    </div>
                                    
                                    <!-- Payment Date -->
                                    <div class="form-group">
                                        <label for="paymentDate">Payment Date *</label>
                                        <input type="date" id="paymentDate" name="paymentDate" required 
                                            value="${this.getCurrentDate()}">
                                    </div>
                                    
                                    <!-- Amount Paid -->
                                    <div class="form-group">
                                        <label for="amountPaid">Amount Paid *</label>
                                        <div class="currency-input">
                                            <span class="currency-symbol">₱</span>
                                            <input type="number" id="amountPaid" name="amountPaid" 
                                                min="0" step="0.01" value="${bill.totalAmount || bill.amount || 0}" required>
                                        </div>
                                        <small class="field-note">Enter the actual amount received</small>
                                    </div>
                                    
                                    <!-- Notes -->
                                    <div class="form-group">
                                        <label for="paymentNotes">Notes (Optional)</label>
                                        <textarea id="paymentNotes" name="paymentNotes" 
                                                placeholder="Additional notes about this payment" 
                                                rows="3"></textarea>
                                    </div>
                                    
                                    <!-- Payment Instructions -->
                                    <div class="payment-instructions">
                                        <p><strong>Payment Instructions:</strong></p>
                                        <p>Please note that payment submission is recorded. Your landlord will verify the payment and update the status accordingly.</p>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="submitTenantPayment('${billId}', '${bill.landlordId || ''}')">Record Payment</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Add event listener for payment method change
            document.getElementById('paymentMethod').addEventListener('change', function() {
                this.toggleReferenceNumberField(this.value);
            }.bind(this));
            
            // Initialize reference number field visibility
            this.toggleReferenceNumberField(document.getElementById('paymentMethod').value);
        }).catch(error => {
            console.error('Error fetching bill:', error);
            showNotification('Error loading bill details', 'error');
        });
    }

    getCurrentDate() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    toggleReferenceNumberField(paymentMethod) {
        const referenceNumberGroup = document.getElementById('referenceNumberGroup');
        const referenceNumberInput = document.getElementById('referenceNumber');
        
        if (['gcash', 'maya', 'bank_transfer'].includes(paymentMethod)) {
            referenceNumberGroup.style.display = 'block';
            referenceNumberInput.required = true;
        } else {
            referenceNumberGroup.style.display = 'none';
            referenceNumberInput.required = false;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatDate(dateString) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-PH', options);
}

getBillById(billId) {
    // Implementation depends on your data structure
    // This is a placeholder - replace with your actual data retrieval
    const bills = getBillsForTenant(); // Assuming you have this function
    return bills.find(bill => bill.id === billId);
}

    // Function to submit tenant payment
    async submitTenantPayment(billId, landlordId) {
        const form = document.getElementById('paymentForm');
        
        // Validate form
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Get bill data first to populate payment data
        let billData = null;
        try {
            const db = window.firebaseDb || (typeof firebaseDb !== 'undefined' && firebaseDb);
            if (db) {
                const billDoc = await db.collection('bills').doc(billId).get();
                if (billDoc.exists) {
                    billData = billDoc.data();
                }
            }
        } catch (e) {
            console.warn('Could not fetch bill data:', e);
        }
        
        // Get form data
        const formData = new FormData(form);
        const currentUser = window.currentUser || (typeof currentUser !== 'undefined' && currentUser);
        const paymentData = {
            billId: billId,
            tenantId: billData?.tenantId || currentUser?.id || currentUser?.uid || null,
            landlordId: landlordId || billData?.landlordId || null,
            tenantName: billData?.tenantName || currentUser?.name || '',
            roomNumber: billData?.roomNumber || '',
            paymentMethod: formData.get('paymentMethod'),
            referenceNumber: formData.get('referenceNumber') || '',
            paymentDate: formData.get('paymentDate'),
            amount: parseFloat(formData.get('amountPaid')),
            amountPaid: parseFloat(formData.get('amountPaid')),
            notes: formData.get('paymentNotes') || '',
            status: 'waiting_verification', // Payment needs landlord verification (NOT 'pending')
            submittedAt: new Date().toISOString()
        };
        
        try {
            // Show loading state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            // Save payment to database (use DataManager.recordPayment)
            let paymentId = null;
            const dm = window.DataManager || (typeof DataManager !== 'undefined' && DataManager);
            if (dm && dm.recordPayment) {
                paymentId = await dm.recordPayment(paymentData);
            } else {
                // Fallback: try global firebaseDb if available
                const db = window.firebaseDb || (typeof firebaseDb !== 'undefined' && firebaseDb);
                if (db) {
                    const paymentRef = await db.collection('payments').add({ ...paymentData, processedAt: new Date().toISOString() });
                    paymentId = paymentRef.id;
                } else {
                    throw new Error('No DataManager or firebaseDb available to save payment');
                }
            }
            
            // Update related bill to indicate pending verification
            try {
                const db = window.firebaseDb || (typeof firebaseDb !== 'undefined' && firebaseDb);
                if (db) {
                    await db.collection('bills').doc(billId).update({
                        status: 'payment_pending',
                        lastUpdated: new Date().toISOString(),
                        pendingPaymentAmount: paymentData.amountPaid,
                        pendingPaymentDate: paymentData.paymentDate,
                        isPaymentVerified: false
                    });
                }
            } catch (e) {
                console.warn('Could not update bill status after payment submission:', e);
            }

            // Create activity for payment submission - USE DataManager for consistency
            try {
                const ts = new Date().toISOString();
                const finalLandlordId = landlordId || paymentData.landlordId || billData?.landlordId || billData?.createdBy || billData?.ownerId || null;
                paymentData.landlordId = finalLandlordId;

                console.log('📝 Creating payment activity with data:', {
                    type: 'payment_submitted',
                    tenantId: paymentData.tenantId,
                    landlordId: finalLandlordId,
                    paymentId: paymentId,
                    billId: billId,
                    billDataLandlordId: billData?.landlordId,
                    paymentDataLandlordId: paymentData.landlordId,
                    passedLandlordId: landlordId
                });

                const activityData = {
                    type: 'payment_submitted',
                    paymentId: paymentId,
                    billId: billId,
                    tenantId: paymentData.tenantId || null,
                    landlordId: finalLandlordId,
                    amount: paymentData.amountPaid,
                    title: 'Payment Submitted',
                    message: `Tenant ${paymentData.tenantName || 'Unknown'} submitted a payment of ₱${paymentData.amountPaid} for bill ${billId}`,
                    createdAt: ts,
                    timestamp: ts,
                    isSeen: 'unseen',
                    icon: 'fas fa-credit-card',
                    color: 'var(--warning)',
                    data: {
                        paymentId: paymentId,
                        billId: billId,
                        tenantName: paymentData.tenantName,
                        roomNumber: paymentData.roomNumber,
                        amount: paymentData.amountPaid
                    }
                };

                // Use DataManager.addActivity for consistency with other activity creation
                const dm = window.DataManager || (typeof DataManager !== 'undefined' && DataManager);
                if (dm && dm.addActivity) {
                    const result = await dm.addActivity(activityData);
                    console.log('✅ Activity created via DataManager for payment submission, ID:', result.id, 'for landlord:', finalLandlordId);
                } else {
                    // Fallback to direct Firestore
                    const db = window.firebaseDb || (typeof firebaseDb !== 'undefined' && firebaseDb);
                    if (db) {
                        const docRef = await db.collection('activities').add(activityData);
                        console.log('✅ Activity created directly in Firestore for payment submission, ID:', docRef.id, 'for landlord:', finalLandlordId);
                    } else {
                        console.error('❌ No DataManager or firebaseDb available for activity creation');
                        throw new Error('No database connection');
                    }
                }
            } catch (actErr) {
                console.error('❌ Could not create activity for payment submission:', actErr);
                // Continue with payment submission even if activity creation fails
            }

            // Optionally notify landlord (create a notification record)
            try {
                if (typeof firebaseDb !== 'undefined') {
                    const notification = {
                        type: 'payment_submitted',
                        title: 'New Payment Submitted',
                        message: `Tenant submitted a payment of ₱${paymentData.amountPaid}`,
                        paymentId: null,
                        billId: billId,
                        tenantId: paymentData.tenantId,
                        landlordId: paymentData.landlordId,
                        read: false,
                        createdAt: new Date().toISOString(),
                        actionRequired: true
                    };
                    await firebaseDb.collection('notifications').add(notification);
                }
            } catch (e) {
                console.warn('Could not create notification for landlord:', e);
            }

            // Show success message
            showNotification('Payment submitted successfully! Your landlord will verify it shortly.', 'success');

            // Close modal
            closeModal();

            // Refresh the bills section
            refreshTenantBills();
            
        } catch (error) {
            console.error('Error submitting payment:', error);
            showNotification('Failed to submit payment. Please try again.', 'error');
            
            // Reset button state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Record Payment';
        }
    }

    


    static closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    static closeAllModals() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });
    }
}
// expose both capitalized and lowercase for backwards compatibility
window.ModalManager = ModalManager;
window.ModalManager = ModalManager;