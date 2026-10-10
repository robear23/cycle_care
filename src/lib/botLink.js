const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'cycle_care_bot';

// Deep link to the bot, optionally carrying a /start payload (max 64 chars per Telegram).
function botLink(startParam) {
    const base = `https://t.me/${BOT_USERNAME}`;
    return startParam ? `${base}?start=${startParam}` : base;
}

module.exports = { botLink };
