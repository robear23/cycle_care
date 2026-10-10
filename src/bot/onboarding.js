const { prisma } = require('../lib/prisma');
const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const cityTimezones = require('city-timezones');
const { normalizeEmail } = require('../lib/email');
const { emailForStartPayload } = require('../lib/waitlist');
const { userToday, addDays, parseUserDate, periodStartProblem } = require('../lib/dates');
const { MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH } = require('../lib/cycle');

// In-memory state for onboarding: { [chatId]: { step: 'email' | 'name' | 'date' | 'time' | 'timezone' | 'cycle_length', data: {} } }
const onboardingState = new Map();

const STEPS = {
    EMAIL: 'email',
    NAME: 'name',
    DATE: 'date',
    TIME: 'time',
    TIMEZONE: 'timezone',
    CYCLE_LENGTH: 'cycle_length',
    COMPLETED: 'completed'
};

const CYCLE_RANGE_HINT = `between ${MIN_CYCLE_LENGTH} and ${MAX_CYCLE_LENGTH} days`;
const CYCLE_LENGTH_QUESTION = "Last question: what's your partner's typical cycle length? You can give a single number or a range (e.g. '28' or '28-34'). Type 'skip' to use the default of 28 days.";

function parseCycleRange(text) {
    const trimmed = text.trim();
    if (trimmed.toLowerCase() === 'skip') return { min: 28, max: 28, avg: 28 };

    const inBounds = (n) => n >= MIN_CYCLE_LENGTH && n <= MAX_CYCLE_LENGTH;

    // "28-34" or "28–34"
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        if (inBounds(min) && inBounds(max) && max >= min) {
            return { min, max, avg: Math.round((min + max) / 2) };
        }
    }

    // single number
    const singleMatch = trimmed.match(/^(\d+)$/);
    if (singleMatch) {
        const val = parseInt(singleMatch[1]);
        if (inBounds(val)) {
            return { min: val, max: val, avg: val };
        }
    }

    return null;
}

// /start [payload]. Existing users are asked before their settings are overwritten.
async function handleStart(bot, msg, payload) {
    const chatId = msg.chat.id.toString();
    onboardingState.delete(chatId);

    const existingUser = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (existingUser) {
        const paused = ['paused', 'cancelled'].includes(existingUser.subscription_status);
        const pausedNote = paused ? "\n\nYour daily messages are currently paused — send /resume to turn them back on." : '';
        await bot.sendMessage(chatId, `You're already set up 💜 Do you want to redo your setup? Your current settings will be replaced.${pausedNote}`, {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Redo setup', callback_data: 'onboarding_restart' },
                    { text: 'Keep my settings', callback_data: 'onboarding_keep' }
                ]]
            }
        });
        return;
    }

    let prefilledEmail = null;
    let referredBy = null;
    if (payload) {
        prefilledEmail = await emailForStartPayload(payload);
        if (!prefilledEmail && /^[A-Za-z0-9]{6}$/.test(payload)) {
            const referrer = await prisma.user.findUnique({ where: { referral_code: payload.toUpperCase() } });
            if (referrer) referredBy = referrer.referral_code;
        }
    }

    await handleOnboarding(bot, msg, prefilledEmail, referredBy);
}

// Handles the "redo setup?" buttons. Returns true if the action was handled.
async function handleOnboardingCallback(bot, callbackQuery) {
    switch (callbackQuery.data) {
        case 'onboarding_restart': {
            await bot.answerCallbackQuery(callbackQuery.id);
            onboardingState.delete(callbackQuery.message.chat.id.toString());
            await handleOnboarding(bot, callbackQuery.message);
            return true;
        }
        case 'onboarding_keep': {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'No changes made' });
            await bot.sendMessage(callbackQuery.message.chat.id, "No problem — your settings are unchanged. Send /help to see what I can do.");
            return true;
        }
        default:
            return false;
    }
}

async function handleOnboarding(bot, msg, prefilledEmail = null, referredBy = null) {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    let state = onboardingState.get(chatId);

    if (!state) {
        const data = { referredBy };
        if (prefilledEmail) {
            onboardingState.set(chatId, { step: STEPS.NAME, data: { ...data, email: prefilledEmail } });
            await bot.sendMessage(chatId, "Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner.\n\nWhat's your partner's name? (or type 'skip' to keep messages generic)");
        } else {
            onboardingState.set(chatId, { step: STEPS.EMAIL, data });
            await bot.sendMessage(chatId, "Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner.\n\nWhat's your email? I'll use it to send you updates about new features. (type 'skip' to continue without)");
        }
        return;
    }

    switch (state.step) {
        case STEPS.EMAIL: {
            if (text.toLowerCase() === 'skip') {
                state.data.email = null;
            } else {
                const email = normalizeEmail(text);
                if (!email) {
                    await bot.sendMessage(chatId, "That doesn't look like a valid email. Please try again, or type 'skip' to continue without.");
                    return;
                }
                state.data.email = email;
            }
            state.step = STEPS.NAME;
            await bot.sendMessage(chatId, "What's your partner's name? (or type 'skip' to keep messages generic)");
            break;
        }

        case STEPS.NAME:
            state.data.partnerName = text.toLowerCase() === 'skip' ? null : text;
            state.step = STEPS.DATE;
            await bot.sendMessage(chatId, "When did their last period start? Just send me the date (e.g. '14 Feb', '2023-10-25')");
            break;

        case STEPS.DATE: {
            // The timezone isn't known yet, so parse against UTC now and re-check
            // in the user's timezone once they've given it. Local "today" can be
            // up to a day ahead of UTC (UTC+14), so allow that here.
            // The timezone is already known if we're re-asking after the timezone step.
            const knownTimezone = state.data.timezone;
            const parsedDate = parseUserDate(text, knownTimezone || 'UTC');
            if (!parsedDate) {
                await bot.sendMessage(chatId, "I couldn't understand that date. Please try again (e.g. '14 Feb', 'last tuesday', or 'YYYY-MM-DD').");
                return;
            }
            const today = knownTimezone ? userToday(knownTimezone) : addDays(userToday('UTC'), 1);
            const problem = periodStartProblem(parsedDate, today);
            if (problem) {
                await bot.sendMessage(chatId, problem);
                return;
            }
            state.data.cycleStartText = text;
            state.data.cycleStartDate = parsedDate;
            if (knownTimezone) {
                state.step = STEPS.CYCLE_LENGTH;
                await bot.sendMessage(chatId, CYCLE_LENGTH_QUESTION);
                break;
            }
            state.step = STEPS.TIME;
            await bot.sendMessage(chatId, "What time would you like your daily message? (Default is 8AM — just type a time like '09:00' or '9pm', or type 'skip')");
            break;
        }

        case STEPS.TIME: {
            let time = "08:00";
            if (text.toLowerCase() !== 'skip') {
                const parsedTime = chrono.parseDate(text);
                if (!parsedTime) {
                    await bot.sendMessage(chatId, "I couldn't understand that time. Please try again (e.g., '8am', '09:00', '9pm', or 'skip').");
                    return;
                }
                time = ('0' + parsedTime.getHours()).slice(-2) + ':' + ('0' + parsedTime.getMinutes()).slice(-2);
            }
            state.data.notificationTime = time;
            state.step = STEPS.TIMEZONE;
            await bot.sendMessage(chatId, "What's your timezone? (e.g. 'London', 'New York', 'UTC')");
            break;
        }

        case STEPS.TIMEZONE: {
            let tzToSave = text.trim();
            let isValid = DateTime.utc().setZone(tzToSave).isValid;

            if (!isValid) {
                // Try fuzzy matching via city name
                const cityMatches = cityTimezones.lookupViaCity(tzToSave);
                if (cityMatches && cityMatches.length > 0) {
                    // Sort by highest population to prioritize major cities first
                    cityMatches.sort((a, b) => (b.pop || 0) - (a.pop || 0));
                    tzToSave = cityMatches[0].timezone;
                    isValid = DateTime.utc().setZone(tzToSave).isValid;
                }
            }

            if (!isValid) {
                await bot.sendMessage(chatId, "I couldn't find that timezone or city. Please try typing a major city nearby (e.g., 'London', 'New York', 'Paris', or 'Tokyo').");
                return;
            }

            state.data.timezone = tzToSave;
            const localDate = parseUserDate(state.data.cycleStartText, tzToSave) || state.data.cycleStartDate;
            const dateProblem = periodStartProblem(localDate, userToday(tzToSave));
            if (dateProblem) {
                state.step = STEPS.DATE;
                await bot.sendMessage(chatId, `Got it — I've saved your timezone as ${tzToSave}.\n\nIn your timezone, though, that period start date doesn't work. ${dateProblem}`);
                return;
            }
            state.data.cycleStartDate = localDate;
            state.step = STEPS.CYCLE_LENGTH;
            await bot.sendMessage(chatId, `Got it — I've saved your timezone as ${tzToSave}.\n\n${CYCLE_LENGTH_QUESTION}`);
            break;
        }

        case STEPS.CYCLE_LENGTH: {
            const cycleRange = parseCycleRange(text);
            if (!cycleRange) {
                await bot.sendMessage(chatId, `I couldn't understand that. Please enter a number or range like '28' or '28-34' (${CYCLE_RANGE_HINT}), or type 'skip'.`);
                return;
            }
            try {
                await saveUser(chatId, state.data, cycleRange);
                const rangeDisplay = cycleRange.min === cycleRange.max
                    ? `${cycleRange.min} days`
                    : `${cycleRange.min}–${cycleRange.max} days (using ${cycleRange.avg} as average)`;
                await bot.sendMessage(chatId, `You're all set up.\nCycle length: ${rangeDisplay}\n\nI'll send your daily briefing at ${state.data.notificationTime} (${state.data.timezone} time). Send /help to see everything I can do.`);
            } catch (e) {
                console.error(`Failed to save onboarding for chat ${chatId}:`, e);
                await bot.sendMessage(chatId, "Something went wrong saving your data. Please try /start again.");
            } finally {
                onboardingState.delete(chatId);
            }
            break;
        }
    }
}

async function saveUser(chatId, data, cycleRange) {
    const settings = {
        email: data.email,
        partner_name: data.partnerName,
        cycle_start_date: data.cycleStartDate,
        notification_time: data.notificationTime,
        timezone: data.timezone,
        cycle_length: cycleRange.avg,
        cycle_length_min: cycleRange.min,
        cycle_length_max: cycleRange.max,
        subscription_status: 'active',
        // A fresh setup includes a period start date, which ends pregnancy mode.
        pregnancy_mode: false,
        // Recomputed from the new time and timezone on the scheduler's next tick.
        next_send_at: null
    };
    await prisma.user.upsert({
        where: { telegram_chat_id: chatId },
        // Redoing setup keeps the original referral.
        update: settings,
        create: { ...settings, telegram_chat_id: chatId, referred_by: data.referredBy }
    });
}

module.exports = { handleStart, handleOnboarding, handleOnboardingCallback, onboardingState, parseCycleRange, CYCLE_RANGE_HINT };
