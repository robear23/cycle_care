const TelegramBot = require('node-telegram-bot-api');
const { prisma } = require('../lib/prisma');
const { handleOnboarding, onboardingState } = require('./onboarding');
const { handleResume } = require('./pregnancy');
const { handlePeriodDateMessage } = require('./periodStart');
const { handleUpdate, handleToday, handlePhase, handleHelp, handleLearn, handleSubscription, handleRefer, handleCycleLength, handleWeekends, handleCycleLengthMessage } = require('./commands');

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
// Polling for local dev, Webhook for prod (later)
const bot = new TelegramBot(token, { polling: true });

// Every handler runs through this so a DB or Telegram error is logged and
// reported to the user instead of becoming an unhandled rejection.
function safely(handler) {
    return async (msg, ...args) => {
        try {
            await handler(msg, ...args);
        } catch (err) {
            console.error(`Handler failed for chat ${msg.chat.id}:`, err);
            bot.sendMessage(msg.chat.id, "Something went wrong. Please try again.").catch((sendErr) => {
                console.error(`Failed to send error notice to chat ${msg.chat.id}:`, sendErr);
            });
        }
    };
}

function initBot() {
    console.log('Bot is running...');

    bot.onText(/\/start(?:\s+(.+))?/, safely(async (msg, match) => {
        const chatId = msg.chat.id.toString();
        const payload = match[1]?.trim();
        let prefilledEmail = null;
        let referredBy = null;

        if (payload) {
            // Attempt to decode as email
            try {
                const decoded = Buffer.from(payload, 'base64url').toString('utf8');
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)) {
                    prefilledEmail = decoded;
                }
            } catch (e) {}

            // If not email, check if it's a referral code
            if (!prefilledEmail && payload.length === 6) {
                const referrer = await prisma.user.findUnique({
                    where: { referral_code: payload.toUpperCase() }
                });
                if (referrer) {
                    referredBy = referrer.referral_code;
                }
            }
        }
        onboardingState.delete(chatId); // reset so handleOnboarding runs the init block
        await handleOnboarding(bot, msg, prefilledEmail, referredBy);
    }));

    bot.onText(/\/cyclelength/, safely((msg) => handleCycleLength(bot, msg)));
    bot.onText(/\/today/, safely((msg) => handleToday(bot, msg)));
    bot.onText(/\/phase/, safely((msg) => handlePhase(bot, msg)));
    bot.onText(/\/help/, safely((msg) => handleHelp(bot, msg)));
    bot.onText(/\/learn(.+)?/, safely((msg, match) => handleLearn(bot, msg, match)));
    bot.onText(/\/subscription/, safely((msg) => handleSubscription(bot, msg)));
    bot.onText(/\/refer/, safely((msg) => handleRefer(bot, msg)));
    bot.onText(/\/weekends/, safely((msg) => handleWeekends(bot, msg)));
    bot.onText(/\/update/, safely((msg) => handleUpdate(bot, msg)));
    bot.onText(/\/resume/, safely((msg) => handleResume(bot, msg)));

    // Catch-all for text messages to handle conversational flows
    bot.on('message', safely(async (msg) => {
        const chatId = msg.chat.id.toString();
        if (msg.text && !msg.text.startsWith('/')) {
            if (onboardingState.has(chatId)) {
                await handleOnboarding(bot, msg);
            } else if (!(await handlePeriodDateMessage(bot, msg))) {
                await handleCycleLengthMessage(bot, msg);
            }
        }
    }));

    return bot;
}

module.exports = { initBot, bot };
