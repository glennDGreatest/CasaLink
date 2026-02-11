# Dynamic Record Payment Modal Implementation

## Overview
The Record Payment Modal for tenants is now fully dynamic, displaying different payment forms based on the selected payment method. This implementation provides a seamless user experience for all four payment methods: Cash, GCash, Maya, and Bank Transfer.

---

## Implementation Summary

### Files Modified
1. **js/app.js**
   - Updated `showTenantPaymentModal()` - Now uses PaymentFormManager for dynamic form generation
   - Added `processTenantPaymentSubmit()` - Handles payment submission with file uploads
   - Both methods mirror the landlord's `recordPaymentModal()` and `processPaymentSubmit()` implementations

2. **js/paymentFormManager.js**
   - Updated image paths for GCash and Maya QR codes (icons/payments/gcash.png and icons/payments/maya.png)
   - All four payment methods already have proper form generation methods

### Files Created
1. **QR_CODE_PLACEMENT_GUIDE.md** - Guide for placing QR code images in the correct directory

---

## Payment Method Details

### 1. CASH Payment Method

**When a tenant selects CASH:**

**Modal displays:**
- ✅ **Instructions** 
  - "Knock at the landlord's door and give the cash payment to him/her and take a picture as proof. If landlord is not around, Kindly check at a later moment."
- ✅ **Payment Date** (Auto-set to today's date) - Required
- ✅ **Amount Paid** (Pre-filled with bill amount) - Required
- ✅ **Photo Evidence** (Image upload - JPG, PNG) - Required
- ✅ **Notes** (Optional)

**Form Structure in Code:**
```javascript
PaymentFormManager.generateCashForm(bill)
```

**Visual Elements:**
- Green instruction box with hand-money icon
- Date field with today's date pre-filled
- Currency input with ₱ symbol
- Drag-and-drop image upload area
- Optional notes textarea

---

### 2. GCASH Payment Method

**When a tenant selects GCASH:**

**Modal displays:**
- ✅ **Instructions**
  - "Take a screenshot of the QR Code provided and upload it to the GCash App. Make sure to take a screenshot as proof of payment and upload it here."
- ✅ **QR Code** (Image from icons/payments/gcash.png)
- ✅ **Payment Date** (Auto-set to today's date) - Required
- ✅ **Amount Paid** (Pre-filled with bill amount) - Required
- ✅ **Photo Evidence** (Screenshot from GCash app upload) - Required
- ✅ **Notes** (Optional)

**Form Structure in Code:**
```javascript
PaymentFormManager.generateGCashForm(bill)
```

**Image Location:** `icons/payments/gcash.png`

**Visual Elements:**
- Mobile icon in instructions
- QR code container with dashed border
- Helper text: "Scan this QR code with your GCash App"
- Payment date field
- Amount input
- File upload for GCash screenshot
- Optional notes

---

### 3. MAYA Payment Method

**When a tenant selects MAYA:**

**Modal displays:**
- ✅ **Instructions**
  - "Take a screenshot of the QR Code provided and upload it to the Maya App. Make sure to take a screenshot as proof of payment and upload it here."
- ✅ **QR Code** (Image from icons/payments/maya.png)
- ✅ **Payment Date** (Auto-set to today's date) - Required
- ✅ **Amount Paid** (Pre-filled with bill amount) - Required
- ✅ **Photo Evidence** (Screenshot from Maya app upload) - Required
- ✅ **Notes** (Optional)

**Form Structure in Code:**
```javascript
PaymentFormManager.generateMayaForm(bill)
```

**Image Location:** `icons/payments/maya.png`

**Visual Elements:**
- Wallet icon in instructions
- QR code container with dashed border
- Helper text: "Scan this QR code with your Maya App"
- Payment date field
- Amount input
- File upload for Maya screenshot
- Optional notes

---

### 4. BANK TRANSFER Payment Method

**When a tenant selects BANK TRANSFER:**

**Modal displays:**
- ✅ **Instructions**
  - "Enter the provided details in your Online Banking App and input the amount you intend to pay. Make sure to take a screenshot as proof of payment and upload it here."
- ✅ **Account Number** (Temporary: 1234567890) (Display only, read-only)
- ✅ **Account Name** (Temporary: Landlord Name Test) (Display only, read-only)
- ✅ **Payment Date** (Auto-set to today's date) - Required
- ✅ **Amount Paid** (Pre-filled with bill amount) - Required
- ✅ **Photo Evidence** (Screenshot from Online Banking) - Required
- ✅ **Notes** (Optional)

**Form Structure in Code:**
```javascript
PaymentFormManager.generateBankTransferForm(bill)
```

**Visual Elements:**
- University/building icon in instructions
- Bank details box with account info (read-only)
- Payment date field
- Amount input
- File upload for online banking screenshot
- Optional notes

---

## User Flow

### Step 1: Tenant Clicks Bill
- Tenant navigates to Billing & Payments section
- Clicks on a specific bill to view bill details

### Step 2: Tenant Clicks "Pay Now"
- Modal opens showing Bill Details (amount, due date, room number, description)
- Payment Method Selection grid is displayed

### Step 3: Tenant Selects Payment Method
- Tenant clicks on one of the four payment method cards:
  - Cash 💵
  - GCash 📱
  - Maya 💳
  - Bank Transfer 🏦

### Step 4: Form Dynamically Updates
- The form below the payment method selector changes to show:
  - Specific instructions for that payment method
  - Method-specific fields (QR codes, bank details, etc.)
  - Payment date (always auto-set to today)
  - Amount paid (always pre-filled with bill amount)
  - Photo evidence upload (always required)
  - Optional notes

### Step 5: Tenant Fills Form
- Follows the specific instructions for their chosen payment method
- Uploads photo evidence (proof of payment)
- Optionally adds notes
- Reviews all information

### Step 6: Tenant Submits
- Clicks "Record Payment" button
- System validates the form
- Photo evidence is uploaded to Firebase Storage
- Payment record is saved to Firestore
- Bill status updates to "payment_pending"
- Confirmation message shows
- Modal closes

### Step 7: Landlord Verification
- Landlord receives notification of pending payment
- Landlord can verify the payment
- Once verified, bill status updates to "paid"

---

## Key Features

### ✅ Dynamic Form Generation
- Forms change based on selected payment method
- No need to refactor entire modal - just swap form content

### ✅ File Upload Support
- Drag-and-drop image upload
- Click to browse files
- Image preview before submission
- File size validation (max 5MB)
- File type validation (JPG, PNG only)

### ✅ Auto-Populated Fields
- Payment date automatically set to today
- Amount pre-filled with bill total amount
- Tenants can modify if needed

### ✅ Required vs Optional Fields
- All required fields marked with `*`
- Payment date, amount, and photo evidence are always required
- Notes are always optional
- Specific fields required for specific methods (e.g., QR codes for GCash/Maya)

### ✅ User Guidance
- Clear instructions for each payment method
- Visual aids (icons, QR codes)
- Helper text for all form fields
- Error messages for validation failures

### ✅ Security & Validation
- Form validation before submission
- Photo evidence required for proof
- Payment status tracked by landlord
- Audit trail maintained

---

## Image Requirements

### GCash QR Code
**File:** `icons/payments/gcash.png`
- Size: Recommend 200x200px or larger
- Format: PNG or JPG
- Must be a valid, scannable QR code
- Should link to your GCash receiving account

### Maya QR Code
**File:** `icons/payments/maya.png`
- Size: Recommend 200x200px or larger
- Format: PNG or JPG
- Must be a valid, scannable QR code
- Should link to your Maya receiving account

### How to Add QR Codes
1. Generate or obtain your QR codes for GCash and Maya
2. Save them as PNG/JPG files
3. Place in: `CasaLink/icons/payments/`
4. Name them: `gcash.png` and `maya.png`

---

## Technical Implementation Details

### Dynamic Form Manager
The `PaymentFormManager` class handles:
- Payment method selection UI generation
- Payment form field generation (cash, gcash, maya, bank_transfer)
- File upload handling with preview
- Form validation
- Data collection and submission

### Methods Used
1. **showTenantPaymentModal(billId)**
   - Opens the payment modal
   - Displays bill details
   - Shows payment method selector
   - Calls PaymentFormManager for dynamic form generation

2. **processTenantPaymentSubmit(billId, bill, modal)**
   - Validates selected payment method
   - Validates form data
   - Uploads photo evidence to Firebase
   - Creates payment record in Firestore
   - Updates bill status
   - Shows success message

3. **uploadPaymentEvidence(file)**
   - Handles image upload to Firebase Storage
   - Returns URL for proof of payment

### PaymentFormManager Methods
- `generatePaymentMethodSelector()` - Creates payment method selection grid
- `generatePaymentFormFields(method, bill)` - Generates form for selected method
- `generateCashForm(bill)` - Cash payment form
- `generateGCashForm(bill)` - GCash payment form
- `generateMayaForm(bill)` - Maya payment form  
- `generateBankTransferForm(bill)` - Bank transfer form
- `setupFileUploadHandlers()` - Handles file drag-drop and upload
- `validatePaymentForm(method)` - Validates form data
- `getFormData(method, bill)` - Collects form data for submission

---

## Styling Reference

The modal uses these CSS classes for consistent styling:

```css
.payment-form-container          /* Main container */
.payment-method-selector         /* Method selection grid */
.payment-method-card             /* Individual method card */
.payment-method-card.selected    /* Selected method card */
.payment-form-section            /* Form section containers */
.payment-form-section-title      /* Section titles */
.payment-instructions-box        /* Instruction text box */
.qr-code-container              /* QR code display container */
.bank-details-box               /* Bank details display box */
.form-group-payment             /* Form field groups */
.form-label-payment             /* Form labels */
.form-input-payment             /* Form inputs */
.form-textarea-payment          /* Form textareas */
.file-upload-box                /* File upload area */
.payment-form-error             /* Error message display */
```

---

## Testing Checklist

### Cash Payment Method
- [ ] Click Cash payment method card
- [ ] Form updates to show cash-specific fields
- [ ] Instructions display correctly
- [ ] Payment date pre-filled with today
- [ ] Amount pre-filled with bill amount
- [ ] Photo evidence upload works
- [ ] Notes field is optional
- [ ] Submit works with all required fields filled

### GCash Payment Method
- [ ] Click GCash payment method card
- [ ] Form updates to show GCash fields
- [ ] QR code image displays (if gcash.png exists)
- [ ] Instructions display correctly
- [ ] Payment date and amount pre-filled
- [ ] File upload for GCash screenshot works
- [ ] Submit works

### Maya Payment Method
- [ ] Click Maya payment method card
- [ ] Form updates to show Maya fields
- [ ] QR code image displays (if maya.png exists)
- [ ] Instructions display correctly
- [ ] Payment date and amount pre-filled
- [ ] File upload for Maya screenshot works
- [ ] Submit works

### Bank Transfer Payment Method
- [ ] Click Bank Transfer payment method card
- [ ] Form updates to show bank transfer fields
- [ ] Account number displays (1234567890)
- [ ] Account name displays (Landlord Name Test)
- [ ] Instructions display correctly
- [ ] Payment date and amount pre-filled
- [ ] File upload for online banking screenshot works
- [ ] Submit works

### General Validation
- [ ] No payment method selected - shows error
- [ ] Missing photo evidence - shows error
- [ ] File too large - shows error
- [ ] Invalid file format - shows error
- [ ] Modal closes after successful submission
- [ ] Success notification displays

---

## Future Enhancements

1. **Dynamic Bank Account Details**
   - Replace temporary account number and name with dynamic data
   - Store landlord's bank details in database
   - Fetch and display automatically

2. **QR Code Generation**
   - Generate QR codes dynamically instead of static images
   - Link QR codes to actual payment processor accounts

3. **Payment Verification Automation**
   - Auto-verify payments via payment processor APIs
   - Real-time payment status updates

4. **Multiple Payment Methods per Tenant**
   - Allow preference selection
   - Store preferred payment method

5. **Payment History**
   - Show previous payment methods used
   - Track which methods were successful
   - Generate payment reports

---

## Support & Troubleshooting

### QR Codes Not Showing
**Issue:** GCash or Maya QR codes don't display
**Solution:** 
1. Ensure `gcash.png` and `maya.png` exist in `icons/payments/`
2. Check file names match exactly (case-sensitive)
3. Verify images are valid PNG or JPG files

### Payment Not Submitting
**Issue:** "Record Payment" button doesn't work
**Solution:**
1. Check browser console for errors (F12)
2. Ensure photo evidence file is selected
3. Verify file is JPG or PNG format
4. Check file size is under 5MB

### Images Showing as Broken Links
**Issue:** Image icons appear broken in modal
**Solution:**
1. Verify `icons/payments/` directory exists
2. Check image file names and paths
3. Clear browser cache and reload (Ctrl+Shift+Delete)

---

## Next Steps

1. ✅ Implementation Complete
2. 📸 **ADD QR CODE IMAGES** - Place gcash.png and maya.png in icons/payments/
3. 🧪 Test all four payment methods
4. 📝 Update bank account details (replace temporary values)
5. 🚀 Deploy to production
6. 📊 Monitor payment submissions and success rates

Refer to `QR_CODE_PLACEMENT_GUIDE.md` for detailed instructions on adding QR code images.
