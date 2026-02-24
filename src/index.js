require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, bot } = require('./bot/index');
const { startScheduler } = require('./scheduler/daily');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', apiRoutes);

app.post('/api/waitlist', (req, res) => {
    const email = req.body.email;
    console.log(`[New Lead Captured] Email: ${email}`);
    // Automatically redirect the user to the Telegram Bot
    res.redirect('https://t.me/cycle_care_bot');
});

const { checkCycleReminders, handleReminderCallbacks } = require('./scheduler/reminders');
const cron = require('node-cron');

async function main() {
    // Start Bot
    initBot();
    handleReminderCallbacks(bot);

    // Start Scheduler
    startScheduler();

    // Schedule Cycle Reminders (Run daily at 9 PM UTC)
    cron.schedule('0 21 * * *', () => {
        checkCycleReminders();
    });

    // Start Server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main().catch(console.error);
