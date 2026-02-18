const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../payments/stripe');
const { bot } = require('../bot/index');

// Stripe Webhook - needs raw body for signature verification
// We'll handle raw body in the main app configuration or here
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Telegram Webhook (if used)
router.post('/webhook/telegram', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Simple health check
router.get('/health', (req, res) => {
    res.send('OK');
});

module.exports = router;
