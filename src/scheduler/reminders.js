const { prisma } = require('../lib/prisma');
const { partnerName, expectedCycleEnd, cycleStatus } = require('../lib/briefing');
const { bot } = require('../bot/index');
const { handlePregnancyCallback } = require('../bot/pregnancy');
const { handleAccountCallback } = require('../bot/account');
const { handleOnboardingCallback } = require('../bot/onboarding');
const { TODAY_YESTERDAY_ROW, OTHER_DATE_BUTTON, handlePeriodStartCallback } = require('../bot/periodStart');

// Runs right after the daily briefing. From the start of the expected window
// it asks every day until the user logs the new period (or pregnancy).
async function checkUserCycleReminder(user, now = new Date()) {
    const { day } = cycleStatus(user, now);
    const windowStart = user.cycle_length_min || user.cycle_length;
    if (day < windowStart) return;

    const name = partnerName(user) || 'Your partner';
    const daysLate = day - expectedCycleEnd(user);
    const question = daysLate > 0
        ? `${name}'s period is ${daysLate} day${daysLate === 1 ? '' : 's'} later than expected. Has it started?`
        : `Hey! According to your settings, ${name}'s period might be due around now. Has it started?`;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                TODAY_YESTERDAY_ROW,
                [
                    { text: 'Not yet', callback_data: 'period_not_yet' },
                    OTHER_DATE_BUTTON
                ],
                [
                    { text: "🤰 She's pregnant", callback_data: 'pregnancy_ask' }
                ]
            ]
        }
    };

    try {
        await bot.sendMessage(user.telegram_chat_id, question, opts);
        console.log(`Sent cycle end reminder to user ${user.id}`);
    } catch (e) {
        console.error(`Failed to send cycle reminder to user ${user.id}`, e);
    }
}

// Handler for callback queries
function handleReminderCallbacks(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const action = callbackQuery.data;
        // Telegram omits the message for inline-mode or very old messages.
        if (!callbackQuery.message) {
            bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
            return;
        }
        const chatId = callbackQuery.message.chat.id.toString();

        try {
            const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
            if (!user) {
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            if (await handlePeriodStartCallback(bot, callbackQuery, user)) return;
            if (await handlePregnancyCallback(bot, callbackQuery)) return;
            if (await handleAccountCallback(bot, callbackQuery)) return;
            if (await handleOnboardingCallback(bot, callbackQuery)) return;

            if (action === 'period_not_yet') {
                await bot.answerCallbackQuery(callbackQuery.id, { text: "Okay, I'll check in again tomorrow." });
                await bot.sendMessage(chatId, "No problem. I'll check in again tomorrow.");
            }
        } catch (e) {
            console.error(`Failed to handle callback ${action} for chat ${chatId}`, e);
            // Clear the button's loading spinner; ignore if it was already answered.
            bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
            bot.sendMessage(chatId, "Something went wrong. Please try again.").catch((sendErr) => {
                console.error(`Failed to send error notice to chat ${chatId}:`, sendErr);
            });
        }
    });
}

module.exports = { checkUserCycleReminder, handleReminderCallbacks };
