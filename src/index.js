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

const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX, // e.g., 'us21'
});

app.post('/api/waitlist', async (req, res) => {
    const email = req.body.email;
    console.log(`[New Lead Captured] Email: ${email}`);

    try {
        if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID) {
            await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID, {
                email_address: email,
                status: "subscribed",
            });
            console.log(`Successfully added ${email} to Mailchimp Audience.`);
        } else {
            console.warn("Mailchimp credentials not found. Email was not saved to Mailchimp.");
        }
    } catch (error) {
        console.error(`Failed to add ${email} to Mailchimp:`, error.response?.body || error.message);
    }

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
