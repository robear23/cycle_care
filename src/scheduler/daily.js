const cron = require('node-cron');
const { prisma } = require('../lib/prisma');
const { buildBriefing } = require('../lib/briefing');
const { nextSendAt, dueAction } = require('../lib/sendSchedule');
const { bot } = require('../bot/index');
const { checkUserCycleReminder } = require('./reminders');
const { checkAndNurtureLeads } = require('./nurture');

// Users who should currently receive daily briefings.
const SENDABLE = { subscription_status: { in: ['trial', 'active'] }, pregnancy_mode: false };

function startScheduler() {
    console.log('Scheduler started...');

    // Daily lead nurturing at 10 AM UTC
    cron.schedule('0 10 * * *', async () => {
        try {
            await checkAndNurtureLeads();
        } catch (err) {
            console.error('Error running lead nurturing:', err);
        }
    });

    cron.schedule('* * * * *', async () => {
        try {
            await sendDueBriefings();
        } catch (err) {
            console.error('Error loading users for daily messages:', err);
        }
    });
}

async function sendDueBriefings(now = new Date()) {
    const users = await prisma.user.findMany({
        where: {
            ...SENDABLE,
            OR: [{ next_send_at: null }, { next_send_at: { lte: now } }]
        }
    });

    for (const user of users) {
        try {
            await processDueUser(user, now);
        } catch (err) {
            console.error(`Error processing user ${user.id}:`, err);
        }
    }
}

async function processDueUser(user, now) {
    const action = dueAction(user, now);

    // Claim the slot before sending so an overlapping tick or a second
    // instance can't send the same briefing twice.
    // Re-checking status skips users who sent /stop since the batch was loaded.
    const claimed = await prisma.user.updateMany({
        where: { ...SENDABLE, id: user.id, next_send_at: user.next_send_at },
        data: { next_send_at: nextSendAt(user, now) }
    });
    if (claimed.count === 0 || action !== 'send') return;

    await sendDailyMessage(user, now);
}

// Telegram answers 403 when the user blocked the bot or deleted their account.
function isBlockedByUser(err) {
    return err.response && err.response.statusCode === 403;
}

async function sendDailyMessage(user, now) {
    const briefing = await buildBriefing(user, now);
    if (!briefing) return;

    try {
        await bot.sendMessage(user.telegram_chat_id, briefing.text);
    } catch (err) {
        if (isBlockedByUser(err)) {
            await prisma.user.update({ where: { id: user.id }, data: { subscription_status: 'cancelled' } });
            console.log(`User ${user.id} blocked the bot; marked cancelled`);
            return;
        }
        throw err;
    }

    await prisma.messageLog.create({
        data: { user_id: user.id, message_id: briefing.messageId }
    });
    console.log(`Sent message to user ${user.id}`);

    await checkUserCycleReminder(user, now);
}

module.exports = { startScheduler, sendDueBriefings };
