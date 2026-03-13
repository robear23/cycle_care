const TelegramBot = require('node-telegram-bot-api');
const { handleOnboarding, onboardingState } = require('./onboarding');
const { handleToday, handlePhase, handleHelp, handleLearn, handleSubscription, handleRefer, handleCycleLength, handleCycleLengthMessage } = require('./commands');

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
// Polling for local dev, Webhook for prod (later)
const bot = new TelegramBot(token, { polling: true });

function initBot() {
    console.log('Bot is running...');

    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
        const chatId = msg.chat.id.toString();
        const payload = match[1]?.trim();
        let prefilledEmail = null;
        if (payload) {
            try {
                const decoded = Buffer.from(payload, 'base64url').toString('utf8');
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)) {
                    prefilledEmail = decoded;
                }
            } catch (e) {}
        }
        onboardingState.delete(chatId); // reset so handleOnboarding runs the init block
        handleOnboarding(bot, msg, prefilledEmail);
    });

    bot.onText(/\/cyclelength/, (msg) => handleCycleLength(bot, msg));
    bot.onText(/\/today/, (msg) => handleToday(bot, msg));
    bot.onText(/\/phase/, (msg) => handlePhase(bot, msg));
    bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
    bot.onText(/\/learn(.+)?/, (msg, match) => handleLearn(bot, msg, match));
    bot.onText(/\/subscription/, (msg) => handleSubscription(bot, msg));
    bot.onText(/\/refer/, (msg) => handleRefer(bot, msg));

    // Catch-all for text messages to handle conversational flows
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id.toString();
        if (msg.text && !msg.text.startsWith('/')) {
            if (onboardingState.has(chatId)) {
                handleOnboarding(bot, msg);
            } else {
                await handleCycleLengthMessage(bot, msg);
            }
        }
    });

    return bot;
}

module.exports = { initBot, bot };
