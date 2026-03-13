const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const cityTimezones = require('city-timezones');

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

function isValidEmail(text) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

function parseCycleRange(text) {
    const trimmed = text.trim();
    if (trimmed.toLowerCase() === 'skip') return { min: 28, max: 28, avg: 28 };

    // "28-34" or "28–34"
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        if (min >= 14 && max >= min && max <= 60) {
            return { min, max, avg: Math.round((min + max) / 2) };
        }
    }

    // single number
    const singleMatch = trimmed.match(/^(\d+)$/);
    if (singleMatch) {
        const val = parseInt(singleMatch[1]);
        if (val >= 14 && val <= 60) {
            return { min: val, max: val, avg: val };
        }
    }

    return null;
}

async function handleOnboarding(bot, msg, prefilledEmail = null) {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    // Check if user is already in DB
    const existingUser = await prisma.user.findUnique({ where: { telegram_chat_id: chatId } });
    if (existingUser && !onboardingState.has(chatId)) {
        // If user exists and not currently onboarding, maybe ignore or redirect?
        // If they sent /start again, maybe re-onboard or show menu?
        // For now, let's assume /start triggers this.
    }

    let state = onboardingState.get(chatId);

    if (!state) {
        if (prefilledEmail) {
            onboardingState.set(chatId, { step: STEPS.NAME, data: { email: prefilledEmail } });
            await bot.sendMessage(chatId, "Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner.\n\nWhat's your partner's name? (or type 'skip' to keep messages generic)");
        } else {
            onboardingState.set(chatId, { step: STEPS.EMAIL, data: {} });
            await bot.sendMessage(chatId, "Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner.\n\nWhat's your email? I'll use it to send you updates about new features. (type 'skip' to continue without)");
        }
        return;
    }

    switch (state.step) {
        case STEPS.EMAIL:
            if (text.toLowerCase() === 'skip') {
                state.data.email = null;
            } else if (isValidEmail(text)) {
                state.data.email = text.trim().toLowerCase();
            } else {
                await bot.sendMessage(chatId, "That doesn't look like a valid email. Please try again, or type 'skip' to continue without.");
                return;
            }
            state.step = STEPS.NAME;
            onboardingState.set(chatId, state);
            await bot.sendMessage(chatId, "What's your partner's name? (or type 'skip' to keep messages generic)");
            break;

        case STEPS.NAME:
            state.data.partnerName = text.toLowerCase() === 'skip' ? null : text;
            state.step = STEPS.DATE;
            onboardingState.set(chatId, state);
            await bot.sendMessage(chatId, "When did their last period start? Just send me the date (e.g. '14 Feb', '2023-10-25')");
            break;

        case STEPS.DATE:
            // Natural language date parsing
            const parsedDate = chrono.parseDate(text);

            if (!parsedDate) {
                await bot.sendMessage(chatId, "I couldn't understand that date. Please try again (e.g. '14 Feb', 'last tuesday', or 'YYYY-MM-DD').");
                return;
            }
            state.data.cycleStartDate = parsedDate;
            state.step = STEPS.TIME;
            onboardingState.set(chatId, state);
            await bot.sendMessage(chatId, "What time would you like your daily message? (Default is 8AM — just type a time like '09:00' or '9pm', or type 'skip')");
            break;

        case STEPS.TIME:
            // Basic time parsing
            let time = "08:00";
            if (text.toLowerCase() !== 'skip') {
                const parsedTime = chrono.parseDate(text);
                if (parsedTime) {
                    time = ('0' + parsedTime.getHours()).slice(-2) + ':' + ('0' + parsedTime.getMinutes()).slice(-2);
                } else {
                    await bot.sendMessage(chatId, "I couldn't understand that time. Please try again (e.g., '8am', '09:00', '9pm', or 'skip').");
                    return;
                }
            }
            state.data.notificationTime = time;
            state.step = STEPS.TIMEZONE;
            onboardingState.set(chatId, state);
            await bot.sendMessage(chatId, "Last question: What's your timezone? (e.g. 'London', 'New York', 'UTC')");
            break;

        case STEPS.TIMEZONE:
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
            state.step = STEPS.CYCLE_LENGTH;
            onboardingState.set(chatId, state);
            await bot.sendMessage(chatId, `Got it — I've saved your timezone as ${tzToSave}.\n\nOne last thing: what's your partner's typical cycle length? You can give a single number or a range (e.g. '28' or '28-34'). Type 'skip' to use the default of 28 days.`);
            break;

        case STEPS.CYCLE_LENGTH:
            const cycleRange = parseCycleRange(text);
            if (!cycleRange) {
                await bot.sendMessage(chatId, "I couldn't understand that. Please enter a number or range like '28' or '28-34' (between 14 and 60 days), or type 'skip'.");
                return;
            }
            state.data.cycleLengthMin = cycleRange.min;
            state.data.cycleLengthMax = cycleRange.max;
            state.data.cycleLength = cycleRange.avg;

            // Save to DB
            try {
                await prisma.user.upsert({
                    where: { telegram_chat_id: chatId },
                    update: {
                        email: state.data.email,
                        partner_name: state.data.partnerName,
                        cycle_start_date: state.data.cycleStartDate,
                        notification_time: state.data.notificationTime,
                        timezone: state.data.timezone,
                        cycle_length: state.data.cycleLength,
                        cycle_length_min: state.data.cycleLengthMin,
                        cycle_length_max: state.data.cycleLengthMax,
                        subscription_status: 'active'
                    },
                    create: {
                        telegram_chat_id: chatId,
                        email: state.data.email,
                        partner_name: state.data.partnerName,
                        cycle_start_date: state.data.cycleStartDate,
                        notification_time: state.data.notificationTime,
                        timezone: state.data.timezone,
                        cycle_length: state.data.cycleLength,
                        cycle_length_min: state.data.cycleLengthMin,
                        cycle_length_max: state.data.cycleLengthMax,
                        subscription_status: 'active'
                    }
                });

                const rangeDisplay = state.data.cycleLengthMin === state.data.cycleLengthMax
                    ? `${state.data.cycleLengthMin} days`
                    : `${state.data.cycleLengthMin}–${state.data.cycleLengthMax} days (using ${state.data.cycleLength} as average)`;
                await bot.sendMessage(chatId, `You're all set up.\nCycle length: ${rangeDisplay}`);
                await bot.sendMessage(chatId, `Starting tomorrow morning, I'll send you a brief daily message.`);

                onboardingState.delete(chatId);
            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, "Something went wrong saving your data. Please try /start again.");
                onboardingState.delete(chatId);
            }
            break;
    }
}

module.exports = { handleOnboarding, onboardingState, parseCycleRange };
