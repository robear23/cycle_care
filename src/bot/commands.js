const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculatePhase, getUpcomingPhasesRanges } = require('../lib/cycle');
const { parseCycleRange } = require('./onboarding');

// In-memory state for /cyclelength command: { [chatId]: true }
const cycleLengthState = new Map();

async function handleUpdate(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const partnerName = (user.partner_name && user.partner_name.toLowerCase() !== 'skip' && user.partner_name !== '/start') ? user.partner_name : 'Your partner';

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Yes, started today', callback_data: `period_start_today` },
                    { text: 'Yes, yesterday', callback_data: `period_start_yesterday` }
                ],
                [
                    { text: 'Cancel', callback_data: `period_not_yet` }
                ]
            ]
        }
    };

    await bot.sendMessage(chatId, `When did ${partnerName}'s new cycle start?`, opts);
}

async function handleToday(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const { phase, day, fertility } = calculatePhase(user.cycle_start_date, user.cycle_length);

    // Fetch a message for this phase
    // For MVP, just picking one random message from DB
    const message = await prisma.message.findFirst({
        where: { phase: phase },
        // Random offset? Or just first for now.
        // Prisma doesn't support random() natively easily.
        // We can fetch all IDs and pick one.
    });

    const rawPartnerName = (user.partner_name && user.partner_name.toLowerCase() !== 'skip' && user.partner_name !== '/start') ? user.partner_name : null;
    const displayPhase = phase.charAt(0).toUpperCase() + phase.slice(1);
    const body = message ? message.message_text.replace(/\[Partner\]/g, (match, offset) => {
        if (rawPartnerName) return rawPartnerName;
        return offset === 0 ? 'Your partner' : 'your partner';
    }) : null;
    const text = body ? `Day ${day} • ${displayPhase} • Fertility: ${fertility}\n\n` + body : "No message found for today.";

    await bot.sendMessage(chatId, text);
}

async function handlePhase(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const { phase, day } = calculatePhase(user.cycle_start_date, user.cycle_length);
    await bot.sendMessage(chatId, `Current Status:\nDay: ${day}\nPhase: ${phase}`);
}

async function handleLearn(bot, msg, match) {
    const chatId = msg.chat.id;
    const topic = match && match[1] ? match[1].trim().toLowerCase() : null;

    if (!topic) {
        return bot.sendMessage(chatId, "What would you like to learn about? Try:\n/learn menstrual\n/learn follicular\n/learn ovulation\n/learn luteal");
    }

    let content = "";
    switch (topic) {
        case 'menstrual':
            content = "🩸 **Menstrual Phase (Days 1-5)**\nThe uterus sheds its lining. Energy is lowest. Focus on rest and comfort.";
            break;
        case 'follicular':
            content = "🌱 **Follicular Phase (Days 6-13)**\nEstrogen rises. Energy and mood improve. Great time for new activities.";
            break;
        case 'ovulation':
            content = "✨ **Ovulation Phase (Days 14-16)**\nPeak energy and confidence. Libido may be higher.";
            break;
        case 'luteal':
            content = "🍂 **Luteal Phase (Days 17-28)**\nProgesterone rises then drops. PMS symptoms (mood swings, bloating) may appear. Patience is key.";
            break;
        default:
            content = "I don't have info on that yet. Try one of the phases: menstrual, follicular, ovulation, luteal.";
    }
    await bot.sendMessage(chatId, content, { parse_mode: 'Markdown' });
}

async function handleSubscription(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) return;

    let text = `Your subscription status: *ACTIVE*\n\nCycleCare is a free tool! You have full lifetime access.`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleRefer(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (!user) return;

    // Generate code if missing
    let code = user.referral_code;
    if (!code) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await prisma.user.update({
            where: { id: user.id },
            data: { referral_code: code }
        });
    }

    const link = `https://t.me/CycleCareBot?start=${code}`;
    await bot.sendMessage(chatId, `Here is your referral link:\n${link}\n\nShare this to give friends a 14-day trial!`);
}

async function handleCycleLength(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const hasRange = user.cycle_length_min && user.cycle_length_max && user.cycle_length_min !== user.cycle_length_max;
    const current = hasRange
        ? `${user.cycle_length_min}–${user.cycle_length_max} days (average: ${user.cycle_length})`
        : `${user.cycle_length} days`;

    cycleLengthState.set(chatId, true);
    await bot.sendMessage(chatId, `Current cycle length: ${current}\n\nEnter a new cycle length — a single number or a range (e.g. '28' or '28-34'). Type 'cancel' to keep the current setting.`);
}

async function handleCycleLengthMessage(bot, msg) {
    const chatId = msg.chat.id.toString();
    if (!cycleLengthState.has(chatId)) return false;

    const text = msg.text.trim();

    if (text.toLowerCase() === 'cancel') {
        cycleLengthState.delete(chatId);
        await bot.sendMessage(chatId, "No changes made.");
        return true;
    }

    const cycleRange = parseCycleRange(text);
    if (!cycleRange) {
        await bot.sendMessage(chatId, "I couldn't understand that. Please enter a number or range like '28' or '28-34' (between 14 and 60), or type 'cancel'.");
        return true;
    }

    await prisma.user.update({
        where: { telegram_chat_id: chatId },
        data: {
            cycle_length: cycleRange.avg,
            cycle_length_min: cycleRange.min,
            cycle_length_max: cycleRange.max
        }
    });

    cycleLengthState.delete(chatId);

    const rangeDisplay = cycleRange.min === cycleRange.max
        ? `${cycleRange.min} days`
        : `${cycleRange.min}–${cycleRange.max} days (average: ${cycleRange.avg})`;
    await bot.sendMessage(chatId, `Cycle length updated to ${rangeDisplay}.`);
    return true;
}

async function handleWeekends(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const { luteal, menstrual } = getUpcomingPhasesRanges(user.cycle_start_date, user.cycle_length);

    const getWeekendsInRange = (start, end) => {
        const weekends = [];
        const current = new Date(start);
        while (current <= end) {
            const day = current.getDay();
            if (day === 0 || day === 6) { // Sunday = 0, Saturday = 6
                weekends.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
        }
        return weekends;
    };

    const lutealWeekends = getWeekendsInRange(luteal.start, luteal.end);
    const menstrualWeekends = getWeekendsInRange(menstrual.start, menstrual.end);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    let text = "🗓 **Upcoming Phase Weekends**\n\n";

    if (lutealWeekends.length > 0) {
        text += "🍂 **Luteal Phase:**\n";
        lutealWeekends.forEach(d => {
            text += `• ${formatDate(d)}\n`;
        });
    } else {
        text += "🍂 **Luteal Phase:** No weekends in this phase.\n";
    }

    text += "\n";

    if (menstrualWeekends.length > 0) {
        text += "🩸 **Next Menstrual Phase:**\n";
        menstrualWeekends.forEach(d => {
            text += `• ${formatDate(d)}\n`;
        });
    } else {
        text += "🩸 **Next Menstrual Phase:** No weekends in this phase.\n";
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleHelp(bot, msg) {
    const helpText = `
/start - Start onboarding
/update - Update cycle start date
/cyclelength - View or update cycle length range
/today - Get today's message
/phase - Get current phase info
/weekends - Get upcoming luteal/menstrual weekends
/learn - Learn about cycle phases
/subscription - Manage subscription
/refer - Share CycleCare
/help - Show this help
  `;
    await bot.sendMessage(msg.chat.id, helpText);
}

module.exports = {
    handleUpdate,
    handleToday,
    handlePhase,
    handleHelp,
    handleLearn,
    handleSubscription,
    handleRefer,
    handleCycleLength,
    handleWeekends,
    handleCycleLengthMessage
};
