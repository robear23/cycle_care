const { prisma } = require('../lib/prisma');
const { botLink } = require('../lib/botLink');
const { getUpcomingPhasesRanges, getPhaseRanges } = require('../lib/cycle');
const { partnerName, cycleStatus, buildBriefing } = require('../lib/briefing');
const { userToday, addDays, formatCalendarDate } = require('../lib/dates');
const { parseCycleRange, CYCLE_RANGE_HINT } = require('./onboarding');
const { buildPregnancyUpdate, dueDateLine } = require('../lib/pregnancy');
const { PREGNANCY_PAUSED_TEXT } = require('./pregnancy');
const { TODAY_YESTERDAY_ROW, OTHER_DATE_BUTTON } = require('./periodStart');

// In-memory state for /cyclelength command: { [chatId]: true }
const cycleLengthState = new Map();

async function handleUpdate(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    const opts = {
        reply_markup: {
            inline_keyboard: [
                TODAY_YESTERDAY_ROW,
                [OTHER_DATE_BUTTON, { text: 'Cancel', callback_data: 'period_update_cancel' }]
            ]
        }
    };

    await bot.sendMessage(chatId, `When did ${partnerName(user) || 'your partner'}'s new cycle start?`, opts);
}

// This week's pregnancy update, or the paused notice plus due date in weeks without one.
function pregnancyStatusText(user) {
    return buildPregnancyUpdate(user) || `${PREGNANCY_PAUSED_TEXT}\n\n${dueDateLine(user)}`;
}

async function handleToday(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    if (user.pregnancy_mode) {
        await bot.sendMessage(chatId, pregnancyStatusText(user));
        return;
    }

    const briefing = await buildBriefing(user);
    await bot.sendMessage(chatId, briefing ? briefing.text : "No message found for today.");
}

async function handlePhase(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) {
        await bot.sendMessage(chatId, "You need to sign up first! Send /start.");
        return;
    }

    if (user.pregnancy_mode) {
        await bot.sendMessage(chatId, pregnancyStatusText(user));
        return;
    }

    const { phase, day } = cycleStatus(user);
    await bot.sendMessage(chatId, `Current Status:\nDay: ${day}\nPhase: ${phase}`);
}

const LEARN_TOPICS = {
    menstrual: { emoji: '🩸', title: 'Menstrual Phase', text: 'The uterus sheds its lining. Energy is lowest. Focus on rest and comfort.' },
    follicular: { emoji: '🌱', title: 'Follicular Phase', text: 'Estrogen rises. Energy and mood improve. Great time for new activities.' },
    ovulation: { emoji: '✨', title: 'Ovulation Phase', text: 'Peak energy and confidence. Libido may be higher.' },
    luteal: { emoji: '🍂', title: 'Luteal Phase', text: 'Progesterone rises then drops. PMS symptoms (mood swings, bloating) may appear. Patience is key.' }
};

async function handleLearn(bot, msg, match) {
    const chatId = msg.chat.id.toString();
    const topic = match && match[1] ? match[1].trim().toLowerCase() : null;

    if (!topic) {
        return bot.sendMessage(chatId, "What would you like to learn about? Try:\n/learn menstrual\n/learn follicular\n/learn ovulation\n/learn luteal");
    }

    const info = LEARN_TOPICS[topic];
    if (!info) {
        return bot.sendMessage(chatId, "I don't have info on that yet. Try one of the phases: menstrual, follicular, ovulation, luteal.");
    }

    // Day ranges follow the user's own cycle length when we know it.
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    const cycleLength = user ? user.cycle_length : 28;
    const range = getPhaseRanges(cycleLength, user ? user.period_duration : 5)[topic];
    const days = range.end < range.start
        ? `very short in a ${cycleLength}-day cycle`
        : range.start === range.end ? `Day ${range.start}` : `Days ${range.start}-${range.end}`;

    await bot.sendMessage(chatId, `${info.emoji} *${info.title} (${days})*\n${info.text}\n\n_Based on a ${cycleLength}-day cycle. Estimates only — not medical advice._`, { parse_mode: 'Markdown' });
}

async function handleSubscription(bot, msg) {
    const chatId = msg.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });

    if (!user) return;

    const paused = ['paused', 'cancelled'].includes(user.subscription_status);
    const text = paused
        ? `Your daily messages are *PAUSED*. Send /resume to turn them back on.\n\nCycleCare is a free tool — you have full lifetime access.`
        : `Your daily messages are *ON*. Send /stop to pause them.\n\nCycleCare is a free tool — you have full lifetime access.`;

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

    const link = botLink(code);
    await bot.sendMessage(chatId, `Here is your referral link:\n${link}\n\nShare it with friends — CycleCare is free!`);
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
        await bot.sendMessage(chatId, `I couldn't understand that. Please enter a number or range like '28' or '28-34' (${CYCLE_RANGE_HINT}), or type 'cancel'.`);
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

    if (user.pregnancy_mode) {
        await bot.sendMessage(chatId, PREGNANCY_PAUSED_TEXT);
        return;
    }

    const { luteal, menstrual } = getUpcomingPhasesRanges(user.cycle_start_date, user.cycle_length, userToday(user.timezone), user.period_duration);

    const getWeekendsInRange = (start, end) => {
        const weekends = [];
        for (let current = start; current <= end; current = addDays(current, 1)) {
            const day = current.getUTCDay();
            if (day === 0 || day === 6) { // Sunday = 0, Saturday = 6
                weekends.push(current);
            }
        }
        return weekends;
    };

    const lutealWeekends = getWeekendsInRange(luteal.start, luteal.end);
    const menstrualWeekends = getWeekendsInRange(menstrual.start, menstrual.end);

    const formatDate = (date) => {
        return formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
    };

    let text = "🗓 *Upcoming Phase Weekends*\n\n";

    if (lutealWeekends.length > 0) {
        text += "🍂 *Luteal Phase:*\n";
        lutealWeekends.forEach(d => {
            text += `• ${formatDate(d)}\n`;
        });
    } else {
        text += "🍂 *Luteal Phase:* No weekends in this phase.\n";
    }

    text += "\n";

    if (menstrualWeekends.length > 0) {
        text += "🩸 *Next Menstrual Phase:*\n";
        menstrualWeekends.forEach(d => {
            text += `• ${formatDate(d)}\n`;
        });
    } else {
        text += "🩸 *Next Menstrual Phase:* No weekends in this phase.\n";
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleHelp(bot, msg) {
    let helpText = `/start - Start onboarding
/update - Update cycle start date
/cyclelength - View or update cycle length range
/today - Get today's message
/phase - Get current phase info
/weekends - Get upcoming luteal/menstrual weekends
/resume - Resume daily messages (after /stop or pregnancy)
/learn - Learn about cycle phases
/subscription - Check your message status
/refer - Share CycleCare
/stop - Pause daily messages
/delete - Permanently delete your data
/help - Show this help

CycleCare gives estimates only. It is not medical advice and must not be used as contraception.`;
    if (process.env.PUBLIC_SITE_URL) {
        helpText += `\n\nPrivacy policy: ${process.env.PUBLIC_SITE_URL}/privacy`;
    }
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
    handleCycleLengthMessage,
    cycleLengthState
};
