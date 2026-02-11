# Dynamic Payment Modal - Quick Reference

## 📊 What Was Changed

### Before (Static Modal)
- Single form with all fields visible at once
- Not method-specific
- Confusing for users (too many fields regardless of payment method)
- Hard to maintain

### After (Dynamic Modal)
- Form changes based on selected payment method
- Only relevant fields shown for each method
- Clear, specific instructions
- Easy to maintain and extend

---

## 🚀 How It Works Now

### Payment Method Selection Screen
```
┌─────────────────────────────────────────────┐
│  Record Payment                             │
├─────────────────────────────────────────────┤
│                                             │
│  📋 Bill Details                            │
│  ├─ Amount Due: ₱5,000.00                   │
│  ├─ Due Date: Feb 15, 2026                  │
│  ├─ Room: 101                               │
│  └─ Description: Monthly Rent               │
│                                             │
│  💳 Payment Method Selection                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │ 💵   │  │ 📱   │  │ 💳   │  │ 🏦   │    │
│  │ Cash │  │GCash │  │ Maya │  │ Bank │    │
│  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 💵 CASH Payment Form

```
┌─────────────────────────────────────────────┐
│  Record Payment                             │
├─────────────────────────────────────────────┤
│                                             │
│  Instructions ℹ️                            │
│  ┌─────────────────────────────────────┐   │
│  │ Knock at the landlord's door and    │   │
│  │ give the cash payment to him/her    │   │
│  │ and take a picture as proof. If     │   │
│  │ landlord is not around, kindly      │   │
│  │ check at a later moment.            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Payment Date * [↓ 2026-02-12]              │
│  Auto-selected to today's date              │
│                                             │
│  Amount Paid * ₱ [5000.00]                  │
│                                             │
│  Photo Evidence (Image) *                   │
│  ┌─────────────────────────────────────┐   │
│  │ 🖼️ Click to upload or drag image    │   │
│  │    JPG, PNG (Max 5MB)               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Notes (Optional)                           │
│  [________________________________]         │
│                                             │
│                 [Cancel] [Record Payment]   │
└─────────────────────────────────────────────┘
```

---

## 📱 GCASH Payment Form

```
┌─────────────────────────────────────────────┐
│  Record Payment                             │
├─────────────────────────────────────────────┤
│                                             │
│  Instructions ℹ️                            │
│  ┌─────────────────────────────────────┐   │
│  │ Take a screenshot of the QR Code    │   │
│  │ provided and upload it to the       │   │
│  │ GCash App. Make sure to take a      │   │
│  │ screenshot as proof of payment and  │   │
│  │ upload it here.                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  GCash QR Code                              │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │          ┌──────────┐               │   │
│  │          │   QR     │               │   │
│  │          │  CODE    │               │   │
│  │          └──────────┘               │   │
│  │                                     │   │
│  │ Scan this QR code with GCash App    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Payment Date * [↓ 2026-02-12]              │
│                                             │
│  Amount Paid * ₱ [5000.00]                  │
│                                             │
│  Photo Evidence (Screenshot from GCash) *  │
│  ┌─────────────────────────────────────┐   │
│  │ 🖼️ Click to upload screenshot       │   │
│  │    JPG, PNG (Max 5MB)               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Notes (Optional)                           │
│  [________________________________]         │
│                                             │
│                 [Cancel] [Record Payment]   │
└─────────────────────────────────────────────┘
```

---

## 💳 MAYA Payment Form

```
┌─────────────────────────────────────────────┐
│  Record Payment                             │
├─────────────────────────────────────────────┤
│                                             │
│  Instructions ℹ️                            │
│  ┌─────────────────────────────────────┐   │
│  │ Take a screenshot of the QR Code    │   │
│  │ provided and upload it to the       │   │
│  │ Maya App. Make sure to take a       │   │
│  │ screenshot as proof of payment and  │   │
│  │ upload it here.                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Maya QR Code                               │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │          ┌──────────┐               │   │
│  │          │   QR     │               │   │
│  │          │  CODE    │               │   │
│  │          └──────────┘               │   │
│  │                                     │   │
│  │ Scan this QR code with Maya App     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Payment Date * [↓ 2026-02-12]              │
│                                             │
│  Amount Paid * ₱ [5000.00]                  │
│                                             │
│  Photo Evidence (Screenshot from Maya) *   │
│  ┌─────────────────────────────────────┐   │
│  │ 🖼️ Click to upload screenshot       │   │
│  │    JPG, PNG (Max 5MB)               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Notes (Optional)                           │
│  [________________________________]         │
│                                             │
│                 [Cancel] [Record Payment]   │
└─────────────────────────────────────────────┘
```

---

## 🏦 BANK TRANSFER Payment Form

```
┌─────────────────────────────────────────────┐
│  Record Payment                             │
├─────────────────────────────────────────────┤
│                                             │
│  Instructions ℹ️                            │
│  ┌─────────────────────────────────────┐   │
│  │ Enter the provided details in your  │   │
│  │ Online Banking App and input the    │   │
│  │ amount you intend to pay. Make      │   │
│  │ sure to take a screenshot as proof  │   │
│  │ of payment and upload it here.      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Landlord Bank Details                      │
│  ┌─────────────────────────────────────┐   │
│  │ Account Number: 1234567890          │   │
│  │ Account Name: Landlord Name Test    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Payment Date * [↓ 2026-02-12]              │
│                                             │
│  Amount Paid * ₱ [5000.00]                  │
│                                             │
│  Photo Evidence (Online Banking Screenshot)*│
│  ┌─────────────────────────────────────┐   │
│  │ 🖼️ Click to upload banking screen   │   │
│  │    JPG, PNG (Max 5MB)               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Notes (Optional)                           │
│  [________________________________]         │
│                                             │
│                 [Cancel] [Record Payment]   │
└─────────────────────────────────────────────┘
```

---

## 🔄 Field Behavior

### Payment Date
- **Always:** Auto-filled with today's date
- **Always:** Required
- **Can:** Tenant can modify if needed

### Amount Paid
- **Always:** Pre-filled with bill total amount
- **Always:** Required
- **Can:** Tenant can modify for partial payments

### Photo Evidence
- **Always:** Required for ALL payment methods
- **For Cash:** Any receipt/proof photo
- **For GCash:** Screenshot from GCash app
- **For Maya:** Screenshot from Maya app
- **For Bank Transfer:** Screenshot from online banking

### Notes
- **Always:** Optional for ALL payment methods
- **Example:** "Payment made on Friday evening"

---

## ✅ Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Payment Method | Must be selected | "Please select a payment method" |
| Payment Date | Must be filled | "Payment date is required" |
| Amount Paid | Must be > 0 | "Amount paid must be greater than 0" |
| Photo Evidence | Must be uploaded | "Photo evidence is required" |
| Photo Evidence | Max 5MB | "File size must be less than 5MB" |
| Photo Evidence | JPG/PNG only | "Only JPG and PNG images are allowed" |

---

## 📱 Responsive Behavior

### Desktop (> 768px)
- Payment method cards in grid layout
- 4 columns (one for each method)
- Full-width form fields
- Side-by-side layouts for sections

### Tablet (481px - 768px)
- Payment method cards: 2 columns
- Bank details: 1 column
- Stack form fields as needed

### Mobile (< 480px)
- Payment method cards: 2 columns
- Full-width single column layout
- Stacked form sections
- Optimized for touch

---

## 🔐 Security Features

✅ File validation (size & type)
✅ Photo evidence required (proof)
✅ Payment status tracked
✅ Landlord verification required
✅ Audit trail maintained
✅ Firebase Storage secured access
✅ User authentication required

---

## 📊 Data Flow

```
1. Tenant selects bill → Bill Details Modal opens
2. Tenant clicks "Pay Now" → Record Payment Modal opens
3. Payment Method Selection displayed
4. Tenant selects method (Cash/GCash/Maya/Bank)
5. Form dynamically updates → Method-specific fields shown
6. Tenant fills required fields + optional notes
7. Tenant uploads photo evidence
8. Tenant submits → Validation runs
9. Photo uploaded to Firebase Storage
10. Payment record saved to Firestore
11. Bill status → payment_pending
12. Success notification → Modal closes
13. Landlord notified → Can verify payment
14. Landlord verifies → Bill status → paid
```

---

## 🎯 Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **User Experience** | Confusing with all fields | Clear, method-specific |
| **Instructions** | Generic | Specific to each method |
| **QR Codes** | Not visible | Displayed when needed |
| **Form Complexity** | Too many fields | Only relevant fields |
| **Mobile UX** | Cluttered | Clean, organized |
| **Maintenance** | Hard to modify | Easy to update forms |
| **Extensibility** | Difficult to add methods | Simple to add new methods |

---

## 🚀 Implementation Complete! ✅

All four payment methods are now working with dynamic form display:
- ✅ Cash Method
- ✅ GCash Method
- ✅ Maya Method
- ✅ Bank Transfer Method

**Next Step:** Add the QR code images (gcash.png & maya.png) to icons/payments/

See `QR_CODE_PLACEMENT_GUIDE.md` and `DYNAMIC_PAYMENT_MODAL_GUIDE.md` for detailed information.
