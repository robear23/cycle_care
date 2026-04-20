const TelegramBot = require('node-telegram-bot-api');
const { handleOnboarding, onboardingState } = require('./onboarding');
const { handleToday, handlePhase, handleHelp, handleLearn, handleSubscription, handleRefer, handleCycleLength, handleWeekends, handleCycleLengthMessage } = require('./commands');

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
// Polling for local dev, Webhook for prod (later)
const bot = new TelegramBot(token, { polling: true });

function initBot() {
    console.log('Bot is running...');

    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
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
        handleOnboarding(bot, msg, prefilledEmail, referredBy);
    });

    bot.onText(/\/cyclelength/, (msg) => handleCycleLength(bot, msg));
    bot.onText(/\/today/, (msg) => handleToday(bot, msg));
    bot.onText(/\/phase/, (msg) => handlePhase(bot, msg));
    bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
    bot.onText(/\/learn(.+)?/, (msg, match) => handleLearn(bot, msg, match));
    bot.onText(/\/subscription/, (msg) => handleSubscription(bot, msg));
    bot.onText(/\/refer/, (msg) => handleRefer(bot, msg));
    bot.onText(/\/weekends/, (msg) => handleWeekends(bot, msg));

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
