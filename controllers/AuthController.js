/**
 * AuthController
 * Handles authentication UI and user actions
 * Orchestrates login, signup, logout flows
 */
class AuthController {
  constructor(authService, dataService) {
    this.authService = authService;
    this.dataService = dataService;
    this.setupEventListeners();
  }

  /**
   * Initialize controller (called by bootstrap)
   */
  init() {
    // Ensure event listeners are attached and prepare UI state
    try {
      this.setupEventListeners();
      const authSection = document.getElementById('authSection');
      if (authSection) authSection.style.display = 'block';
    } catch (e) {
      console.warn('AuthController.init warning:', e);
    }
  }

  /**
   * Setup event listeners for auth forms
   */
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', (e) => this.handleLogin(e));

    // Signup form
    const signupForm = document.getElementById('signupForm');
    signupForm?.addEventListener('submit', (e) => this.handleSignup(e));

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => this.handleLogout());
  }

  /**
   * Handle login form submission
   * @param {Event} e
   */
  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate input
    if (!email || !password) {
      this.showError('Please enter email and password');
      return;
    }

    if (!AppHelpers.isValidEmail(email)) {
      this.showError('Please enter a valid email');
      return;
    }

    this.setLoading(true);

    try {
      const user = await this.authService.login(email, password);
      console.log('✅ Login successful:', user.email);
      
      // Store user session
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Navigate to dashboard
      this.navigateToDashboard(user);
    } catch (error) {
      const message = this.authService.getErrorMessage(error.code);
      this.showError(message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle signup form submission
   * @param {Event} e
   */
  async handleSignup(e) {
    e.preventDefault();

    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const name = document.getElementById('name').value.trim();
    const role = document.getElementById('role').value;

    // Validate input
    const errors = this.validateSignupForm(email, password, confirmPassword, name);
    if (errors.length > 0) {
      this.showError(errors.join('\n'));
      return;
    }

    this.setLoading(true);

    try {
      const user = await this.authService.register(email, password, {
        name: name,
        role: role
      });

      console.log('✅ Signup successful:', user.email);
      AppHelpers.showToast('Account created successfully!', 'success');
      
      // Switch to login form
      this.switchToLoginForm();
    } catch (error) {
      const message = this.authService.getErrorMessage(error.code);
      this.showError(message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    this.setLoading(true);

    try {
      await this.authService.logout();
      console.log('✅ Logged out');
      
      // Clear session
      localStorage.removeItem('currentUser');
      
      // Navigate to login
      this.navigateToLogin();
    } catch (error) {
      this.showError('Logout failed: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Validate signup form
   * @returns {string[]} - Array of error messages
   */
  validateSignupForm(email, password, confirmPassword, name) {
    const errors = [];

    if (!email) errors.push('Email is required');
    if (!AppHelpers.isValidEmail(email)) errors.push('Invalid email format');
    if (!password) errors.push('Password is required');
    if (password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirmPassword) errors.push('Passwords do not match');
    if (!name) errors.push('Name is required');
    if (name.length < 2) errors.push('Name must be at least 2 characters');

    return errors;
  }

  /**
   * Navigate to dashboard
   * @param {User} user
   */
  navigateToDashboard(user) {
    // Show dashboard section
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';

    // Update user display
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
      userDisplay.textContent = user.getDisplayName();
    }

    // Load dashboard data
    if (window.dashboardController) {
      window.dashboardController.loadDashboardData(user.id);
    }
  }

  /**
   * Navigate to login page
   */
  navigateToLogin() {
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('authSection').style.display = 'block';
    this.switchToLoginForm();
  }

  /**
   * Switch to login form
   */
  switchToLoginForm() {
    const _loginForm = document.getElementById('loginForm');
    if (_loginForm) _loginForm.style.display = 'block';
    const _signupForm = document.getElementById('signupForm');
    if (_signupForm) _signupForm.style.display = 'none';
  }

  /**
   * Switch to signup form
   */
  switchToSignupForm() {
    const _loginForm2 = document.getElementById('loginForm');
    if (_loginForm2) _loginForm2.style.display = 'none';
    const _signupForm2 = document.getElementById('signupForm');
    if (_signupForm2) _signupForm2.style.display = 'block';
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
    AppHelpers.showToast(message, 'error');
  }

  /**
   * Set loading state
   * @param {boolean} isLoading
   */
  setLoading(isLoading) {
    const button = document.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = isLoading;
      button.textContent = isLoading ? 'Loading...' : 'Login';
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthController;
}
