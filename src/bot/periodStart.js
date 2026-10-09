const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chrono = require('chrono-node');

// In-memory state for typing a custom period start date: { [chatId]: true }
const periodDateState = new Map();

const TODAY_YESTERDAY_ROW = [
    { text: 'Yes, started today', callback_data: 'period_start_today' },
    { text: 'Yes, yesterday', callback_data: 'period_start_yesterday' }
];
const OTHER_DATE_BUTTON = { text: 'Another date', callback_data: 'period_start_other' };

// Sets a new cycle start date. Logging a period always ends pregnancy mode.
async function logPeriodStart(bot, chatId, startDate) {
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    await prisma.user.update({
        where: { telegram_chat_id: chatId },
        data: { cycle_start_date: startDate, pregnancy_mode: false }
    });
    periodDateState.delete(chatId);

    const formatted = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (user && user.pregnancy_mode) {
        await bot.sendMessage(chatId, `Tracking resumed with the cycle starting ${formatted}. Your daily messages will start again at your usual time.\n\nCycles can be irregular after pregnancy — use /cyclelength if you need to adjust the length.`);
    } else {
        await bot.sendMessage(chatId, `Got it. Cycle updated to start ${formatted}.`);
    }
}

// Handles period start buttons. Returns true if the action was handled.
async function handlePeriodStartCallback(bot, callbackQuery) {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id.toString();

    switch (action) {
        case 'period_start_today':
        case 'period_start_yesterday': {
            const startDate = new Date();
            if (action === 'period_start_yesterday') startDate.setDate(startDate.getDate() - 1);
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Updated!' });
            await logPeriodStart(bot, chatId, startDate);
            return true;
        }
        case 'period_start_other': {
            periodDateState.set(chatId, true);
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, "Send me the date her period started (e.g. '14 Feb', 'last tuesday', or 'YYYY-MM-DD'). Type 'cancel' to stop.");
            return true;
        }
        case 'period_update_cancel': {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'No changes made' });
            await bot.sendMessage(chatId, "No changes made.");
            return true;
        }
        default:
            return false;
    }
}

// Free-text date entry after tapping "Another date". Returns true if the message was handled.
async function handlePeriodDateMessage(bot, msg) {
    const chatId = msg.chat.id.toString();
    if (!periodDateState.has(chatId)) return false;

    const text = msg.text.trim();

    if (text.toLowerCase() === 'cancel') {
        periodDateState.delete(chatId);
        await bot.sendMessage(chatId, "No changes made.");
        return true;
    }

    const parsedDate = chrono.parseDate(text);
    if (!parsedDate) {
        await bot.sendMessage(chatId, "I couldn't understand that date. Please try again (e.g. '14 Feb', 'last tuesday', or 'YYYY-MM-DD'), or type 'cancel'.");
        return true;
    }
    if (parsedDate > new Date()) {
        await bot.sendMessage(chatId, "That date is in the future. Please send the date her period actually started, or type 'cancel'.");
        return true;
    }

    await logPeriodStart(bot, chatId, parsedDate);
    return true;
}

module.exports = {
    TODAY_YESTERDAY_ROW,
    OTHER_DATE_BUTTON,
    handlePeriodStartCallback,
    handlePeriodDateMessage
};
