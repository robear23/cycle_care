const TelegramBot = require('node-telegram-bot-api');
const { handleStart, handleOnboarding, onboardingState } = require('./onboarding');
const { handleResume } = require('./pregnancy');
const { handleStop, handleDelete } = require('./account');
const { handlePeriodDateMessage } = require('./periodStart');
const { handleUpdate, handleToday, handlePhase, handleHelp, handleLearn, handleSubscription, handleRefer, handleCycleLength, handleWeekends, handleCycleLengthMessage } = require('./commands');

const token = process.env.TELEGRAM_BOT_TOKEN;
// With TELEGRAM_WEBHOOK_URL set, Telegram pushes updates to /webhook/telegram
// (avoids polling conflicts during redeploys); otherwise we poll, which suits
// local dev. Either way, run a single instance: conversation state is in memory.
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const WEBHOOK_PATH = '/webhook/telegram';
const bot = new TelegramBot(token, { polling: !webhookUrl });

// Matches "/name" or "/name@BotName", optionally followed by an argument in match[1].
function command(name, { withArgument = false } = {}) {
    const argument = withArgument ? String.raw`(?:\s+([\s\S]+))?` : '';
    return new RegExp(String.raw`^/${name}(?:@\w+)?${argument}\s*$`, 'i');
}

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

async function initBot() {
    if (webhookUrl) {
        if (!webhookSecret) throw new Error('TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_WEBHOOK_URL is set');
        await bot.setWebHook(`${webhookUrl}${WEBHOOK_PATH}`, { secret_token: webhookSecret });
        console.log('Bot is running (webhook)...');
    } else {
        console.log('Bot is running (polling)...');
    }

    bot.onText(command('start', { withArgument: true }), safely((msg, match) => handleStart(bot, msg, match[1]?.trim())));
    bot.onText(command('cyclelength'), safely((msg) => handleCycleLength(bot, msg)));
    bot.onText(command('today'), safely((msg) => handleToday(bot, msg)));
    bot.onText(command('phase'), safely((msg) => handlePhase(bot, msg)));
    bot.onText(command('help'), safely((msg) => handleHelp(bot, msg)));
    bot.onText(command('learn', { withArgument: true }), safely((msg, match) => handleLearn(bot, msg, match)));
    bot.onText(command('subscription'), safely((msg) => handleSubscription(bot, msg)));
    bot.onText(command('refer'), safely((msg) => handleRefer(bot, msg)));
    bot.onText(command('weekends'), safely((msg) => handleWeekends(bot, msg)));
    bot.onText(command('update'), safely((msg) => handleUpdate(bot, msg)));
    bot.onText(command('resume'), safely((msg) => handleResume(bot, msg)));
    bot.onText(command('stop'), safely((msg) => handleStop(bot, msg)));
    bot.onText(command('delete'), safely((msg) => handleDelete(bot, msg)));

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

module.exports = { initBot, bot, WEBHOOK_PATH, webhookSecret };
