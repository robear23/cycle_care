const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chrono = require('chrono-node');

// In-memory state for onboarding: { [chatId]: { step: 'name' | 'date' | 'time' | 'timezone', data: {} } }
const onboardingState = new Map();

const STEPS = {
    NAME: 'name',
    DATE: 'date',
    TIME: 'time',
    TIMEZONE: 'timezone',
    COMPLETED: 'completed'
};

async function handleOnboarding(bot, msg) {
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
        // Initial start
        onboardingState.set(chatId, { step: STEPS.NAME, data: {} });
        await bot.sendMessage(chatId, "Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner.\n\nFirst — what's their name? (or type 'skip' to keep messages generic)");
        return;
    }

    switch (state.step) {
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
            state.data.timezone = text;

            // Save to DB
            try {
                await prisma.user.upsert({
                    where: { telegram_chat_id: chatId },
                    update: {
                        partner_name: state.data.partnerName,
                        cycle_start_date: state.data.cycleStartDate,
                        notification_time: state.data.notificationTime,
                        timezone: state.data.timezone,
                        subscription_status: 'active'
                    },
                    create: {
                        telegram_chat_id: chatId,
                        partner_name: state.data.partnerName,
                        cycle_start_date: state.data.cycleStartDate,
                        notification_time: state.data.notificationTime,
                        timezone: state.data.timezone,
                        subscription_status: 'active'
                    }
                });

                await bot.sendMessage(chatId, "Great! You're all set up.");
                await bot.sendMessage(chatId, "Starting tomorrow, I'll send you a daily message.");

                onboardingState.delete(chatId);
            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, "Something went wrong saving your data. Please try /start again.");
                onboardingState.delete(chatId);
            }
            break;
    }
}

module.exports = { handleOnboarding, onboardingState };
