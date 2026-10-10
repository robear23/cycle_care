const { prisma } = require('../lib/prisma');
const { onboardingState } = require('./onboarding');
const { periodDateState } = require('./periodStart');
const { cycleLengthState } = require('./commands');

const NOT_SIGNED_UP = "You don't have an account with CycleCare, so there's nothing to change. Send /start to sign up.";

// /stop — pause daily messages without losing settings.
async function handleStop(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (!user) {
        await bot.sendMessage(chatId, NOT_SIGNED_UP);
        return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { subscription_status: 'paused' } });
    await bot.sendMessage(chatId, "Daily messages are paused. Your settings are saved — send /resume whenever you want them back.\n\nTo erase everything instead, send /delete.");
}

// /delete — ask for confirmation before erasing the account.
async function handleDelete(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (!user) {
        await bot.sendMessage(chatId, NOT_SIGNED_UP);
        return;
    }

    await bot.sendMessage(chatId, "This permanently deletes your CycleCare account: your settings, your partner's cycle data, your message history and your email address. This can't be undone.\n\nDelete everything?", {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Yes, delete everything', callback_data: 'delete_confirm' },
                { text: 'Cancel', callback_data: 'delete_cancel' }
            ]]
        }
    });
}

// Erases the user, their message log (cascade) and any waitlist entry for their email.
async function deleteAccount(user) {
    const operations = [];
    if (user.email) {
        // Older leads were stored before emails were lower-cased.
        operations.push(prisma.waitlistLead.deleteMany({ where: { email: { equals: user.email, mode: 'insensitive' } } }));
    }
    operations.push(prisma.user.delete({ where: { id: user.id } }));
    await prisma.$transaction(operations);
}

// Handles the delete confirmation buttons. Returns true if the action was handled.
async function handleAccountCallback(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id.toString();

    switch (callbackQuery.data) {
        case 'delete_confirm': {
            const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
            if (user) await deleteAccount(user);
            // Drop any half-finished input so a later message isn't applied to a deleted account.
            onboardingState.delete(chatId);
            periodDateState.delete(chatId);
            cycleLengthState.delete(chatId);
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Deleted' });
            await bot.sendMessage(chatId, "Done — all your data has been deleted. If you ever want to come back, just send /start.");
            return true;
        }
        case 'delete_cancel': {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Nothing deleted' });
            await bot.sendMessage(chatId, "Nothing was deleted.");
            return true;
        }
        default:
            return false;
    }
}

module.exports = { handleStop, handleDelete, handleAccountCallback };
