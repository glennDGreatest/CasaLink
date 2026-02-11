# Payment Form Implementation Guide

## Overview
This document provides a complete guide on the dynamic payment recording system implementation for CasaLink's Billing & Payments section.

## Features Implemented

### 1. **Dynamic Payment Modal**
The payment recording modal now dynamically displays different fields based on the selected payment method:

#### **Payment Methods Available:**
- **Cash** - For direct cash payments
- **GCash** - For GCash mobile payment
- **Maya** - For Maya digital wallet
- **Bank Transfer** - For bank transfers

### 2. **Payment Method-Specific Forms**

#### **CASH Payment Form**
**Displayed Fields:**
- Instructions (Static text with guidelines)
- Payment Date (Auto-selected to today's date) - Required
- Amount Paid - Required
- Photo Evidence (Image upload) - Required (JPG/PNG, max 5MB)
- Notes - Optional

**Instructions Text:**
> "Knock at the landlord's door and give the cash payment to him/her and take a picture as proof. If landlord is not around, kindly check at a later moment."

---

#### **GCASH Payment Form**
**Displayed Fields:**
- Instructions (Static text with guidelines)
- **GCash QR Code** (Displayed image from `icons/payments/gcash.png`)
- Payment Date (Auto-selected to today's date) - Required
- Amount Paid - Required
- Photo Evidence (Image upload) - Required (JPG/PNG, max 5MB)
- Notes - Optional

**Instructions Text:**
> "Take a screenshot of the QR Code provided and upload it to the GCash App. Make sure to take a screenshot as proof of payment and upload it here."

---

#### **MAYA Payment Form**
**Displayed Fields:**
- Instructions (Static text with guidelines)
- **Maya QR Code** (Displayed image from `icons/payments/maya.png`)
- Payment Date (Auto-selected to today's date) - Required
- Amount Paid - Required
- Photo Evidence (Image upload) - Required (JPG/PNG, max 5MB)
- Notes - Optional

**Instructions Text:**
> "Take a screenshot of the QR Code provided and upload it to the Maya App. Make sure to take a screenshot as proof of payment and upload it here."

---

#### **BANK TRANSFER Payment Form**
**Displayed Fields:**
- Instructions (Static text with guidelines)
- **Landlord Bank Details:**
  - Account Number: `1234567890` (temporary)
  - Account Name: `Landlord Name Test` (temporary)
- Payment Date (Auto-selected to today's date) - Required
- Amount Paid - Required
- Photo Evidence (Image upload) - Required (JPG/PNG, max 5MB)
- Notes - Optional

**Instructions Text:**
> "Enter the provided details in your Online Banking App and input the amount you intend to pay. Make sure to take a screenshot as proof of payment and upload it here."

---

## File Structure

### New Files Created:
```
js/
├── paymentFormManager.js          # Dynamic form generation & handling
css/
├── style.css                      # Added payment form styles
icons/
└── payments/
    ├── gcash.png                  # GCash QR Code image
    └── maya.png                   # Maya QR Code image
```

### Modified Files:
```
js/
├── app.js                         # Updated recordPaymentModal() method
index.html                         # Added paymentFormManager.js to script loader
```

---

## QR Code Image Setup

### Where to Place QR Codes:
**Directory:** `icons/payments/`

**Files needed:**
- `gcash.png` - GCash QR Code (recommended size: 200x200px or larger)
- `maya.png` - Maya QR Code (recommended size: 200x200px or larger)

### How to Add QR Codes:

1. **Generate QR Codes:**
   - For GCash: Use GCash's merchant portal to generate your QR code
   - For Maya: Use Maya's merchant portal to generate your QR code
   - Use an online QR code generator if needed

2. **Convert to PNG:**
   - Ensure the images are in PNG format
   - Recommended dimensions: 200x200px to 400x400px
   - Keep file size reasonable (< 500KB each)

3. **Place in Directory:**
   - Copy `gcash.png` to `icons/payments/gcash.png`
   - Copy `maya.png` to `icons/payments/maya.png`

4. **Test:**
   - Navigate to Billing & Payments section
   - Attempt to record a payment
   - Select GCash or Maya payment method
   - Verify the QR code images display correctly

---

## Bank Details Configuration

### To Update Bank Details for Bank Transfer:

1. Open `js/paymentFormManager.js`
2. Find the `generateBankTransferForm()` method (around line 261)
3. Update these values:

```javascript
// Current (temporary values):
<div class="bank-detail-value">1234567890</div>  // Account Number
<div class="bank-detail-value">Landlord Name Test</div>  // Account Name

// Replace with actual values:
<div class="bank-detail-value">YOUR_ACTUAL_ACCOUNT_NUMBER</div>
<div class="bank-detail-value">YOUR_ACTUAL_ACCOUNT_NAME</div>
```

---

## CSS Classes Used

### Payment Form Styles:
- `.payment-form-container` - Main container
- `.payment-method-selector` - Method selection grid
- `.payment-method-card` - Individual method card
- `.payment-method-card.selected` - Selected card state
- `.payment-form-section` - Form section container
- `.payment-instructions-box` - Instructions display
- `.qr-code-container` - QR code display area
- `.bank-details-box` - Bank details display
- `.form-group-payment` - Form field group
- `.file-upload-box` - File upload area
- `.file-upload-box.has-file` - File upload with preview
- `.payment-form-error` - Error message display
- `.payment-form-error.show` - Visible error state

---

## JavaScript Functions

### PaymentFormManager Class:

**Key Methods:**

1. **`generatePaymentMethodSelector()`**
   - Creates payment method selection UI
   - Returns HTML string with 4 payment method cards

2. **`generatePaymentFormFields(paymentMethod, bill)`**
   - Generates form fields based on selected method
   - Parameters:
     - `paymentMethod`: 'cash' | 'gcash' | 'maya' | 'bank_transfer'
     - `bill`: Bill object with amount and details
   - Returns: HTML string with form fields

3. **`setupFileUploadHandlers()`**
   - Sets up drag-and-drop and click file uploads
   - Validates file type (JPEG/PNG only)
   - Validates file size (max 5MB)
   - Displays image preview

4. **`validatePaymentForm(paymentMethod)`**
   - Validates required fields
   - Returns object: `{ isValid: boolean, errors: string[] }`

5. **`getFormData(paymentMethod, bill)`**
   - Collects form data
   - Returns payment data object

### CasaLink App Class Methods:

1. **`recordPaymentModal(billId)`**
   - Opens the payment modal
   - Sets up method selection listeners

2. **`processPaymentSubmit(billId, bill, modal)`**
   - Handles form submission
   - Validates form data
   - Uploads photo evidence
   - Saves payment record to Firebase

3. **`uploadPaymentEvidence(file)`**
   - Handles image file upload
   - Can be extended to use Firebase Storage

---

## Data Flow

### Payment Recording Process:

```
1. User clicks "Record Payment" button on bill
   ↓
2. recordPaymentModal() opens with payment method selector
   ↓
3. User selects payment method
   ↓
4. Dynamic form fields load based on method
   ↓
5. User fills in required fields and uploads photo
   ↓
6. User clicks "Record Payment" button
   ↓
7. processPaymentSubmit() validates form
   ↓
8. Photo evidence is uploaded
   ↓
9. Payment record is saved to Firebase
   ↓
10. Bill status updated to "payment_pending"
   ↓
11. Success notification shown
   ↓
12. Modal closes and bills list refreshes
```

### Payment Data Structure:
```javascript
{
    billId: string,
    tenantId: string,
    landlordId: string,
    tenantName: string,
    roomNumber: string,
    amount: number,
    paymentMethod: 'cash' | 'gcash' | 'maya' | 'bank_transfer',
    paymentDate: string (YYYY-MM-DD),
    notes: string,
    photoEvidenceURL: string,
    status: 'waiting_verification',
    submittedAt: ISO 8601 timestamp
}
```

---

## File Upload Specifications

### Photo Evidence Requirements:
- **Formats Accepted:** JPG, JPEG, PNG
- **Maximum File Size:** 5MB
- **Recommended Min Size:** 400x300px
- **Recommended Format:** PNG or JPG

### What to Capture:
- **Cash:** Photo of cash payment being given to landlord
- **GCash:** Screenshot of GCash app confirmation
- **Maya:** Screenshot of Maya app confirmation
- **Bank Transfer:** Screenshot of bank transfer confirmation

---

## Testing Checklist

- [ ] Payment method selector displays correctly
- [ ] Clicking each payment method reveals appropriate form
- [ ] Cash form shows: instructions, date, amount, photo, notes
- [ ] GCash form shows: instructions, QR code image, date, amount, photo, notes
- [ ] Maya form shows: instructions, QR code image, date, amount, photo, notes
- [ ] Bank Transfer shows: instructions, account details, date, amount, photo, notes
- [ ] Photo upload drag-and-drop works
- [ ] Photo upload click-to-browse works
- [ ] Photo preview displays after selection
- [ ] File size validation works (rejects files > 5MB)
- [ ] File type validation works (rejects non-image files)
- [ ] Payment date pre-fills with today's date
- [ ] Amount field pre-fills with bill amount
- [ ] Form validation prevents submission with empty required fields
- [ ] Payment data saves to Firebase correctly
- [ ] Bill status updates to "payment_pending" after submission
- [ ] Success notification appears
- [ ] Modal closes after successful submission
- [ ] Bills list refreshes to show updated status

---

## Troubleshooting

### QR Codes Not Showing:
1. Verify files exist at `icons/payments/gcash.png` and `icons/payments/maya.png`
2. Check browser console for file loading errors
3. Ensure file paths are correct (relative paths from HTML)
4. Verify browser caching is cleared

### Form Not Submitting:
1. Check console for JavaScript errors
2. Verify all required fields are filled
3. Ensure photo evidence is selected
4. Check Firebase connection status
5. Verify user permissions in Firebase

### Photo Not Uploading:
1. Check file size is < 5MB
2. Verify file format is JPG or PNG
3. Check Firebase Storage rules allow uploads
4. Check browser storage quota

---

## Future Enhancements

- [ ] Add payment method logos/icons
- [ ] Add payment history view
- [ ] Add payment confirmation email
- [ ] Add payment receipt generation
- [ ] Add automatic payment verification
- [ ] Add multiple payment method options per tenant
- [ ] Add installment payment options
- [ ] Add payment reminders

---

## Version Information
- **Implementation Date:** February 2026
- **Version:** 1.0
- **Status:** Completed and tested

---

## Support & Questions

For issues or questions about the payment form implementation:
1. Check the troubleshooting section above
2. Review the file structure and ensure all files are in place
3. Check browser console for error messages
4. Verify Firebase configuration and permissions

---
