import mongoose from 'mongoose';

const adminSettingsSchema = new mongoose.Schema({
  // Manual UPI Payment Settings
  manual_upi_enabled: {
    type: Boolean,
    default: true,
    description: 'Enable/disable manual UPI payment method'
  },
  upi_id: {
    type: String,
    description: 'UPI ID for manual payments'
  },
  qr_code_url: {
    type: String,
    description: 'QR code image URL for UPI'
  },
  upi_name: {
    type: String,
    default: 'Bongo Bandhu',
    description: 'Name to display for UPI'
  },

  // Razorpay Payment Settings
  razorpay_enabled: {
    type: Boolean,
    default: true,
    description: 'Enable/disable Razorpay payment method'
  },
  external_payment_link: {
    type: String,
    default: 'https://riyans.org/payment',
    description: 'External PHP payment gateway URL for Razorpay'
  },
  webhook_url: {
    type: String,
    description: 'Webhook URL for payment notifications'
  },

  // Payment Method Display Order
  payment_methods_order: {
    type: [String],
    default: ['razorpay', 'upi'],
    enum: ['razorpay', 'upi'],
    description: 'Order to display payment methods on frontend'
  },

  // Min/Max Amounts
  min_recharge_amount: {
    type: Number,
    default: 50,
    description: 'Minimum recharge amount in INR'
  },
  max_recharge_amount: {
    type: Number,
    default: 100000,
    description: 'Maximum recharge amount in INR'
  },

  // General Settings
  recharge_success_message: {
    type: String,
    default: 'Amount added to your wallet successfully!',
    description: 'Message shown after successful recharge'
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    description: 'Admin username who made the update'
  }
});

export default mongoose.model('AdminSettings', adminSettingsSchema);
