const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');
const { DateTime } = require('luxon');

const prisma = new PrismaClient();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function checkAndNurtureLeads() {
    console.log('[Nurture] Checking for leads to nurture...');

    if (!resend) {
        console.warn('[Nurture] RESEND_API_KEY not found. Skipping nurturing.');
        return;
    }

    const twentyFourHoursAgo = DateTime.utc().minus({ hours: 24 }).toJSDate();

    // Find leads created > 24h ago that haven't been nurtured yet
    const leads = await prisma.waitlistLead.findMany({
        where: {
            nurtured: false,
            created_at: { lt: twentyFourHoursAgo }
        }
    });

    for (const lead of leads) {
        try {
            // Check if they signed up already
            const user = await prisma.user.findUnique({
                where: { email: lead.email }
            });

            if (user) {
                // Already signed up, mark as nurtured so we don't check again
                await prisma.waitlistLead.update({
                    where: { id: lead.id },
                    data: { nurtured: true }
                });
                continue;
            }

            // Send reminder email
            console.log(`[Nurture] Sending follow-up to ${lead.email}`);
            await resend.emails.send({
                from: 'CycleCare <contact@foresttechsolutions.net>',
                replyTo: 'contact@foresttechsolutions.net',
                to: lead.email,
                subject: 'Ready to start CycleCare? 💜',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; color: #333;">
                        <h2 style="color: #6366f1;">Just a gentle reminder!</h2>
                        <p>Hi there,</p>
                        <p>You recently signed up for the CycleCare waitlist, but it looks like you haven't connected your Telegram bot yet.</p>
                        <p>It takes less than 30 seconds to set up, and you'll start receiving your daily support briefings immediately.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://t.me/cycle_care_bot" style="background-color: #3d5c31; color: white; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; display: inline-block;">Connect now on Telegram</a>
                        </div>
                        
                        <p>If you have any questions, just reply to this email!</p>
                        
                        <p>Best,<br><strong>The Team at ForestTech Solutions</strong><br>
                        <a href="https://foresttechsolutions.net" style="color: #6366f1;">foresttechsolutions.net</a></p>
                    </div>
                `
            });

            // Mark as nurtured
            await prisma.waitlistLead.update({
                where: { id: lead.id },
                data: { nurtured: true }
            });

        } catch (error) {
            console.error(`[Nurture] Error processing lead ${lead.email}:`, error);
        }
    }
}

module.exports = { checkAndNurtureLeads };
