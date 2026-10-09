const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { TODAY_YESTERDAY_ROW, OTHER_DATE_BUTTON } = require('./periodStart');

const PREGNANCY_PAUSED_TEXT = "Pregnancy mode is on, so cycle tracking is paused. When you're ready to start again, send /resume.";

async function askForResumeDate(bot, chatId) {
    await bot.sendMessage(chatId, "Welcome back 💜 When did the first period after the pregnancy start?", {
        reply_markup: { inline_keyboard: [TODAY_YESTERDAY_ROW, [OTHER_DATE_BUTTON]] }
    });
}

// /resume command
async function handleResume(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    if (!user.pregnancy_mode) {
        await bot.sendMessage(chatId, "Tracking is already active. If a new period has started, send /update.");
        return;
    }

    await askForResumeDate(bot, chatId);
}

// Handles inline buttons for pregnancy mode. Returns true if the action was handled.
async function handlePregnancyCallback(bot, callbackQuery) {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id.toString();

    switch (action) {
        case 'pregnancy_ask': {
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, "Congratulations! 🎉 Want me to switch to pregnancy mode? Daily cycle messages will pause until you tell me the first day of her next period.", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Yes, pause tracking', callback_data: 'pregnancy_confirm' },
                        { text: 'Cancel', callback_data: 'pregnancy_cancel' }
                    ]]
                }
            });
            return true;
        }
        case 'pregnancy_confirm': {
            await prisma.user.update({
                where: { telegram_chat_id: chatId },
                data: { pregnancy_mode: true }
            });
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Pregnancy mode on' });
            await bot.sendMessage(chatId, "Pregnancy mode is on — I've paused your daily cycle messages. 💜\n\nWhen her periods return, tap the button below or send /resume and enter the first day of her period.", {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Resume tracking', callback_data: 'resume_ask' }]]
                }
            });
            return true;
        }
        case 'pregnancy_cancel': {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'No changes made' });
            await bot.sendMessage(chatId, "No problem — tracking continues as normal.");
            return true;
        }
        case 'resume_ask': {
            await bot.answerCallbackQuery(callbackQuery.id);
            await askForResumeDate(bot, chatId);
            return true;
        }
        default:
            return false;
    }
}

module.exports = {
    PREGNANCY_PAUSED_TEXT,
    handleResume,
    handlePregnancyCallback
};
