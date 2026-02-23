const express = require('express');
const router = express.Router();
const { bot } = require('../bot/index');

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
