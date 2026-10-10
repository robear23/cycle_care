require('dotenv').config();
const fs = require('fs');
const express = require('express');
const path = require('path');
const { initBot, bot } = require('./bot/index');
const { startScheduler } = require('./scheduler/daily');
const { handleReminderCallbacks } = require('./scheduler/reminders');
const apiRoutes = require('./api/routes');
const { messagePage } = require('./api/pages');

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// Number of reverse proxies in front of the app (Railway/Render/Heroku use one),
// so rate limiting sees the visitor's IP rather than the proxy's.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

// The landing page needs absolute URLs for social previews, so fill in the site URL.
const landingPage = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
    .replaceAll('{{SITE_URL}}', (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, ''));
app.get(['/', '/index.html'], (req, res) => {
    res.type('html').send(landingPage);
});

// Serve static assets from public directory (/privacy serves privacy.html)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', apiRoutes);

app.use((req, res) => {
    res.status(404).send(messagePage('Page not found', "We couldn't find that page."));
});

// Express recognises error handlers by their four parameters, so `next` must stay.
app.use((err, req, res, next) => {
    console.error('Request failed:', err);
    res.status(err.status || 500).send(messagePage('Something went wrong', 'Please try again in a moment.'));
});

// Last line of defence: log stray async errors instead of letting Node kill the
// process (and with it the bot, scheduler and website).
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

async function main() {
    // Start Bot
    await initBot();
    handleReminderCallbacks(bot);

    // Start Scheduler
    startScheduler();

    // Start Server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
});
