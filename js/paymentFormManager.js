/**
 * Payment Form Manager
 * Handles dynamic payment form generation based on payment method
 */

class PaymentFormManager {
    static PAYMENT_METHODS = {
        cash: {
            id: 'cash',
            name: 'Cash',
            icon: 'fas fa-money-bill-wave',
            color: '#22C55E'
        },
        gcash: {
            id: 'gcash',
            name: 'GCash',
            icon: 'fas fa-mobile-alt',
            color: '#0066FF'
        },
        maya: {
            id: 'maya',
            name: 'Maya',
            icon: 'fas fa-wallet',
            color: '#FF6B35'
        },
        bank_transfer: {
            id: 'bank_transfer',
            name: 'Bank Transfer',
            icon: 'fas fa-university',
            color: '#162660'
        }
    };

    /**
     * Generate payment method selector buttons
     */
    static generatePaymentMethodSelector() {
        let html = '<div class="payment-method-selector">';
        
        Object.values(this.PAYMENT_METHODS).forEach(method => {
            html += `
                <div class="payment-method-card" data-method-id="${method.id}">
                    <i class="${method.icon} payment-method-card-icon"></i>
                    <span class="payment-method-card-name">${method.name}</span>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Generate form fields based on payment method
     */
    static generatePaymentFormFields(paymentMethod, bill) {
        let fieldsHTML = '';

        switch(paymentMethod) {
            case 'cash':
                fieldsHTML = this.generateCashForm(bill);
                break;
            case 'gcash':
                fieldsHTML = this.generateGCashForm(bill);
                break;
            case 'maya':
                fieldsHTML = this.generateMayaForm(bill);
                break;
            case 'bank_transfer':
                fieldsHTML = this.generateBankTransferForm(bill);
                break;
            default:
                fieldsHTML = '<p style="color: #5f6368;">Please select a payment method</p>';
        }

        return fieldsHTML;
    }

    /**
     * Cash payment form
     */
    static generateCashForm(bill) {
        return `
            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-info-circle"></i>
                    Instructions
                </div>
                <div class="payment-instructions-box">
                    <i class="fas fa-hand-holding-usd"></i>
                    Knock at the landlord's door and give the cash payment to him/her and take a picture as proof. 
                    If landlord is not around, kindly check at a later moment.
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Payment Date <span class="required">*</span>
                </label>
                <input type="datetime-local" 
                       class="form-input-payment payment-date" 
                       value="${(() => { const now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); })()}" 
                       readonly
                       required>
                <div class="form-field-hint">Auto-selected to today's date and time</div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Amount Paid <span class="required">*</span>
                </label>
                <div style="display: flex; align-items: center;">
                    <span style="margin-right: 8px; font-size: 14px; font-weight: 600; color: #202124;">₱</span>
                    <input type="number" 
                           class="form-input-payment payment-amount" 
                           placeholder="0.00" 
                           value="${bill.totalAmount || 0}" 
                           step="0.01" 
                           min="0" 
                           readonly
                           required>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Photo Evidence (Image) <span class="required">*</span>
                </label>
                <div class="file-upload-box" id="photoEvidenceBox">
                    <i class="fas fa-image file-upload-icon"></i>
                    <div class="file-upload-text">Click to upload or drag image here</div>
                    <div class="file-upload-hint">JPG, PNG (Max 5MB)</div>
                    <input type="file" class="payment-photo-evidence" accept="image/jpeg,image/png,image/jpg" style="display: none;" required>
                    <div class="file-upload-preview" id="photoPreview"></div>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Notes (Optional)
                </label>
                <textarea class="form-textarea-payment payment-notes" 
                          placeholder="Any additional notes about this payment..."
                          rows="3"></textarea>
            </div>
        `;
    }

    /**
     * GCash payment form
     */
    static generateGCashForm(bill) {
        return `
            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-info-circle"></i>
                    Instructions
                </div>
                <div class="payment-instructions-box">
                    <i class="fas fa-mobile-alt"></i>
                    Take a screenshot of the QR Code provided and upload it to the GCash App. 
                    Make sure to take a screenshot as proof of payment and upload it here.
                </div>
            </div>

            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-qrcode"></i>
                    GCash QR Code
                </div>
                <div class="qr-code-container">
                    <img src="icons/payments/gcash.png" alt="GCash QR Code" class="qr-code-image">
                    <p style="font-size: 12px; color: #5f6368; margin: 0;">Scan this QR code with your GCash App</p>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Payment Date <span class="required">*</span>
                </label>
                <input type="datetime-local" 
                       class="form-input-payment payment-date" 
                       value="${(() => { const now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); })()}" 
                       readonly
                       required>
                <div class="form-field-hint">Auto-selected to today's date and time</div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Amount Paid <span class="required">*</span>
                </label>
                <div style="display: flex; align-items: center;">
                    <span style="margin-right: 8px; font-size: 14px; font-weight: 600; color: #202124;">₱</span>
                    <input type="number" 
                           class="form-input-payment payment-amount" 
                           placeholder="0.00" 
                           value="${bill.totalAmount || 0}" 
                           step="0.01" 
                           min="0" 
                           readonly
                           required>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Photo Evidence (Screenshot from GCash) <span class="required">*</span>
                </label>
                <div class="file-upload-box" id="photoEvidenceBox">
                    <i class="fas fa-image file-upload-icon"></i>
                    <div class="file-upload-text">Click to upload or drag image here</div>
                    <div class="file-upload-hint">JPG, PNG (Max 5MB)</div>
                    <input type="file" class="payment-photo-evidence" accept="image/jpeg,image/png,image/jpg" style="display: none;" required>
                    <div class="file-upload-preview" id="photoPreview"></div>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Notes (Optional)
                </label>
                <textarea class="form-textarea-payment payment-notes" 
                          placeholder="Any additional notes about this payment..."
                          rows="3"></textarea>
            </div>
        `;
    }

    /**
     * Maya payment form
     */
    static generateMayaForm(bill) {
        return `
            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-info-circle"></i>
                    Instructions
                </div>
                <div class="payment-instructions-box">
                    <i class="fas fa-wallet"></i>
                    Take a screenshot of the QR Code provided and upload it to the Maya App. 
                    Make sure to take a screenshot as proof of payment and upload it here.
                </div>
            </div>

            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-qrcode"></i>
                    Maya QR Code
                </div>
                <div class="qr-code-container">
                    <img src="icons/payments/maya.png" alt="Maya QR Code" class="qr-code-image">
                    <p style="font-size: 12px; color: #5f6368; margin: 0;">Scan this QR code with your Maya App</p>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Payment Date <span class="required">*</span>
                </label>
                <input type="datetime-local" 
                       class="form-input-payment payment-date" 
                       value="${(() => { const now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); })()}" 
                       readonly
                       required>
                <div class="form-field-hint">Auto-selected to today's date and time</div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Amount Paid <span class="required">*</span>
                </label>
                <div style="display: flex; align-items: center;">
                    <span style="margin-right: 8px; font-size: 14px; font-weight: 600; color: #202124;">₱</span>
                    <input type="number" 
                           class="form-input-payment payment-amount" 
                           placeholder="0.00" 
                           value="${bill.totalAmount || 0}" 
                           step="0.01" 
                           min="0" 
                           readonly
                           required>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Photo Evidence (Screenshot from Maya) <span class="required">*</span>
                </label>
                <div class="file-upload-box" id="photoEvidenceBox">
                    <i class="fas fa-image file-upload-icon"></i>
                    <div class="file-upload-text">Click to upload or drag image here</div>
                    <div class="file-upload-hint">JPG, PNG (Max 5MB)</div>
                    <input type="file" class="payment-photo-evidence" accept="image/jpeg,image/png,image/jpg" style="display: none;" required>
                    <div class="file-upload-preview" id="photoPreview"></div>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Notes (Optional)
                </label>
                <textarea class="form-textarea-payment payment-notes" 
                          placeholder="Any additional notes about this payment..."
                          rows="3"></textarea>
            </div>
        `;
    }

    /**
     * Bank Transfer payment form
     */
    static generateBankTransferForm(bill) {
        return `
            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-info-circle"></i>
                    Instructions
                </div>
                <div class="payment-instructions-box">
                    <i class="fas fa-university"></i>
                    Enter the provided details in your Online Banking App and input the amount you intend to pay. 
                    Make sure to take a screenshot as proof of payment and upload it here.
                </div>
            </div>

            <div class="payment-form-section">
                <div class="payment-form-section-title">
                    <i class="fas fa-building"></i>
                    Landlord Bank Details
                </div>
                <div class="bank-details-box">
                    <div class="bank-detail-item">
                        <div class="bank-detail-label">Account Number</div>
                        <div class="bank-detail-value">1234567890</div>
                    </div>
                    <div class="bank-detail-item">
                        <div class="bank-detail-label">Account Name</div>
                        <div class="bank-detail-value">Landlord Name Test</div>
                    </div>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Payment Date <span class="required">*</span>
                </label>
                <input type="datetime-local" 
                       class="form-input-payment payment-date" 
                       value="${(() => { const now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); })()}" 
                       readonly
                       required>
                <div class="form-field-hint">Auto-selected to today's date and time</div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Amount Paid <span class="required">*</span>
                </label>
                <div style="display: flex; align-items: center;">
                    <span style="margin-right: 8px; font-size: 14px; font-weight: 600; color: #202124;">₱</span>
                    <input type="number" 
                           class="form-input-payment payment-amount" 
                           placeholder="0.00" 
                           value="${bill.totalAmount || 0}" 
                           step="0.01" 
                           min="0" 
                           readonly
                           required>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Photo Evidence (Screenshot from Online Banking) <span class="required">*</span>
                </label>
                <div class="file-upload-box" id="photoEvidenceBox">
                    <i class="fas fa-image file-upload-icon"></i>
                    <div class="file-upload-text">Click to upload or drag image here</div>
                    <div class="file-upload-hint">JPG, PNG (Max 5MB)</div>
                    <input type="file" class="payment-photo-evidence" accept="image/jpeg,image/png,image/jpg" style="display: none;" required>
                    <div class="file-upload-preview" id="photoPreview"></div>
                </div>
            </div>

            <div class="form-group-payment">
                <label class="form-label-payment">
                    Notes (Optional)
                </label>
                <textarea class="form-textarea-payment payment-notes" 
                          placeholder="Any additional notes about this payment..."
                          rows="3"></textarea>
            </div>
        `;
    }

    /**
     * Setup file upload handlers for image uploads
     */
    static setupFileUploadHandlers() {
        const uploadBoxes = document.querySelectorAll('.file-upload-box');
        
        uploadBoxes.forEach(box => {
            const input = box.querySelector('.payment-photo-evidence');
            
            // Click to upload
            box.addEventListener('click', (e) => {
                if (e.target !== input) {
                    input.click();
                }
            });

            // Drag and drop
            box.addEventListener('dragover', (e) => {
                e.preventDefault();
                box.classList.add('dragover');
            });

            box.addEventListener('dragleave', () => {
                box.classList.remove('dragover');
            });

            box.addEventListener('drop', (e) => {
                e.preventDefault();
                box.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files;
                    this.handleFileUpload(input);
                }
            });

            // File selection
            input.addEventListener('change', () => {
                this.handleFileUpload(input);
            });
        });
    }

    /**
     * Handle file upload and preview
     */
    static handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('File size must be less than 5MB');
            input.value = '';
            return;
        }

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            alert('Only JPG and PNG images are allowed');
            input.value = '';
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const box = input.closest('.file-upload-box');
            const preview = box.querySelector('.file-upload-preview');
            const previewHTML = `
                <img src="${e.target.result}" alt="Preview" class="file-preview-image">
                <div class="file-preview-name">${file.name}</div>
            `;
            preview.innerHTML = previewHTML;
            box.classList.add('has-file');
        };
        reader.readAsDataURL(file);
    }

    /**
     * Setup payment method selector
     */
    static setupPaymentMethodSelector(callback) {
        const methodCards = document.querySelectorAll('.payment-method-card');
        
        methodCards.forEach(card => {
            card.addEventListener('click', function() {
                // Remove previous selection
                methodCards.forEach(c => c.classList.remove('selected'));
                
                // Select this card
                this.classList.add('selected');
                
                // Get selected method
                const selectedMethod = this.getAttribute('data-method-id');
                
                // Call callback
                if (callback) {
                    callback(selectedMethod);
                }
            });
        });
    }

    /**
     * Validate payment form
     */
    static validatePaymentForm(paymentMethod) {
        const errors = [];

        // Validate payment date
        const paymentDate = document.querySelector('.payment-date');
        if (!paymentDate || !paymentDate.value) {
            errors.push('Payment date is required');
        }

        // Validate amount
        const amountInput = document.querySelector('.payment-amount');
        if (!amountInput || amountInput.value <= 0) {
            errors.push('Amount paid must be greater than 0');
        }

        // Validate photo evidence
        const photoInput = document.querySelector('.payment-photo-evidence');
        if (!photoInput || !photoInput.files.length) {
            errors.push('Photo evidence is required');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get form data
     */
    static getFormData(paymentMethod, bill) {
        const paymentDate = document.querySelector('.payment-date')?.value;
        const amount = parseFloat(document.querySelector('.payment-amount')?.value || 0);
        const notes = document.querySelector('.payment-notes')?.value || '';
        const photoInput = document.querySelector('.payment-photo-evidence');

        return {
            billId: bill.id,
            tenantId: bill.tenantId,
            landlordId: bill.landlordId,
            tenantName: bill.tenantName,
            roomNumber: bill.roomNumber,
            amount: amount,
            paymentMethod: paymentMethod,
            paymentDate: paymentDate,
            notes: notes,
            photoEvidence: photoInput?.files[0] || null,
            status: 'waiting_verification',
            submittedAt: new Date().toISOString()
        };
    }
}

// Initialize globally
if (typeof window !== 'undefined') {
    window.PaymentFormManager = PaymentFormManager;
}
