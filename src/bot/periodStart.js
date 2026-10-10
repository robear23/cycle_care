const { prisma } = require('../lib/prisma');
const { userToday, addDays, parseUserDate, periodStartProblem, formatCalendarDate } = require('../lib/dates');

// In-memory state for typing a custom period start date: { [chatId]: true }
const periodDateState = new Map();

const TODAY_YESTERDAY_ROW = [
    { text: 'Yes, started today', callback_data: 'period_start_today' },
    { text: 'Yes, yesterday', callback_data: 'period_start_yesterday' }
];
const OTHER_DATE_BUTTON = { text: 'Another date', callback_data: 'period_start_other' };

// Sets a new cycle start date (a calendar date). Logging a period always ends pregnancy mode.
async function logPeriodStart(bot, user, startDate) {
    const chatId = user.telegram_chat_id;
    await prisma.user.update({
        where: { telegram_chat_id: chatId },
        data: { cycle_start_date: startDate, pregnancy_mode: false }
    });
    periodDateState.delete(chatId);

    const formatted = formatCalendarDate(startDate, { day: 'numeric', month: 'short', year: 'numeric' });
    if (user.pregnancy_mode) {
        await bot.sendMessage(chatId, `Tracking resumed with the cycle starting ${formatted}. Your daily messages will start again at your usual time.\n\nCycles can be irregular after pregnancy — use /cyclelength if you need to adjust the length.`);
    } else {
        await bot.sendMessage(chatId, `Got it. Cycle updated to start ${formatted}.`);
    }
}

// Handles period start buttons for a registered user. Returns true if the action was handled.
async function handlePeriodStartCallback(bot, callbackQuery, user) {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id.toString();

    switch (action) {
        case 'period_start_today':
        case 'period_start_yesterday': {
            const today = userToday(user.timezone);
            const startDate = action === 'period_start_yesterday' ? addDays(today, -1) : today;
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Updated!' });
            await logPeriodStart(bot, user, startDate);
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

    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (!user) {
        periodDateState.delete(chatId);
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return true;
    }

    const parsedDate = parseUserDate(text, user.timezone);
    if (!parsedDate) {
        await bot.sendMessage(chatId, "I couldn't understand that date. Please try again (e.g. '14 Feb', 'last tuesday', or 'YYYY-MM-DD'), or type 'cancel'.");
        return true;
    }
    const problem = periodStartProblem(parsedDate, userToday(user.timezone));
    if (problem) {
        await bot.sendMessage(chatId, `${problem} Or type 'cancel'.`);
        return true;
    }

    await logPeriodStart(bot, user, parsedDate);
    return true;
}

module.exports = {
    TODAY_YESTERDAY_ROW,
    OTHER_DATE_BUTTON,
    handlePeriodStartCallback,
    handlePeriodDateMessage,
    periodDateState
};
