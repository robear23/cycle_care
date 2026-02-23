require('dotenv').config();
const express = require('express');
const { initBot, bot } = require('./bot/index');
const { startScheduler } = require('./scheduler/daily');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(express.json());

app.use('/', apiRoutes);

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
