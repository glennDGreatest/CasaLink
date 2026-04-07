/**
 * Formatters
 * Format data for display (dates, currency, etc)
 */

class Formatters {
  /**
   * Format date to readable string
   * @param {Date | string} date
   * @param {string} format - 'short', 'long', 'full'
   * @returns {string}
   */
  static formatDate(date, format = 'short') {
    if (!date) return 'N/A';

    const d = new Date(date);
    // Check if the date is valid
    if (isNaN(d.getTime())) return 'N/A';
    
    const formats = {
      'short': d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
      'long': d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      'full': d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    };

    return formats[format] || formats.short;
  }

  /**
   * Format date and time
   * @param {Date | string} date
   * @returns {string}
   */
  static formatDateTime(date) {
    if (!date) return 'N/A';

    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-US');
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `${dateStr} ${timeStr}`;
  }

  /**
   * Format currency
   * @param {number} amount
   * @param {string} currency - 'USD', 'EUR', etc (default: USD)
   * @returns {string}
   */
  static formatCurrency(amount, currency = 'USD') {
    if (isNaN(amount)) return '$0.00';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format phone number
   * @param {string} phone
   * @returns {string}
   */
  static formatPhone(phone) {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return phone;
  }

  /**
   * Format percentage
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  static formatPercentage(value, decimals = 1) {
    if (isNaN(value)) return '0%';
    return (value * 100).toFixed(decimals) + '%';
  }

  /**
   * Format file size
   * @param {number} bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format time ago (e.g., "2 hours ago")
   * @param {Date | string} date
   * @returns {string}
   */
  static formatTimeAgo(date) {
    if (!date) return 'N/A';

    const d = new Date(date);
    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' mins ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';

    return this.formatDate(date);
  }

  /**
   * Format name (capitalize each word)
   * @param {string} name
   * @returns {string}
   */
  static formatName(name) {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format address
   * @param {object} address - { street, city, state, zip, country }
   * @returns {string}
   */
  static formatAddress(address) {
    if (!address) return '';

    const parts = [
      address.street,
      address.city,
      address.state,
      address.zip,
      address.country
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Format status badge HTML
   * @param {string} status
   * @returns {string}
   */
  static formatStatusBadge(status) {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'paid': 'bg-green-100 text-green-800',
      'overdue': 'bg-red-100 text-red-800',
      'open': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-purple-100 text-purple-800'
    };

    const colorClass = colors[status] || 'bg-gray-100 text-gray-800';
    return `<span class="badge ${colorClass}">${this.formatLabel(status)}</span>`;
  }

  /**
   * Format label (convert snake_case or camelCase to readable)
   * @param {string} label
   * @returns {string}
   */
  static formatLabel(label) {
    return label
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Truncate text
   * @param {string} text
   * @param {number} length
   * @returns {string}
   */
  static truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  /**
   * Format JSON for display
   * @param {object} obj
   * @returns {string}
   */
  static formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Formatters;
}
