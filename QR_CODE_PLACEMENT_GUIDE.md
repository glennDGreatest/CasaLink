# QR Code Image Placement Guide

## Overview
The dynamic Record Payment Modal references QR code images for GCash and Maya payment methods. This guide explains where to place these images in your project.

## Image File Locations

### Required QR Code Images

Place the following QR code image files in the `icons/payments/` directory:

```
CasaLink/
├── icons/
│   └── payments/
│       ├── gcash.png          ← GCash QR Code image
│       └── maya.png           ← Maya QR Code image
```

## Technical Details

### File Format
- **Format**: PNG, JPG, or other standard image formats
- **Size Recommendation**: 200x200 pixels minimum
- **Quality**: Ensure QR codes are clear and scannable

### Referenced Paths
The payment form manager references these images from the following locations:

**For Tenant View** (when viewing bill details from tenant dashboard):
- GCash: `../../icons/payments/gcash.png`
- Maya: `../../icons/payments/maya.png`

**For Landlord View** (when viewing bill records from landlord dashboard):
- GCash: `../../icons/payments/gcash.png`
- Maya: `../../icons/payments/maya.png`

## How to Add QR Code Images

### Step 1: Obtain or Generate QR Codes
You can:
- Generate QR codes using any QR code generator (Google Charts API, qrcode.js, etc.)
- Use your actual GCash and Maya payment QR codes
- Get sample QR codes from your payment processors

### Step 2: Export as PNG/JPG
Save the QR codes as:
- `gcash.png` - GCash QR Code
- `maya.png` - Maya QR Code

### Step 3: Place in Project
Copy these images to: `icons/payments/`

### Step 4: Verify Display
When a tenant or landlord selects GCash or Maya as a payment method in the payment modal, the QR code image will display automatically.

## Current Implementation

The payment form dynamically:
1. Shows the QR code image when GCash or Maya is selected
2. Displays instructions for scanning and uploading proof
3. Includes the Photo Evidence upload field for the transaction screenshot

## Styling

The QR codes are displayed in a centered container with:
- Dashed border
- Maximum width of 200px
- Light blue background
- Helpful instruction text below

## Important Notes

- ⚠️ **The image files are NOT currently in the project** - You must add them
- The payment modal will gracefully handle missing images, but QR codes won't display
- Ensure QR codes are properly formatted and scannable
- Keep QR code images updated if they change on your payment processor side
