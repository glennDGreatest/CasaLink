/**
 * Property Model
 * Represents a rental property owned by a landlord
 */
class Property {
  constructor(data = {}) {
    this.id = data.id || null;
    this.landlordId = data.landlordId || data.ownerID || '';
    // Handle both standard and apartments collection field names
    this.name = data.name || data.apartmentName || '';
    this.address = data.address || data.apartmentAddress || '';
    this.city = data.city || '';
    this.state = data.state || '';
    this.zipCode = data.zipCode || '';
    this.country = data.country || '';
    this.propertyType = data.propertyType || 'apartment';
    this.totalUnits = data.totalUnits || data.numberOfRooms || 0;
    this.numberOfFloors = data.numberOfFloors || 0;
    this.bedrooms = data.bedrooms || 0;
    this.bathrooms = data.bathrooms || 0;
    this.monthlyRate = data.monthlyRate || 0;
    this.description = data.description || '';
    this.amenities = data.amenities || [];
    this.images = data.images || [];
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.landlordName = data.landlordName || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validate property data
   * @returns {boolean}
   */
  isValid() {
    // Relaxed validation - accept properties with minimal required fields
    // For apartments collection, we may not have all fields
    const hasLocation = !!(this.address || this.name); // At least address or name
    const hasOwner = !!this.landlordId;

    return hasLocation && hasOwner;
  }

  /**
   * Get full address
   * @returns {string}
   */
  getFullAddress() {
    return `${this.address}, ${this.city}, ${this.state} ${this.zipCode}`;
  }

  /**
   * Convert to JSON
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      landlordId: this.landlordId,
      name: this.name,
      address: this.address,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
      country: this.country,
      propertyType: this.propertyType,
      totalUnits: this.totalUnits,
      description: this.description,
      amenities: this.amenities,
      images: this.images,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Get validation errors
   * @returns {string[]}
   */
  getValidationErrors() {
    const errors = [];
    if (!this.address) errors.push('Address is required');
    if (!this.city) errors.push('City is required');
    if (!this.state) errors.push('State is required');
    if (!(this.totalUnits > 0) && !(this.bedrooms > 0) && !(this.monthlyRate > 0)) {
      errors.push('Provide total units, bedrooms, or a monthly rate');
    }
    return errors;
  }
}
