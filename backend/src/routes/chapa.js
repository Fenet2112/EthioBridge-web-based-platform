// backend/src/routes/chapa.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const CHAPA_API_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_API_URL = 'https://api.chapa.co/v1';

// Initialize payment
router.post('/payment/initialize', authenticateToken, async (req, res) => {
  const { amount, plan, phone_number } = req.body;
  const userId = req.user.id;

  if (!amount || !plan) {
    return res.status(400).json({ message: 'Amount and plan are required' });
  }

  try {
    // Get user details
    const userResult = await pool.query('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    const txRef = `ethiobridge-${userId}-${Date.now()}`;

    // Create payment record in database
    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, plan, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, txRef, amount, plan, 'pending']
    );

    // Initialize Chapa payment
    const payload = {
      amount: amount,
      currency: 'ETB',
      email: user.email,
      first_name: user.email.split('@')[0],
      last_name: user.role,
      phone_number: phone_number || '',
      tx_ref: txRef,
      callback_url: `${process.env.BACKEND_URL}/api/chapa/callback`,
      return_url: `${process.env.APP_URL}/subscription?payment=success`,
      customization: {
        title: 'EthioBridge Premium Subscription',
        description: `${plan} subscription payment`
      }
    };

    const response = await axios.post(
      `${CHAPA_API_URL}/transaction/initialize`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${CHAPA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status === 'success') {
      res.json({
        success: true,
        checkout_url: response.data.data.checkout_url,
        tx_ref: txRef
      });
    } else {
      throw new Error(response.data.message || 'Payment initialization failed');
    }
  } catch (error) {
    console.error('Chapa initialization error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to initialize payment',
      error: error.response?.data?.message || error.message
    });
  }
});

// Verify payment
router.get('/payment/verify/:tx_ref', authenticateToken, async (req, res) => {
  const { tx_ref } = req.params;

  try {
    const response = await axios.get(
      `${CHAPA_API_URL}/transaction/verify/${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${CHAPA_API_KEY}`
        }
      }
    );

    if (response.data.status === 'success') {
      const transaction = response.data.data;
      
      // Update payment record
      await pool.query(
        `UPDATE payments 
         SET status = $1, chapa_reference = $2, verified_at = NOW() 
         WHERE tx_ref = $3`,
        [transaction.status, transaction.reference, tx_ref]
      );

      // If payment successful, activate subscription
      if (transaction.status === 'success') {
        const paymentResult = await pool.query(
          'SELECT user_id, plan, amount FROM payments WHERE tx_ref = $1',
          [tx_ref]
        );

        if (paymentResult.rows.length > 0) {
          const { user_id, plan, amount } = paymentResult.rows[0];
          
          // Calculate subscription end date
          const duration = plan === 'monthly' ? '1 month' : '1 year';
          
          // Activate subscription
          await pool.query(
            `INSERT INTO subscriptions (user_id, plan, amount, start_date, end_date, status, payment_method, transaction_id)
             VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${duration}', 'active', 'chapa', $4)
             ON CONFLICT (user_id) 
             DO UPDATE SET 
               plan = $2, 
               amount = $3, 
               start_date = NOW(), 
               end_date = NOW() + INTERVAL '${duration}', 
               status = 'active',
               payment_method = 'chapa',
               transaction_id = $4`,
            [user_id, plan, amount, tx_ref]
          );
        }
      }

      res.json({
        success: true,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.message || 'Verification failed'
      });
    }
  } catch (error) {
    console.error('Chapa verification error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to verify payment',
      error: error.response?.data?.message || error.message
    });
  }
});

// Webhook callback from Chapa
router.post('/callback', async (req, res) => {
  try {
    const { tx_ref, status, reference } = req.body;

    console.log('Chapa webhook received:', { tx_ref, status, reference });

    // Update payment status
    await pool.query(
      `UPDATE payments 
       SET status = $1, chapa_reference = $2, verified_at = NOW() 
       WHERE tx_ref = $3`,
      [status, reference, tx_ref]
    );

    // If successful, activate subscription
    if (status === 'success') {
      const paymentResult = await pool.query(
        'SELECT user_id, plan, amount FROM payments WHERE tx_ref = $1',
        [tx_ref]
      );

      if (paymentResult.rows.length > 0) {
        const { user_id, plan, amount } = paymentResult.rows[0];
        const duration = plan === 'monthly' ? '1 month' : '1 year';
        
        await pool.query(
          `INSERT INTO subscriptions (user_id, plan, amount, start_date, end_date, status, payment_method, transaction_id)
           VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${duration}', 'active', 'chapa', $4)
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             plan = $2, 
             amount = $3, 
             start_date = NOW(), 
             end_date = NOW() + INTERVAL '${duration}', 
             status = 'active',
             payment_method = 'chapa',
             transaction_id = $4`,
          [user_id, plan, amount, tx_ref]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment history
router.get('/payments/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tx_ref, amount, plan, status, created_at, verified_at 
       FROM payments 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
});

module.exports = router;
