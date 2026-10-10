const { DateTime } = require('luxon');
const { prisma } = require('../lib/prisma');
const { bot } = require('../bot/index');
const { handlePregnancyCallback } = require('../bot/pregnancy');
const { TODAY_YESTERDAY_ROW, OTHER_DATE_BUTTON, handlePeriodStartCallback } = require('../bot/periodStart');

async function checkUserCycleReminder(user) {
    // We expect this to run once a day per user, right around their notification time.
    const cycleStart = new Date(user.cycle_start_date);
    const now = new Date();

    // specific logic: diff in days
    const diffTime = now.getTime() - cycleStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // For better accuracy, we can also use calculatePhase logic, but diffDays is fine here.
    // Fire reminder window: from cycle_length_min through cycle_length_max (or cycle_length if no range)
    const windowStart = user.cycle_length_min || user.cycle_length;
    const windowEnd = user.cycle_length_max || user.cycle_length;
    if (diffDays >= windowStart && diffDays <= windowEnd) {
        const partnerName = (user.partner_name && user.partner_name.toLowerCase() !== 'skip' && user.partner_name !== '/start') ? user.partner_name : 'Your partner';

        // Send interactive message
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    TODAY_YESTERDAY_ROW,
                    [
                        { text: 'Not yet', callback_data: `period_not_yet` },
                        OTHER_DATE_BUTTON
                    ],
                    [
                        { text: "🤰 She's pregnant", callback_data: `pregnancy_ask` }
                    ]
                ]
            }
        };

        try {
            await bot.sendMessage(user.telegram_chat_id, `Hey! According to your settings, ${partnerName}'s period might be due around now. Has it started?`, opts);
            console.log(`Sent cycle end reminder to user ${user.id}`);
        } catch (e) {
            console.error(`Failed to send cycle reminder to user ${user.id}`, e);
        }
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

            if (await handlePeriodStartCallback(bot, callbackQuery)) return;
            if (await handlePregnancyCallback(bot, callbackQuery)) return;

            if (action === 'period_not_yet') {
                await bot.answerCallbackQuery(callbackQuery.id, { text: "Okay, I'll check in again later." });
                await bot.sendMessage(chatId, "No problem. I'll keep the current cycle going until you update me.");
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
