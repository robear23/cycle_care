const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getDailyTip } = require('./social');
const { messagePage } = require('./pages');
const { joinWaitlist } = require('../lib/waitlist');
const { botLink } = require('../lib/botLink');
const { bot, WEBHOOK_PATH, webhookSecret } = require('../bot/index');

function secretMatches(received, expected) {
    const a = Buffer.from(received || '');
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Telegram webhook (active only when TELEGRAM_WEBHOOK_URL/SECRET are set).
// Telegram signs each request with the secret we registered in setWebHook.
router.post(WEBHOOK_PATH, (req, res) => {
    if (!webhookSecret || !secretMatches(req.get('X-Telegram-Bot-Api-Secret-Token'), webhookSecret)) {
        return res.sendStatus(401);
    }
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Simple health check
router.get('/health', (req, res) => {
    res.send('OK');
});

// Direct link to the bot for people who don't want to give an email.
router.get('/start', (req, res) => {
    res.redirect(botLink());
});

const waitlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).send(messagePage('Slow down a little', "You've tried a few times in a row. Please wait a few minutes and try again, or open CycleCare directly in Telegram."));
    }
});

router.post('/api/waitlist', waitlistLimiter, async (req, res) => {
    let result;
    try {
        result = await joinWaitlist(req.body?.email);
    } catch (err) {
        // Don't block signup on a database hiccup: send them to the bot without a pre-filled email.
        console.error('[Waitlist] Failed to save lead:', err);
        return res.redirect(botLink());
    }

    if (!result.ok) {
        return res.status(400).send(messagePage('Check your email address', "That doesn't look like a valid email address. Please go back and try again."));
    }
    res.redirect(result.link);
});

// Social Marketing
router.get('/social/daily-tip', getDailyTip);

module.exports = router;
