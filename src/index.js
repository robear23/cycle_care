require('dotenv').config();
const express = require('express');
const path = require('path');
const { initBot, bot } = require('./bot/index');
const { startScheduler } = require('./scheduler/daily');
const apiRoutes = require('./api/routes');
const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');

const app = express();
const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PORT = process.env.PORT || 3000;

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', apiRoutes);

app.post('/api/waitlist', async (req, res) => {
    const email = req.body.email;
    console.log(`[New Lead Captured] Email: ${email}`);

    try {
        // Save to Database
        await prisma.waitlistLead.upsert({
            where: { email },
            update: {}, // if exists, do nothing
            create: { email }
        });
        console.log(`Successfully saved ${email} to Database.`);

        // Send automated welcome email via Resend
        if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
                from: 'CycleCare <contact@foresttechsolutions.net>',
                replyTo: 'contact@foresttechsolutions.net',
                to: email,
                subject: 'Welcome to CycleCare! Your setup link inside.',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #333;">
                        <h2 style="color: #6366f1;">Welcome to CycleCare! 💜</h2>
                        <p>Hi there,</p>
                        <p>We’re thrilled to have you.</p>
                        <p>Over the next month, you are going to receive exactly one short, quiet message per day. No spam, no unnecessary notifications. Just the exact information you need to understand your partner's current cycle phase and how to best support them today.</p>
                        <p>If you haven't finished setting up your daily briefing yet, it takes less than 30 seconds to get started. Just click the button below to open your secure Telegram assistant:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://t.me/cycle_care_bot" style="background-color: #3d5c31; color: white; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Open CycleCare in Telegram</a>
                        </div>
                        
                        <h3 style="color: #4b5563;">What happens next?</h3>
                        <p>Once you tap start in Telegram, I'll ask you for:</p>
                        <ol>
                            <li>Their last cycle start date</li>
                            <li>What time of day you want your message (e.g., 8:00 AM)</li>
                        </ol>
                        
                        <h3 style="color: #4b5563;">How do you handle future cycles?</h3>
                        <p>Everything is completely automated! When your bot estimates that a new cycle is beginning, it will proactively send you a quick message asking to confirm if her period started. You just tap "Yes" or "Not Yet", and the bot recalculates automatically.</p>
                        <p><em>(Nature can be unpredictable! If her cycle restarts early, you can explicitly reset the timeline at any point just by typing <code>/update</code> to the bot!)</em></p>
                        
                        <p>Best,<br><strong>The Team at ForestTech Solutions</strong><br>
                        <a href="https://foresttechsolutions.net" style="color: #6366f1;">foresttechsolutions.net</a></p>
                    </div>
                `
            });
            console.log(`Successfully sent Welcome email to ${email}`);
        } else {
            console.warn("RESEND_API_KEY not found. Skipping welcome email.");
        }
    } catch (error) {
        console.error(`Error saving lead or sending email to ${email}:`, error);
    }

    // Automatically redirect the user to the Telegram Bot
    res.redirect('https://t.me/cycle_care_bot');
});
const { handleReminderCallbacks } = require('./scheduler/reminders');

async function main() {
    // Start Bot
    initBot();
    handleReminderCallbacks(bot);

    // Start Scheduler
    startScheduler();

    // Start Server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main().catch(console.error);
