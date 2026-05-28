import express from 'express';
import AdminSettings from '../models/AdminSettings.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get payment settings (public - for frontend)
router.get('/settings', async (req, res) => {
  try {
    let settings = await AdminSettings.findOne() || new AdminSettings();
    
    // Return only enabled payment methods
    const paymentMethods = [];
    
    if (settings.razorpay_enabled) {
      paymentMethods.push({
        name: 'razorpay',
        enabled: true,
        link: settings.external_payment_link
      });
    }

    if (settings.manual_upi_enabled) {
      paymentMethods.push({
        name: 'upi',
        enabled: true,
        upi_id: settings.upi_id,
        upi_name: settings.upi_name,
        qr_code_url: settings.qr_code_url
      });
    }

    res.json({
      paymentMethods: paymentMethods.sort((a, b) => {
        const orderA = settings.payment_methods_order.indexOf(a.name);
        const orderB = settings.payment_methods_order.indexOf(b.name);
        return orderA - orderB;
      }),
      min_amount: settings.min_recharge_amount,
      max_amount: settings.max_recharge_amount
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get payment settings (admin - full details)
router.get('/settings/admin', adminMiddleware, async (req, res) => {
  try {
    let settings = await AdminSettings.findOne() || new AdminSettings();
    
    res.json({
      manual_upi_enabled: settings.manual_upi_enabled,
      upi_id: settings.upi_id,
      upi_name: settings.upi_name,
      qr_code_url: settings.qr_code_url,
      razorpay_enabled: settings.razorpay_enabled,
      external_payment_link: settings.external_payment_link,
      webhook_url: settings.webhook_url,
      payment_methods_order: settings.payment_methods_order,
      min_recharge_amount: settings.min_recharge_amount,
      max_recharge_amount: settings.max_recharge_amount,
      recharge_success_message: settings.recharge_success_message,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID || ''
    });
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update payment settings (admin only)
router.put('/settings/admin', adminMiddleware, async (req, res) => {
  try {
    const {
      manual_upi_enabled,
      upi_id,
      upi_name,
      qr_code_url,
      razorpay_enabled,
      external_payment_link,
      webhook_url,
      payment_methods_order,
      min_recharge_amount,
      max_recharge_amount,
      recharge_success_message
    } = req.body;

    // Validation
    if (min_recharge_amount && min_recharge_amount < 1) {
      return res.status(400).json({ error: 'Minimum amount must be at least ₹1' });
    }

    if (max_recharge_amount && max_recharge_amount > 1000000) {
      return res.status(400).json({ error: 'Maximum amount cannot exceed ₹10,00,000' });
    }

    if (min_recharge_amount && max_recharge_amount && min_recharge_amount > max_recharge_amount) {
      return res.status(400).json({ error: 'Minimum amount cannot be greater than maximum amount' });
    }

    // Validate URLs
    if (external_payment_link) {
      try {
        new URL(external_payment_link);
      } catch {
        return res.status(400).json({ error: 'Invalid external payment link URL' });
      }
    }

    if (webhook_url) {
      try {
        new URL(webhook_url);
      } catch {
        return res.status(400).json({ error: 'Invalid webhook URL' });
      }
    }

    // Ensure at least one payment method is enabled
    if (manual_upi_enabled === false && razorpay_enabled === false) {
      return res.status(400).json({ error: 'At least one payment method must be enabled' });
    }

    let settings = await AdminSettings.findOne() || new AdminSettings();

    // Update fields
    if (manual_upi_enabled !== undefined) settings.manual_upi_enabled = manual_upi_enabled;
    if (upi_id !== undefined) settings.upi_id = upi_id;
    if (upi_name !== undefined) settings.upi_name = upi_name;
    if (qr_code_url !== undefined) settings.qr_code_url = qr_code_url;
    if (razorpay_enabled !== undefined) settings.razorpay_enabled = razorpay_enabled;
    if (external_payment_link !== undefined) settings.external_payment_link = external_payment_link;
    if (webhook_url !== undefined) settings.webhook_url = webhook_url;
    if (payment_methods_order !== undefined) {
      // Validate order array
      const validMethods = ['razorpay', 'upi'];
      if (Array.isArray(payment_methods_order) && 
          payment_methods_order.every(m => validMethods.includes(m))) {
        settings.payment_methods_order = payment_methods_order;
      }
    }
    if (min_recharge_amount !== undefined) settings.min_recharge_amount = min_recharge_amount;
    if (max_recharge_amount !== undefined) settings.max_recharge_amount = max_recharge_amount;
    if (recharge_success_message !== undefined) settings.recharge_success_message = recharge_success_message;

    settings.updatedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Payment settings updated successfully',
      settings: {
        manual_upi_enabled: settings.manual_upi_enabled,
        upi_id: settings.upi_id,
        upi_name: settings.upi_name,
        qr_code_url: settings.qr_code_url,
        razorpay_enabled: settings.razorpay_enabled,
        external_payment_link: settings.external_payment_link,
        webhook_url: settings.webhook_url,
        payment_methods_order: settings.payment_methods_order,
        min_recharge_amount: settings.min_recharge_amount,
        max_recharge_amount: settings.max_recharge_amount,
        recharge_success_message: settings.recharge_success_message
      }
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings', details: error.message });
  }
});

// Get public recharge settings
router.get('/public-settings', async (req, res) => {
  try {
    const settings = await AdminSettings.findOne() || new AdminSettings();
    
    res.json({
      min_amount: settings.min_recharge_amount,
      max_amount: settings.max_recharge_amount,
      success_message: settings.recharge_success_message
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export default router;
