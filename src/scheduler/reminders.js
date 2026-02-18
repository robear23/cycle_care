const { DateTime } = require('luxon');
const { PrismaClient } = require('@prisma/client');
const { bot } = require('../bot/index');
const prisma = new PrismaClient();

async function checkCycleReminders() {
    console.log('Running cycle reminders check...');

    // Find users who are late in their cycle (e.g. Current Day >= Cycle Length)
    // We need to calculate this.
    // Ideally, we do this once a day.

    const users = await prisma.user.findMany({
        where: { subscription_status: { in: ['trial', 'active'] } }
    });

    for (const user of users) {
        const cycleStart = new Date(user.cycle_start_date);
        const now = new Date();

        // specific logic: diff in days
        const diffTime = now.getTime() - cycleStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Logic: If today is exactly Cycle Length + 1, ask if period started.
        // Or Day 28 (if average). 
        // Let's go with Day = Cycle Length.

        if (diffDays === user.cycle_length) {
            // Send interactive message
            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Yes, started today', callback_data: `period_start_today` },
                            { text: 'Yes, yesterday', callback_data: `period_start_yesterday` }
                        ],
                        [
                            { text: 'Not yet', callback_data: `period_not_yet` }
                        ]
                    ]
                }
            };

            await bot.sendMessage(user.telegram_chat_id, `Hey! According to your settings, [Partner]'s period might be due around now. Has it started?`.replace('[Partner]', user.partner_name || 'your partner'), opts);
        }
    }
}

// Handler for callback queries
function handleReminderCallbacks(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const action = callbackQuery.data;
        const msg = callbackQuery.message;
        const chatId = msg.chat.id.toString();

        const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
        if (!user) return;

        let newDate;
        let responseText;

        if (action === 'period_start_today') {
            newDate = new Date();
            responseText = "Got it. Cycle updated to start today.";
        } else if (action === 'period_start_yesterday') {
            newDate = new Date();
            newDate.setDate(newDate.getDate() - 1);
            responseText = "Got it. Cycle updated to start yesterday.";
        } else if (action === 'period_not_yet') {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Okay, I'll check in again later." });
            await bot.sendMessage(chatId, "No problem. I'll keep the current cycle going until you update me.");
            return;
        }

        if (newDate) {
            await prisma.user.update({
                where: { telegram_chat_id: chatId },
                data: { cycle_start_date: newDate }
            });
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Updated!" });
            await bot.sendMessage(chatId, responseText);
        }
    });
}

module.exports = { checkCycleReminders, handleReminderCallbacks };
