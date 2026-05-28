# BongoBandhu Dual Payment System - Implementation Guide

## ✨ Features Implemented

### 🎛️ Admin Control
- **Toggle Razorpay** ON/OFF from admin dashboard
- **Toggle Manual UPI** ON/OFF from admin dashboard
- **Set display order** which payment method appears first
- **Configure UPI details** (ID, name, QR code)
- **Customize min/max** recharge amounts
- **Edit success message** shown after payment

### 👥 User Experience
- Users see only **enabled payment methods**
- Can **switch between methods** if multiple enabled
- Manual UPI shows **QR code + UPI details**
- Razorpay **redirects to external gateway**
- **Transaction history** shows payment method used

### 🔒 Safety Features
- **Cannot disable both methods** - system prevents this
- **Validation on all fields** - URLs, amounts, required fields
- **Server-side verification** - signatures checked
- **At least one method required** - enforced by system

## 📁 Files Created/Updated

### Backend
```
✓ node-backend/models/AdminSettings.js         (NEW - Updated model)
✓ node-backend/routes/admin-payments.js        (NEW - Admin routes)
```

### Frontend
```
✓ frontend/src/components/WalletRecharge.jsx   (UPDATED - Multi-method support)
✓ frontend/src/pages/AdminPaymentSettings.jsx  (NEW - Admin dashboard)
```

## 🚀 Quick Setup

### 1. Database Migration
First time setup - create AdminSettings document:
```javascript
db.adminsettings.insertOne({
  manual_upi_enabled: true,
  upi_id: "your-upi@upi",
  upi_name: "Bongo Bandhu",
  qr_code_url: "",
  razorpay_enabled: true,
  external_payment_link: "https://riyans.org/payment",
  webhook_url: "",
  payment_methods_order: ["razorpay", "upi"],
  min_recharge_amount: 50,
  max_recharge_amount: 100000,
  recharge_success_message: "Amount added to your wallet successfully!",
  updatedAt: new Date()
})
```

### 2. Register Routes in Backend
Update `node-backend/server.js`:
```javascript
import adminPaymentRoutes from './routes/admin-payments.js';

// Add this line with other route registrations
app.use('/api/admin/payments', adminPaymentRoutes);
```

### 3. Add Routes in Frontend
Update your router to include admin settings page:
```javascript
import AdminPaymentSettings from '@/pages/AdminPaymentSettings';

<Route path="/admin/settings/payments" element={<AdminPaymentSettings />} />
```

### 4. Add Admin Menu Item
Add to admin dashboard menu:
```javascript
<Link to="/admin/settings/payments">
  💳 Payment Settings
</Link>
```

## 🔄 User Payment Flow

```
User clicks "Add Money" button
         ↓
Shows amount selection (preset or custom)
         ↓
Shows available payment methods (based on admin config)
         ↓
User selects method:
   
   If Razorpay selected:
   ├→ Creates order in backend
   ├→ Redirects to external PHP gateway
   ├→ Razorpay processes payment
   ├→ Payment verified and wallet credited
   └→ Returns to app with success
   
   If Manual UPI selected:
   ├→ Shows UPI details in popup
   ├→ Shows QR code (if configured)
   ├→ User scans and transfers money
   ├→ Admin verifies payment manually
   └→ Wallet credited by admin
```

## 📊 Admin Dashboard Controls

### Payment Methods Section
```
[✓] Razorpay Payment
    Payment Link: [https://riyans.org/payment] [Edit]
    Webhook URL: [Optional field]

[✓] Manual UPI Payment
    UPI ID: [your-upi@upi]
    Display Name: [Bongo Bandhu]
    QR Code URL: [https://...]
```

### Display Order Section
```
Current Order:
┌─────────────────────────┐
│ 1. Razorpay      [↑][↓] │
│ 2. Manual UPI    [↑][↓] │
└─────────────────────────┘
```

### Amount Settings
```
┌──────────────────────────────┐
│ Min Amount:  [50] ₹          │
│ Max Amount:  [100000] ₹      │
└──────────────────────────────┘
```

### Success Message
```
┌──────────────────────────────────────────────┐
│ Message: [Amount added to your wallet...] [✎] │
└──────────────────────────────────────────────┘
```

## 🧪 Testing Scenarios

### Test 1: Enable Only Razorpay
1. Admin: Disable Manual UPI
2. Admin: Save settings
3. User: Should see only Razorpay button
4. User: Click to pay, should go to external gateway

### Test 2: Enable Only Manual UPI
1. Admin: Disable Razorpay
2. Admin: Save settings
3. User: Should see only Manual UPI option
4. User: Click to pay, should see UPI details popup

### Test 3: Enable Both Methods
1. Admin: Enable both Razorpay and Manual UPI
2. Admin: Save settings
3. User: Should see both options as radio buttons
4. User: Can select and switch between them

### Test 4: Try to Disable Both (Should Fail)
1. Admin: Uncheck both methods
2. Admin: Try to save
3. System: Shows error "At least one method must be enabled"

### Test 5: Change Display Order
1. Admin: Drag Manual UPI to position 1
2. Admin: Save settings
3. User: Should see Manual UPI first in list

## 🔐 Validation Rules

### Admin Saving:
- ✅ At least one method must be enabled
- ✅ Razorpay: payment link must be valid URL when enabled
- ✅ Manual UPI: UPI ID required when enabled
- ✅ Min amount < Max amount
- ✅ All URL fields must be valid URLs

### User Paying:
- ✅ Amount >= min_amount
- ✅ Amount <= max_amount
- ✅ Payment method selected
- ✅ Required fields present

## 📈 API Endpoints

### Public - Get Available Methods (for frontend)
```
GET /api/admin/payments/settings

Response:
{
  paymentMethods: [
    {
      name: "razorpay",
      enabled: true,
      link: "https://riyans.org/payment"
    },
    {
      name: "upi",
      enabled: true,
      upi_id: "user@upi",
      upi_name: "Bongo Bandhu",
      qr_code_url: "https://..."
    }
  ],
  min_amount: 50,
  max_amount: 100000
}
```

### Admin - Get All Settings
```
GET /api/admin/payments/settings/admin
Authorization: Bearer admin_token

Response:
{
  manual_upi_enabled: true,
  upi_id: "user@upi",
  upi_name: "Bongo Bandhu",
  qr_code_url: "https://...",
  razorpay_enabled: true,
  external_payment_link: "https://riyans.org/payment",
  webhook_url: "https://...",
  payment_methods_order: ["razorpay", "upi"],
  min_recharge_amount: 50,
  max_recharge_amount: 100000,
  recharge_success_message: "Amount added successfully!",
  razorpay_key_id: "rzp_test_..."
}
```

### Admin - Update Settings
```
PUT /api/admin/payments/settings/admin
Authorization: Bearer admin_token

Request:
{
  manual_upi_enabled: true,
  upi_id: "new-upi@upi",
  razorpay_enabled: true,
  external_payment_link: "https://new-gateway.com",
  payment_methods_order: ["upi", "razorpay"],
  min_recharge_amount: 100,
  max_recharge_amount: 50000,
  recharge_success_message: "Custom message"
}

Response:
{
  success: true,
  message: "Settings updated successfully",
  settings: { ...updated settings }
}
```

## 🐛 Common Issues & Fixes

### Issue: "At least one payment method must be enabled"
- **Cause**: Both methods disabled
- **Fix**: Enable at least one method before saving

### Issue: Manual UPI not showing in user interface
- **Cause**: manual_upi_enabled is false or upi_id empty
- **Fix**: Enable Manual UPI and enter UPI ID in admin settings

### Issue: Razorpay option missing for users
- **Cause**: razorpay_enabled is false or external_payment_link invalid
- **Fix**: Enable Razorpay and set valid payment gateway URL

### Issue: Invalid URL error
- **Cause**: Entered URL is not valid format
- **Fix**: Use full URL format: https://example.com/path

### Issue: Admin saves but changes don't appear for users
- **Cause**: Browser cache
- **Fix**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## ✅ Deployment Checklist

- [ ] Update AdminSettings.js model in node-backend
- [ ] Add admin-payments.js routes in node-backend
- [ ] Register routes in node-backend/server.js
- [ ] Update WalletRecharge.jsx component
- [ ] Add AdminPaymentSettings.jsx page
- [ ] Add route to admin dashboard
- [ ] Run database migration (create AdminSettings doc)
- [ ] Test admin dashboard access
- [ ] Test payment method toggles
- [ ] Test user payment flow with both methods
- [ ] Test validation (try disable both methods)
- [ ] Verify UPI details display correctly
- [ ] Verify Razorpay redirect works
- [ ] Test transaction history shows correct method
- [ ] Deploy to production

## 🎯 Next Steps

1. ✅ Accept these file changes
2. ✅ Register routes in server.js
3. ✅ Add admin dashboard link
4. ✅ Run migration to create AdminSettings
5. ✅ Test complete payment flow
6. ✅ Go live!

---

**Status**: Ready to Deploy
**Version**: 2.0 - Multi-method with Admin Control
**Last Updated**: 2024
