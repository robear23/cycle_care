const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { calculatePhase } = require('../lib/cycle');
const { getDailyMessage } = require('../lib/messages');
const { bot } = require('../bot/index');
const { checkUserCycleReminder } = require('./reminders');

const prisma = new PrismaClient();

const { DateTime } = require('luxon');

function startScheduler() {
    console.log('Scheduler started...');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        // Current UTC time
        const nowUtc = DateTime.utc();

        // We want to find users where their LOCAL time matches their notification_time.
        const users = await prisma.user.findMany({
            where: { subscription_status: { in: ['trial', 'active'] } }
        });

        users.forEach(async (user) => {
            try {
                const userTz = user.timezone || 'UTC';

                // Get current time in user's timezone
                // Luxon setZone converts the instant to the new zone
                const userTime = nowUtc.setZone(userTz);

                // Format to HH:mm
                const currentLocalTime = userTime.toFormat('HH:mm');

                if (currentLocalTime === user.notification_time) {
                    console.log(`Sending message to ${user.telegram_chat_id} at ${currentLocalTime} ${userTz}`);
                    await sendDailyMessage(user);
                }
            } catch (err) {
                console.error(`Error processing user ${user.id}:`, err);
            }
        });
    });
}

async function sendDailyMessage(user) {
    const { phase, day, fertility } = calculatePhase(user.cycle_start_date, user.cycle_length);
    const message = await getDailyMessage(user.id, phase);

    if (message) {
        const partnerName = (user.partner_name && user.partner_name.toLowerCase() !== 'skip' && user.partner_name !== '/start') ? user.partner_name : 'Your partner';
        const displayPhase = phase.charAt(0).toUpperCase() + phase.slice(1);
        const text = `Day ${day} • ${displayPhase} • Fertility: ${fertility}\n\n` + message.message_text.replace('[Partner]', partnerName);

        try {
            await bot.sendMessage(user.telegram_chat_id, text);

            // Log it
            await prisma.messageLog.create({
                data: {
                    user_id: user.id,
                    message_id: message.id
                }
            });
            console.log(`Sent message to user ${user.id}`);

            // Check if we also need to append a cycle-end reminder
            await checkUserCycleReminder(user);
        } catch (e) {
            console.error(`Failed to send to user ${user.id}`, e);
        }
    }
}

module.exports = { startScheduler };
