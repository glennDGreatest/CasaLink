class SectionManager {
    constructor() {
        this.currentSection = 'dashboardSection';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Navigation links in header and sidebar
        document.querySelectorAll('.nav-links a[data-section], .sidebar-menu a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('data-section');
                if (section && section !== 'logout') {
                    this.showSection(section);
                }
            });
        });

        // Logout buttons
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout);
        document.getElementById('sidebarLogoutBtn')?.addEventListener('click', this.handleLogout);

        // Demo buttons for functionality
        document.getElementById('createFirstRequest')?.addEventListener('click', () => {
            this.showSection('maintenanceSection');
        });

        document.getElementById('payBalanceBtn')?.addEventListener('click', () => {
            this.showPayModal();
        });

        document.getElementById('newRequestBtn')?.addEventListener('click', () => {
            this.showMaintenanceModal();
        });
    }

    showSection(sectionId) {
        console.log('Switching to section:', sectionId);
        // If target is already active, do nothing
        const targetSection = document.getElementById(sectionId);
        const currentActive = document.querySelector('.dashboard-section.active');
        if (currentActive && currentActive.id === sectionId) {
            return;
        }

        const showTarget = () => {
            if (!targetSection) return;
            // Ensure it's visible for the animation
            targetSection.style.display = 'block';

            // Force a reflow so transitions/animations run
            // eslint-disable-next-line no-unused-expressions
            targetSection.offsetHeight;

            targetSection.classList.add('active');
            targetSection.classList.add('section-enter');

            // Remove the enter class after animation completes
            setTimeout(() => {
                targetSection.classList.remove('section-enter');
            }, 420);
        };

        // If there is a currently active section, animate it out first
        if (currentActive) {
            // Start exit animation
            currentActive.classList.remove('section-enter');
            currentActive.classList.add('section-exit');

            // After exit animation, hide it and show target
            setTimeout(() => {
                currentActive.classList.remove('active', 'section-exit');
                currentActive.style.display = 'none';
                showTarget();
            }, 320);
        } else {
            // No active section, show immediately
            showTarget();
        }
            
            // Initialize charts if showing reports section
            if (sectionId === 'reportsSection') {
                console.log('Initializing reports section...');

                // Ensure ReportsManager is initialized and reports data is refreshed
                const ensureReportsInit = async () => {
                    try {
                        // Create or init reportsManager if missing
                        if (!window.reportsManager && (window.dataManager || window.DataManager) && window.casaLink && window.casaLink.currentUser) {
                            window.reportsManager = new ReportsManager(window.dataManager || window.DataManager);
                            await window.reportsManager.init(window.casaLink.currentUser);
                            console.log('✅ ReportsManager auto-initialized');
                        } else if (window.reportsManager && (!window.reportsManager.currentUser || window.reportsManager.currentUser.uid !== window.casaLink.currentUser?.uid)) {
                            // If reportsManager exists but not initialized for this user, init it
                            if (typeof window.reportsManager.init === 'function' && window.casaLink && window.casaLink.currentUser) {
                                await window.reportsManager.init(window.casaLink.currentUser);
                                console.log('✅ ReportsManager re-initialized for current user');
                            }
                        }

                        // Refresh reports data via CasaLink if available
                        if (window.casaLink && typeof window.casaLink.refreshReportsData === 'function') {
                            await window.casaLink.refreshReportsData();
                        }

                        // Initialize charts after data is ready
                        if (window.chartsManager) {
                            setTimeout(() => {
                                window.chartsManager.initializeAllCharts(window.reportsData || {});
                            }, 100);
                        }
                    } catch (e) {
                        console.warn('Could not auto-initialize ReportsManager or refresh reports:', e);
                        // Still attempt to initialize charts with any available data
                        if (window.chartsManager) {
                            setTimeout(() => {
                                window.chartsManager.initializeAllCharts(window.reportsData || {});
                            }, 100);
                        }
                    }
                };

                ensureReportsInit();
            }

        // Update active nav links
        document.querySelectorAll('.nav-links a[data-section], .sidebar-menu a[data-section]').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            }
        });

        this.currentSection = sectionId;
        
        // Update page title
        this.updatePageTitle(sectionId);
    }

    updatePageTitle(sectionId) {
        const titles = {
            'dashboardSection': 'Dashboard',
            'billingSection': 'Billing & Payments', 
            'maintenanceSection': 'Maintenance',
            'reportsSection': 'Reports & Analytics',
            'profileSection': 'My Profile'
        };
        
        const title = titles[sectionId] || 'CasaLink';
        document.title = `${title} - CasaLink`;
    }

    handleLogout(e) {
        e.preventDefault();
        // Show loading spinner
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        
        // Simulate logout process
        setTimeout(() => {
            alert('Logged out successfully!');
            // In real app, this would redirect to login page
            // For demo, just show login screen again
            document.getElementById('loadingSpinner').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            window.sectionManager.showSection('dashboardSection');
        }, 1000);
    }

    showPayModal() {
        // Open a polished payment modal using the centralized ModalManager and PaymentFormManager
        try {
            const tenantName = (window.casaLink && window.casaLink.currentUser && window.casaLink.currentUser.name) || 'Tenant';
            const amountDue = '0.00';
            const dueDate = new Date().toISOString().split('T')[0];

            const content = `
                <div class="payment-form-container">
                    <div class="payment-header-row">
                        <div>
                            <div style="font-size:14px; color:var(--dark-gray);">Paying as</div>
                            <div style="font-weight:700; color:var(--text-dark);">${this.escapeHtml ? this.escapeHtml(tenantName) : tenantName}</div>
                        </div>
                        <div style="text-align:right">
                            <div style="font-size:12px; color:var(--dark-gray);">Amount Due</div>
                            <div style="font-weight:800; color:var(--royal-blue); font-size:18px;">₱${amountDue}</div>
                            <div style="font-size:12px; color:var(--dark-gray);">Due ${dueDate}</div>
                        </div>
                    </div>

                    <div class="payment-method-section">
                        <h4>Choose Payment Method</h4>
                        ${typeof PaymentFormManager !== 'undefined' ? PaymentFormManager.generatePaymentMethodSelector() : '<p style="color:#888;">Payment methods unavailable</p>'}
                    </div>

                    <div id="dynamicPaymentFields" style="display:none;"></div>
                    <div id="paymentError" style="display:none; margin-top:12px; color:var(--danger);"></div>
                </div>
            `;

            const modal = window.ModalManager.openModal(content, {
                title: 'Make a Payment',
                submitText: 'Submit Payment',
                cancelText: 'Cancel',
                width: '600px',
                maxWidth: '100%'
            });

            // Attach behavior: method selection -> render dynamic fields
            setTimeout(() => {
                const methodCards = modal.querySelectorAll('.payment-method-card');
                let selected = null;
                methodCards.forEach(card => {
                    card.addEventListener('click', () => {
                        methodCards.forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        selected = card.getAttribute('data-method-id');
                        const container = modal.querySelector('#dynamicPaymentFields');
                        if (typeof PaymentFormManager !== 'undefined') {
                            container.innerHTML = PaymentFormManager.generatePaymentFormFields(selected, { totalAmount: amountDue }, {});
                            container.style.display = 'block';
                            // Setup file upload handlers if available
                            setTimeout(() => {
                                if (PaymentFormManager.setupFileUploadHandlers) PaymentFormManager.setupFileUploadHandlers();
                            }, 0);
                        }
                    });
                });

                // Submit handler (wired through ModalManager's submit button)
                const submitHandler = async (e, modalEl) => {
                    const selectedCard = modalEl.querySelector('.payment-method-card.selected');
                    if (!selectedCard) {
                        const err = modalEl.querySelector('#paymentError');
                        if (err) { err.textContent = 'Please select a payment method'; err.style.display = 'block'; }
                        return;
                    }
                    const method = selectedCard.getAttribute('data-method-id');
                    // Validate via PaymentFormManager if available
                    if (typeof PaymentFormManager !== 'undefined') {
                        const validation = PaymentFormManager.validatePaymentForm(method);
                        if (!validation.isValid) {
                            const err = modalEl.querySelector('#paymentError');
                            if (err) { err.textContent = validation.errors[0] || 'Validation failed'; err.style.display = 'block'; }
                            return;
                        }

                        // Get formData and save using DataManager if available
                        const formData = PaymentFormManager.getFormData(method, { totalAmount: amountDue });
                        try {
                            const submitBtn = modalEl.querySelector('.modal-footer .btn-primary');
                            submitBtn.disabled = true;
                            const original = submitBtn.innerHTML;
                            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                            let paymentId = null;
                            const dm = window.DataManager || (typeof DataManager !== 'undefined' && DataManager);
                            if (dm && dm.recordPayment) {
                                paymentId = await dm.recordPayment(formData);
                            }

                            // Use notification + close
                            if (window.showNotification) window.showNotification('Payment submitted. Awaiting verification.', 'success');
                            window.ModalManager.closeModal(modalEl);
                        } catch (err) {
                            const errEl = modalEl.querySelector('#paymentError');
                            if (errEl) { errEl.textContent = err.message || 'Failed to submit payment'; errEl.style.display = 'block'; }
                        }
                    } else {
                        // Fallback: just close and show message
                        window.ModalManager.closeModal(modalEl);
                        if (window.showNotification) window.showNotification('Payment submitted (demo).', 'info');
                    }
                };

                // replace existing submit handler to wire validation
                const submitBtn = modal.querySelector('#modalSubmit') || modal.querySelector('.modal-footer .btn-primary');
                if (submitBtn) {
                    submitBtn.replaceWith(submitBtn.cloneNode(true));
                    const newSubmit = modal.querySelector('#modalSubmit') || modal.querySelector('.modal-footer .btn-primary');
                    if (newSubmit) newSubmit.addEventListener('click', (e) => submitHandler(e, modal));
                }
            }, 50);

        } catch (e) {
            console.error('Error opening payment modal:', e);
            alert('Unable to open payment modal');
        }
    }

    showMaintenanceModal() {
        alert('Maintenance request modal would open here. This is a demo feature.');
    }

    // Method to refresh current section
    refreshCurrentSection() {
        this.showSection(this.currentSection);
    }
}