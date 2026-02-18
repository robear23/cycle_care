const TelegramBot = require('node-telegram-bot-api');
const { handleOnboarding, onboardingState } = require('./onboarding');
const { handleToday, handlePhase, handleHelp, handleLearn, handleSubscription, handleRefer } = require('./commands');

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
// Polling for local dev, Webhook for prod (later)
const bot = new TelegramBot(token, { polling: true });

function initBot() {
    console.log('Bot is running...');

    bot.onText(/\/start/, (msg) => {
        // trigger onboarding
        // reset state if needed
        onboardingState.set(msg.chat.id.toString(), { step: 'name', data: {} });
        handleOnboarding(bot, msg);
    });

    bot.onText(/\/today/, (msg) => handleToday(bot, msg));
    bot.onText(/\/phase/, (msg) => handlePhase(bot, msg));
    bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
    bot.onText(/\/learn(.+)?/, (msg, match) => handleLearn(bot, msg, match));
    bot.onText(/\/subscription/, (msg) => handleSubscription(bot, msg));
    bot.onText(/\/refer/, (msg) => handleRefer(bot, msg));

    // Catch-all for text messages to handle onboarding flow
    bot.on('message', (msg) => {
        const chatId = msg.chat.id.toString();
        if (msg.text && !msg.text.startsWith('/')) {
            if (onboardingState.has(chatId)) {
                handleOnboarding(bot, msg);
            }
        }
    });

    return bot;
}

module.exports = { initBot, bot };
