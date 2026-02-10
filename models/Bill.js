/**
 * Bill Model
 * Represents a rental payment/bill
 */
class Bill {
  constructor(data = {}) {
    this.id = data.id || null;
    this.unitId = data.unitId || '';
    this.propertyId = data.propertyId || '';
    this.tenantId = data.tenantId || '';
    this.landlordId = data.landlordId || '';
    this.amount = data.amount || 0;
    this.dueDate = data.dueDate || null;
    this.paidDate = data.paidDate || null;
    this.status = data.status || 'pending'; // pending, paid, overdue, partial
    this.paymentMethod = data.paymentMethod || null;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lateFeeAmount = data.lateFeeAmount || 0;
    this.paidAmount = data.paidAmount || 0;
    this.isPaymentVerified = data.isPaymentVerified || false;
  }

  /**
   * Validate bill data
   * @returns {boolean}
   */
  isValid() {
    return this.unitId && this.tenantId && this.landlordId && 
           this.amount > 0 && this.dueDate;
  }

  /**
   * Check if bill is overdue
   * @returns {boolean}
   */
  isOverdue() {
    if (this.status === 'paid') return false;
    return new Date() > new Date(this.dueDate);
  }

  /**
   * Check if bill is paid
   * @returns {boolean}
   */
  isPaid() {
    return this.status === 'paid';
  }

  /**
   * Get remaining amount due
   * @returns {number}
   */
  getRemainingAmount() {
    return this.amount - this.paidAmount;
  }

  /**
   * Get payment percentage
   * @returns {number}
   */
  getPaymentPercentage() {
    return Math.round((this.paidAmount / this.amount) * 100);
  }

  /**
   * Get days overdue
   * @returns {number}
   */
  getDaysOverdue() {
    if (!this.isOverdue()) return 0;
    return Math.floor((new Date() - new Date(this.dueDate)) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get total amount with late fees
   * @returns {number}
   */
  getTotalAmount() {
    return this.amount + this.lateFeeAmount;
  }

  /**
   * Convert to JSON
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      unitId: this.unitId,
      propertyId: this.propertyId,
      tenantId: this.tenantId,
      landlordId: this.landlordId,
      amount: this.amount,
      dueDate: this.dueDate,
      paidDate: this.paidDate,
      status: this.status,
      paymentMethod: this.paymentMethod,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lateFeeAmount: this.lateFeeAmount,
      paidAmount: this.paidAmount
      ,isPaymentVerified: this.isPaymentVerified
    };
  }

  /**
   * Get validation errors
   * @returns {string[]}
   */
  getValidationErrors() {
    const errors = [];
    if (!this.amount || this.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    if (!this.dueDate) errors.push('Due date is required');
    if (!this.tenantId) errors.push('Tenant is required');
    return errors;
  }
}
